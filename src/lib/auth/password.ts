import { promisify } from "node:util"
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"

const scryptAsync = promisify(scrypt)
const HASH_BYTES = 64

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derivedKey = await scryptAsync(password, salt, HASH_BYTES) as Buffer
  return `scrypt:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, encodedSalt, encodedKey] = encodedHash.split(":")
  if (algorithm !== "scrypt" || !encodedSalt || !encodedKey) return false

  try {
    const salt = Buffer.from(encodedSalt, "base64url")
    const storedKey = Buffer.from(encodedKey, "base64url")
    const suppliedKey = await scryptAsync(password, salt, storedKey.length) as Buffer
    return storedKey.length === suppliedKey.length && timingSafeEqual(storedKey, suppliedKey)
  } catch {
    return false
  }
}
