import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

const PHOTO_DIRECTORY = path.join(process.cwd(), "data", "profile-photos")
const photoFormats = [
  { extension: "jpg", mimeType: "image/jpeg" },
  { extension: "png", mimeType: "image/png" },
  { extension: "webp", mimeType: "image/webp" },
  { extension: "gif", mimeType: "image/gif" },
] as const

function safeUserId(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_")
}

function photoPath(userId: string, extension: string) {
  return path.join(process.cwd(), "data", "profile-photos", `${safeUserId(userId)}.${extension}`)
}

function matchesSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value)
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  }
  if (mimeType === "image/gif") {
    const signature = new TextDecoder().decode(bytes.slice(0, 6))
    return signature === "GIF87a" || signature === "GIF89a"
  }
  return false
}

export async function readProfilePhoto(userId: string) {
  for (const format of photoFormats) {
    try {
      return {
        bytes: await readFile(photoPath(userId, format.extension)),
        mimeType: format.mimeType,
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }
  return null
}

export async function saveProfilePhoto(userId: string, file: File) {
  const format = photoFormats.find((item) => item.mimeType === file.type)
  if (!format || file.size === 0 || file.size > 5 * 1024 * 1024) return false

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!matchesSignature(bytes, format.mimeType)) return false

  await mkdir(PHOTO_DIRECTORY, { recursive: true, mode: 0o750 })
  const temporaryPath = path.join(PHOTO_DIRECTORY, `${safeUserId(userId)}-${randomUUID()}.tmp`)
  await writeFile(temporaryPath, bytes, { mode: 0o600 })
  await Promise.all(photoFormats.map(async (item) => {
    try {
      await unlink(photoPath(userId, item.extension))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
  }))
  await rename(temporaryPath, photoPath(userId, format.extension))
  return true
}
