import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/auth/session"
import { readProfilePhoto, saveProfilePhoto } from "@/lib/profile-photo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const photo = await readProfilePhoto(session.userId)
  if (!photo) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } })
  return new Response(photo.bytes, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "invalid-photo" }, { status: 400 })
  }
  const file = formData.get("photo")
  if (!(file instanceof File) || !await saveProfilePhoto(session.userId, file)) {
    return NextResponse.json({ error: "invalid-photo" }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
