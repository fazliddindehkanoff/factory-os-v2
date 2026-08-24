"use client"

import { useActionState, useState } from "react"
import { EyeIcon, EyeOffIcon, FactoryIcon, LoaderCircleIcon } from "lucide-react"

import { loginAction, type LoginState } from "@/app/[lang]/login/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type LoginCopy = {
  title: string
  description: string
  username: string
  usernamePlaceholder: string
  password: string
  showPassword: string
  hidePassword: string
  submit: string
  submitting: string
  requiredError: string
  invalidError: string
  help: string
}

export function LoginForm({
  lang,
  returnTo,
  copy,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  lang: Locale
  returnTo?: string
  copy: LoginCopy
}) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {})
  const [showPassword, setShowPassword] = useState(false)
  const errorMessage = state.error === "required"
    ? copy.requiredError
    : state.error === "invalid"
      ? copy.invalidError
      : undefined

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex items-center gap-3 px-1">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <FactoryIcon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="font-heading text-base font-semibold tracking-tight">Factory OS</p>
          <p className="text-xs text-muted-foreground">Operations workspace</p>
        </div>
      </div>
      <Card className="shadow-lg shadow-foreground/5">
        <CardHeader className="gap-2 px-6 pt-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-2">
          <form action={action} noValidate>
            <input type="hidden" name="locale" value={lang} />
            <input type="hidden" name="returnTo" value={returnTo ?? ""} />
            <FieldGroup>
              <Field data-invalid={Boolean(errorMessage)}>
                <FieldLabel htmlFor="username">{copy.username}</FieldLabel>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={copy.usernamePlaceholder}
                  className="h-11 px-3"
                  aria-invalid={Boolean(errorMessage)}
                  required
                  autoFocus
                />
              </Field>
              <Field data-invalid={Boolean(errorMessage)}>
                <FieldLabel htmlFor="password">{copy.password}</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="h-11 px-3 pr-11"
                    aria-invalid={Boolean(errorMessage)}
                    aria-describedby={errorMessage ? "login-error" : undefined}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 size-11 rounded-l-none text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                    aria-pressed={showPassword}
                    title={showPassword ? copy.hidePassword : copy.showPassword}
                  >
                    {showPassword ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
                  </Button>
                </div>
                {errorMessage ? <FieldError id="login-error">{errorMessage}</FieldError> : null}
              </Field>
              <Field>
                <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
                  {pending ? <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                  {pending ? copy.submitting : copy.submit}
                </Button>
                <p className="text-center text-xs leading-relaxed text-muted-foreground">{copy.help}</p>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
