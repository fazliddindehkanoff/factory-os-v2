"use client"
import * as React from "react"

export const DialogLayer = React.createContext({ id: "", depth: -1 })
/** Floating controls sit above their own dialog, below the next dialog. */
export function useFloatingLayer() {
  const { depth } = React.useContext(DialogLayer)
  return depth < 0 ? 50 : 52 + depth * 10
}

export const OverlayTheme = React.createContext<"light" | "dark" | undefined>(undefined)
export function useOverlayTheme() {
  const theme = React.useContext(OverlayTheme)
  return theme ? { className: "telegram-app", "data-theme": theme } : {}
}
