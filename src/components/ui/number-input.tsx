"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { normalizeNumberDraft, numberDraftValue } from "@/lib/number-input"

type NumberInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: number
  onValueChange: (value: number) => void
}

/**
 * Numeric field backed by a text draft, so users can clear it and a leading 0
 * is replaced as soon as they type. External value changes (clamping, derived
 * fields) re-sync the draft.
 */
function NumberInput({ value, onValueChange, onFocus, ...props }: NumberInputProps) {
  const [draft, setDraft] = React.useState(() => String(value))
  const [syncedValue, setSyncedValue] = React.useState(value)
  if (value !== syncedValue) {
    setSyncedValue(value)
    if (numberDraftValue(draft) !== value) setDraft(String(value))
  }

  return (
    <Input
      {...props}
      type="number"
      value={draft}
      onFocus={(event) => {
        onFocus?.(event)
        if (numberDraftValue(event.currentTarget.value) === 0) event.currentTarget.select()
      }}
      onChange={(event) => {
        const next = normalizeNumberDraft(event.target.value)
        const nextValue = numberDraftValue(next)
        setDraft(next)
        setSyncedValue(nextValue)
        onValueChange(nextValue)
      }}
    />
  )
}

export { NumberInput }
