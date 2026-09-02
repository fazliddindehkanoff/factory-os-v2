export const USER_PASSWORD_MIN_LENGTH = 8
export const USER_PASSWORD_MAX_LENGTH = 128

export type SettingsUserUpdateInput = {
  fullName: string
  positionId: string
  username: string
  password?: string
  telegramChatId: string
  phoneNumber: string
  departmentIds: string[]
  roleIds: string[]
}

type SettingsUserInputResult =
  | { ok: true; value: SettingsUserUpdateInput }
  | { ok: false; error: "invalid-user" | "invalid-password" }

function parseIds(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) return null
  const ids = value.map((item) => typeof item === "string" ? item.trim() : "")
  if (ids.some((id) => !id || id.length > 128)) return null
  return [...new Set(ids)]
}

export function parseSettingsUserUpdateInput(value: unknown): SettingsUserInputResult {
  if (!value || typeof value !== "object") return { ok: false, error: "invalid-user" }
  const source = value as Record<string, unknown>
  const fullName = typeof source.fullName === "string" ? source.fullName.trim() : ""
  const positionId = typeof source.positionId === "string" ? source.positionId.trim() : ""
  const username = typeof source.username === "string" ? source.username.trim() : ""
  const password = typeof source.password === "string" ? source.password : ""
  const telegramChatId = typeof source.telegramChatId === "string" ? source.telegramChatId.trim() : ""
  const phoneNumber = typeof source.phoneNumber === "string" ? source.phoneNumber.trim() : ""
  const departmentIds = parseIds(source.departmentIds)
  const roleIds = parseIds(source.roleIds)

  if (
    !fullName || fullName.length > 160 ||
    !positionId || positionId.length > 128 ||
    !username || username.length > 100 ||
    telegramChatId.length > 100 || phoneNumber.length > 100 ||
    !departmentIds || !roleIds
  ) {
    return { ok: false, error: "invalid-user" }
  }

  if (password && (password.length < USER_PASSWORD_MIN_LENGTH || password.length > USER_PASSWORD_MAX_LENGTH)) {
    return { ok: false, error: "invalid-password" }
  }

  return {
    ok: true,
    value: {
      fullName,
      positionId,
      username,
      ...(password ? { password } : {}),
      telegramChatId,
      phoneNumber,
      departmentIds,
      roleIds,
    },
  }
}
