import "server-only"

// Limit the streamed body too: Content-Length is optional and cannot be trusted.
export async function readOrderPaymentForm(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data") || !request.body) throw new Error("payment-lines-required")
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 20 * 1024 * 1024) {
      await reader.cancel()
      throw new Error("payment-files-too-large")
    }
    chunks.push(value)
  }
  const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData()
  const raw = form.get("payments")
  if (typeof raw !== "string" || raw.length > 500_000) throw new Error("payment-lines-required")
  let input: unknown
  try { input = JSON.parse(raw) } catch { throw new Error("invalid-payment") }
  const files: { index: number; supplierWide: boolean; name: string; type: string; size: number; base64: string }[] = []
  for (const [key, file] of form.entries()) {
    if (key === "payments") continue
    if (!/^(supplier-)?contract-\d+$/.test(key) || typeof file === "string" || !file.size || file.size > 5 * 1024 * 1024) throw new Error("invalid-contract-file")
    const index = Number(key.split("-").at(-1))
    if (!Array.isArray(input) || index >= input.length || files.some((item) => item.index === index)) throw new Error("invalid-contract-file")
    files.push({ index, supplierWide: key.startsWith("supplier-"), name: file.name.replace(/[\r\n\u0000-\u001f]/g, "").slice(0, 200) || "contract", type: file.type, size: file.size, base64: Buffer.from(await file.arrayBuffer()).toString("base64") })
  }
  return { input, files }
}
