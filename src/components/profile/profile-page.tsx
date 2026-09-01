"use client"

import * as React from "react"
import { CameraIcon, KeyRoundIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react"

import { useAuthorization } from "@/components/auth/use-authorization"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Locale, Messages } from "@/lib/i18n"
import { getLocalizedTitle } from "@/lib/settings"
import { cn } from "@/lib/utils"

type Feedback = { kind: "success" | "error"; text: string } | null

export function ProfilePage({ lang, messages }: { lang: Locale; messages: Messages }) {
  const { currentUser, roles } = useAuthorization()
  const [avatarVersion, setAvatarVersion] = React.useState(0)
  const [uploading, setUploading] = React.useState(false)
  const [photoFeedback, setPhotoFeedback] = React.useState<Feedback>(null)
  const [changingPassword, setChangingPassword] = React.useState(false)
  const [passwordFeedback, setPasswordFeedback] = React.useState<Feedback>(null)
  const initials = (currentUser?.fullName ?? "Factory OS")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase()

  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setPhotoFeedback(null)
    try {
      const formData = new FormData()
      formData.set("photo", file)
      const response = await fetch("/api/profile/photo", { method: "POST", body: formData })
      if (!response.ok) throw new Error("upload-failed")
      setAvatarVersion((current) => current + 1)
      window.dispatchEvent(new Event("factory-os-profile-photo-updated"))
      setPhotoFeedback({ kind: "success", text: messages.photoUpdated })
    } catch {
      setPhotoFeedback({ kind: "error", text: messages.photoUploadFailed })
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const currentPassword = String(formData.get("currentPassword") ?? "")
    const newPassword = String(formData.get("newPassword") ?? "")
    const confirmPassword = String(formData.get("confirmPassword") ?? "")
    if (newPassword.length < 8) {
      setPasswordFeedback({ kind: "error", text: messages.passwordTooShort })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ kind: "error", text: messages.passwordMismatch })
      return
    }

    setChangingPassword(true)
    setPasswordFeedback(null)
    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) {
        setPasswordFeedback({
          kind: "error",
          text: result.error === "incorrect-current-password"
            ? messages.currentPasswordIncorrect
            : messages.passwordChangeFailed,
        })
        return
      }
      form.reset()
      setPasswordFeedback({ kind: "success", text: messages.passwordChanged })
    } catch {
      setPasswordFeedback({ kind: "error", text: messages.passwordChangeFailed })
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 pb-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:px-6">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CameraIcon className="size-4 text-primary" />
            {messages.profilePhoto}
          </CardTitle>
          <CardDescription>{messages.profilePhotoDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/25 p-6 text-center sm:flex-row sm:text-left">
            <Avatar className="size-24 text-2xl">
              <AvatarImage src={`/api/profile/photo?v=${avatarVersion}`} alt={currentUser?.fullName ?? messages.profile} />
              <AvatarFallback className="text-xl font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-base font-semibold">{currentUser?.fullName}</p>
              <p className="truncate text-sm text-muted-foreground">@{currentUser?.username}</p>
              <p className="text-sm text-muted-foreground">
                {roles.map((role) => getLocalizedTitle(role, lang)).join(", ")}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full cursor-pointer")}
            >
              {uploading ? <LoaderCircleIcon className="animate-spin" /> : <CameraIcon />}
              {uploading ? messages.uploadingPhoto : messages.choosePhoto}
              <input
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading}
                onChange={uploadPhoto}
              />
            </Label>
            <p className="text-xs text-muted-foreground">{messages.photoHelp}</p>
            <FeedbackMessage feedback={photoFeedback} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4 text-primary" />
            {messages.security}
          </CardTitle>
          <CardDescription>{messages.securityDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={changePassword}>
            <PasswordField
              id="current-password"
              name="currentPassword"
              label={messages.currentPassword}
              autoComplete="current-password"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField
                id="new-password"
                name="newPassword"
                label={messages.newPassword}
                autoComplete="new-password"
                minLength={8}
              />
              <PasswordField
                id="confirm-password"
                name="confirmPassword"
                label={messages.confirmNewPassword}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <FeedbackMessage feedback={passwordFeedback} />
            <Button type="submit" size="lg" disabled={changingPassword} className="w-full sm:w-auto">
              {changingPassword ? <LoaderCircleIcon className="animate-spin" /> : <KeyRoundIcon />}
              {changingPassword ? messages.changingPassword : messages.changePassword}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  minLength,
}: {
  id: string
  name: string
  label: string
  autoComplete: string
  minLength?: number
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={128}
        required
        className="h-10"
      />
    </div>
  )
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return (
    <p
      role={feedback.kind === "error" ? "alert" : "status"}
      className={cn(
        "text-sm",
        feedback.kind === "error" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
      )}
    >
      {feedback.text}
    </p>
  )
}
