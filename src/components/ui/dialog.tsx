"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { DialogLayer, useOverlayTheme } from "./overlay-layer"
import { Button } from "@/components/ui/button"
import { useParams } from "next/navigation"
import { ArrowLeftIcon, XIcon } from "lucide-react"

// One native dismissal must never close more than one layer, even after unmount.
const dismissedEvents = new WeakSet<Event>()
function Dialog({ onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  const parent = React.useContext(DialogLayer)
  const id = React.useId()
  const depth = parent.depth + 1
  return <DialogLayer.Provider value={{ id, depth }}><DialogPrimitive.Root data-slot="dialog" {...props}
    onOpenChange={(open, details) => {
      if (!open) {
        const layers = [...document.querySelectorAll<HTMLElement>('[data-dialog-layer][data-open]')]
        const top = layers.sort((a, b) => Number(a.dataset.dialogDepth) - Number(b.dataset.dialogDepth)).at(-1)
        if ((top && top.dataset.dialogLayer !== id) || dismissedEvents.has(details.event)) {
          details.cancel()
          return
        }
      }
      onOpenChange?.(open, details)
      if (!open && !details.isCanceled) dismissedEvents.add(details.event)
    }} /></DialogLayer.Provider>
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  const theme = useOverlayTheme()
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...theme} {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  const { depth } = React.useContext(DialogLayer)
  return (
    <DialogPrimitive.Backdrop
      style={{ zIndex: 50 + depth * 10 }}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  const { id, depth } = React.useContext(DialogLayer)
  const params = useParams()
  const lang = params.lang
  const back = lang === "ru" ? "Назад" : lang === "tr" ? "Geri" : "Ortga"
  const close = lang === "ru" ? "Закрыть" : lang === "tr" ? "Kapat" : "Yopish"
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-dialog-layer={id}
        data-dialog-depth={depth}
        style={{ zIndex: 51 + depth * 10 }}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {depth > 0 && showCloseButton ? <DialogPrimitive.Close render={<Button type="button" variant="ghost" size="sm" className="w-fit" />}><ArrowLeftIcon />{back}</DialogPrimitive.Close> : null}
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">{close}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
