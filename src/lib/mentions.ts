export function containsUserMention(body: string, username: string) {
  if (!username) return false
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|\\s)@${escaped}(?=\\s|[.,!?;:]|$)`, "iu").test(body)
}
