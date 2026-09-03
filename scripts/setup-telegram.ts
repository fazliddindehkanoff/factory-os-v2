export {}

const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
const webAppUrl = process.env.TELEGRAM_WEB_APP_URL?.trim()

if (!token || !secret || !webAppUrl) {
  throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and TELEGRAM_WEB_APP_URL are required")
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  throw new Error("TELEGRAM_WEBHOOK_SECRET may contain only A-Z, a-z, 0-9, _ and -")
}
const parsedWebAppUrl = new URL(webAppUrl)
if (parsedWebAppUrl.protocol !== "https:") throw new Error("TELEGRAM_WEB_APP_URL must use HTTPS")
const webhookUrl = new URL("/api/telegram/webhook", parsedWebAppUrl).toString()

async function telegram(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const result = await response.json() as { ok?: boolean; description?: string; result?: unknown }
  if (!response.ok || !result.ok) throw new Error(result.description || `${method} failed`)
  return result.result
}

async function main() {
  const bot = await telegram("getMe", {}) as { username?: string }
  await telegram("setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message"],
  })
  await telegram("setMyCommands", {
    commands: [
      { command: "start", description: "Factory OS’ni ochish" },
      { command: "help", description: "Yordam" },
    ],
  })

  console.log(`Telegram bot @${bot.username ?? "unknown"} is connected to ${webhookUrl}`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Telegram setup failed")
  process.exitCode = 1
})
