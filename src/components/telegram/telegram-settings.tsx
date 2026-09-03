"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AtSignIcon,
  CameraIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  Link2Icon,
  Link2OffIcon,
  LoaderCircleIcon,
  PhoneIcon,
  SaveIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { TelegramCopy } from "@/lib/telegram-copy"

type Feedback = { kind: "success" | "error"; text: string } | null

type EditableProfile = {
  fullName: string
  username: string
  phoneNumber: string
  telegramConnected: boolean
  roles: string[]
}

const inputClassName = "h-12 w-full rounded-[11px] border border-[#d7deea] bg-white px-3.5 text-[15px] text-[#1a1a2e] outline-none transition-[border-color,box-shadow] placeholder:text-[#a4adbb] focus:border-[#2d7dd2] focus:ring-3 focus:ring-[#2d7dd2]/15"

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
}

export function TelegramSettings({
  copy,
  initialProfile,
}: {
  copy: TelegramCopy
  initialProfile: EditableProfile
}) {
  const router = useRouter()
  const [profile, setProfile] = React.useState(initialProfile)
  const [connectedPhoneNumber, setConnectedPhoneNumber] = React.useState(initialProfile.phoneNumber)
  const [profileFeedback, setProfileFeedback] = React.useState<Feedback>(null)
  const [photoFeedback, setPhotoFeedback] = React.useState<Feedback>(null)
  const [passwordFeedback, setPasswordFeedback] = React.useState<Feedback>(null)
  const [savingProfile, setSavingProfile] = React.useState(false)
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false)
  const [changingPassword, setChangingPassword] = React.useState(false)
  const [disconnecting, setDisconnecting] = React.useState(false)
  const [avatarVersion, setAvatarVersion] = React.useState(0)

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingProfile(true)
    setProfileFeedback(null)
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: profile.fullName,
          username: profile.username,
          phoneNumber: profile.phoneNumber,
        }),
      })
      const result = await response.json() as {
        profile?: Pick<EditableProfile, "fullName" | "username" | "phoneNumber">
        error?: string
      }
      if (!response.ok || !result.profile) {
        const message = result.error === "username-exists"
          ? copy.usernameAlreadyExists
          : result.error === "phone-exists"
            ? copy.phoneAlreadyExists
            : result.error === "invalid-phone"
              ? copy.invalidPhone
              : copy.profileSaveFailed
        setProfileFeedback({ kind: "error", text: message })
        return
      }
      setProfile((current) => ({ ...current, ...result.profile }))
      setConnectedPhoneNumber(result.profile.phoneNumber)
      setProfileFeedback({ kind: "success", text: copy.profileSaved })
      router.refresh()
    } catch {
      setProfileFeedback({ kind: "error", text: copy.profileSaveFailed })
    } finally {
      setSavingProfile(false)
    }
  }

  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setPhotoFeedback(null)
    try {
      const formData = new FormData()
      formData.set("photo", file)
      const response = await fetch("/api/profile/photo", { method: "POST", body: formData })
      if (!response.ok) throw new Error("photo-upload-failed")
      setAvatarVersion((current) => current + 1)
      window.dispatchEvent(new Event("factory-os-profile-photo-updated"))
      setPhotoFeedback({ kind: "success", text: copy.photoUpdated })
    } catch {
      setPhotoFeedback({ kind: "error", text: copy.photoUploadFailed })
    } finally {
      setUploadingPhoto(false)
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
      setPasswordFeedback({ kind: "error", text: copy.passwordTooShort })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ kind: "error", text: copy.passwordMismatch })
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
            ? copy.currentPasswordIncorrect
            : copy.passwordChangeFailed,
        })
        return
      }
      form.reset()
      setPasswordFeedback({ kind: "success", text: copy.passwordChanged })
    } catch {
      setPasswordFeedback({ kind: "error", text: copy.passwordChangeFailed })
    } finally {
      setChangingPassword(false)
    }
  }

  async function confirmDisconnect() {
    const webApp = window.Telegram?.WebApp as ({
      initData: string
      showConfirm?: (message: string, callback: (confirmed: boolean) => void) => void
    }) | undefined
    if (webApp?.initData && webApp.showConfirm) {
      return new Promise<boolean>((resolve) => {
        try {
          webApp.showConfirm?.(copy.disconnectTelegramConfirm, resolve)
        } catch {
          resolve(window.confirm(copy.disconnectTelegramConfirm))
        }
      })
    }
    return window.confirm(copy.disconnectTelegramConfirm)
  }

  async function disconnectTelegram() {
    if (!await confirmDisconnect()) return
    setDisconnecting(true)
    setProfileFeedback(null)
    try {
      const response = await fetch("/api/profile/telegram", { method: "DELETE" })
      if (!response.ok) throw new Error("telegram-disconnect-failed")
      setProfile((current) => ({ ...current, telegramConnected: false }))
      setProfileFeedback({ kind: "success", text: copy.telegramDisconnected })
      router.refresh()
    } catch {
      setProfileFeedback({ kind: "error", text: copy.telegramDisconnectFailed })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-[14px] border border-[#e2e7ef] bg-white p-4 shadow-[0_1px_2px_rgba(16,30,60,0.05)]">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar className="size-[76px] rounded-[20px] text-xl">
              <AvatarImage className="rounded-[20px]" src={`/api/profile/photo?v=${avatarVersion}`} alt={profile.fullName} />
              <AvatarFallback className="rounded-[20px] bg-[#e7f1fb] font-bold text-[#2d7dd2]">{initials(profile.fullName)}</AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-[9px] border-2 border-white bg-[#2d7dd2] text-white">
              <CameraIcon className="size-3.5" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-[#1a1a2e]">{profile.fullName}</h2>
            <p className="mt-0.5 truncate text-xs text-[#6b7280]">@{profile.username}</p>
            <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-[#8b97aa]">
              {profile.roles.length ? profile.roles.join(" · ") : copy.employee}
            </p>
          </div>
        </div>
        <label className="mt-4 flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-[11px] border border-[#d7deea] bg-[#fbfcfe] px-4 text-[13px] font-bold text-[#344054] transition-colors active:bg-[#edf1f6]">
          {uploadingPhoto ? <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" /> : <CameraIcon className="size-4 text-[#2d7dd2]" />}
          {uploadingPhoto ? copy.uploadingPhoto : copy.choosePhoto}
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploadingPhoto}
            onChange={uploadPhoto}
          />
        </label>
        <p className="mt-2 text-[11px] leading-4 text-[#8b97aa]">{copy.photoHelp}</p>
        <FeedbackMessage feedback={photoFeedback} />
      </section>

      <SettingsCard icon={UserRoundIcon} title={copy.personalDetails} description={copy.personalDetailsHelp}>
        <form className="grid gap-3.5" onSubmit={saveProfile}>
          <Field icon={UserRoundIcon} label={copy.fullName} htmlFor="telegram-full-name">
            <input
              id="telegram-full-name"
              value={profile.fullName}
              onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))}
              autoComplete="name"
              maxLength={160}
              required
              className={inputClassName}
            />
          </Field>
          <Field icon={AtSignIcon} label={copy.username} htmlFor="telegram-username">
            <input
              id="telegram-username"
              value={profile.username}
              onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))}
              autoComplete="username"
              maxLength={100}
              required
              className={inputClassName}
            />
          </Field>
          <Field icon={PhoneIcon} label={copy.telegramPhone} htmlFor="telegram-phone">
            <input
              id="telegram-phone"
              value={profile.phoneNumber}
              onChange={(event) => setProfile((current) => ({ ...current, phoneNumber: event.target.value }))}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={100}
              required
              placeholder="+998 90 123 45 67"
              className={inputClassName}
            />
          </Field>
          <p className="-mt-1 text-[11px] leading-4 text-[#8b97aa]">{copy.telegramPhoneHelp}</p>
          <FeedbackMessage feedback={profileFeedback} />
          <button
            type="submit"
            disabled={savingProfile}
            className="flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-[11px] bg-[#2d7dd2] px-4 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(45,125,210,0.85)] transition-colors active:bg-[#246caf] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingProfile ? <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" /> : <SaveIcon className="size-4" />}
            {savingProfile ? copy.saving : copy.saveChanges}
          </button>
        </form>
      </SettingsCard>

      <SettingsCard icon={Link2Icon} title={copy.telegramConnection} description={copy.telegramConnectionHelp}>
        <div className={`flex items-center gap-3 rounded-[12px] border p-3.5 ${profile.telegramConnected ? "border-[#c9ead8] bg-[#effaf4]" : "border-[#e2e7ef] bg-[#f8fafc]"}`}>
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-[11px] ${profile.telegramConnected ? "bg-[#dff5e9] text-[#1fa363]" : "bg-[#edf1f6] text-[#7d899a]"}`}>
            {profile.telegramConnected ? <CheckCircle2Icon className="size-5" /> : <Link2OffIcon className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-[#1a1a2e]">{profile.telegramConnected ? copy.telegramConnected : copy.telegramNotConnected}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-[#6b7280]">{connectedPhoneNumber || "—"}</p>
          </div>
        </div>
        {!profile.telegramConnected ? <p className="mt-3 text-xs leading-5 text-[#6b7280]">{copy.relinkTelegram}</p> : null}
        {profile.telegramConnected ? (
          <button
            type="button"
            disabled={disconnecting}
            onClick={disconnectTelegram}
            className="mt-3 flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-[11px] border border-[#f1c8c3] bg-[#fff8f7] px-4 text-[13px] font-bold text-[#d44232] transition-colors active:bg-[#fbe8e5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {disconnecting ? <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" /> : <Link2OffIcon className="size-4" />}
            {copy.disconnectTelegram}
          </button>
        ) : null}
      </SettingsCard>

      <SettingsCard icon={ShieldCheckIcon} title={copy.security} description={copy.securityHelp}>
        <form className="grid gap-3.5" onSubmit={changePassword}>
          <input className="sr-only" tabIndex={-1} aria-hidden="true" name="username" autoComplete="username" value={profile.username} readOnly />
          <PasswordField id="telegram-current-password" name="currentPassword" label={copy.currentPassword} autoComplete="current-password" />
          <PasswordField id="telegram-new-password" name="newPassword" label={copy.newPassword} autoComplete="new-password" minLength={8} />
          <PasswordField id="telegram-confirm-password" name="confirmPassword" label={copy.confirmPassword} autoComplete="new-password" minLength={8} />
          <FeedbackMessage feedback={passwordFeedback} />
          <button
            type="submit"
            disabled={changingPassword}
            className="flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-[11px] bg-[#1a2b4a] px-4 text-sm font-bold text-white transition-colors active:bg-[#243b68] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {changingPassword ? <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" /> : <KeyRoundIcon className="size-4" />}
            {changingPassword ? copy.changingPassword : copy.changePassword}
          </button>
        </form>
      </SettingsCard>
    </div>
  )
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserRoundIcon
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[14px] border border-[#e2e7ef] bg-white p-4 shadow-[0_1px_2px_rgba(16,30,60,0.05)]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#e7f1fb] text-[#2d7dd2]">
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[#1a1a2e]">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-[#8b97aa]">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({
  icon: Icon,
  label,
  htmlFor,
  children,
}: {
  icon: typeof UserRoundIcon
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-xs font-bold text-[#4f5c70]">
        <Icon className="size-3.5 text-[#7e8ba0]" />
        {label}
      </label>
      {children}
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
    <Field icon={KeyRoundIcon} label={label} htmlFor={id}>
      <input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={128}
        required
        className={inputClassName}
      />
    </Field>
  )
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return (
    <p
      role={feedback.kind === "error" ? "alert" : "status"}
      className={`mt-2 text-xs font-medium leading-5 ${feedback.kind === "error" ? "text-[#d44232]" : "text-[#14814c]"}`}
    >
      {feedback.text}
    </p>
  )
}
