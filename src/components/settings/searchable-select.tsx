"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type SearchableSelectOption = {
  value: string
  label: string
  searchValue?: string
  details?: string[]
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  ariaLabel,
  disabled = false,
}: {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  ariaLabel: string
  disabled?: boolean
}) {
  const selected = options.find((option) => option.value === value)
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm font-normal shadow-xs outline-none transition-colors hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted/45 disabled:opacity-65"
      >
        <span className={cn("min-w-0 flex-1 text-left", !selected && "text-muted-foreground")}>
          <span className="block truncate font-medium">{selected?.label ?? placeholder}</span>
          {selected?.details?.length ? (
            <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
              {selected.details.join(" | ")}
            </span>
          ) : null}
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) max-w-[calc(100vw-2rem)] p-0">
        <Command
          filter={(itemValue, search, keywords = []) =>
            [itemValue, ...keywords]
              .join(" ")
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase())
              ? 1
              : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  keywords={option.searchValue ? [option.searchValue] : undefined}
                  className="items-start gap-3 py-3"
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <CheckIcon className={cn("mt-0.5 size-4 shrink-0", option.value === value ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-5 text-foreground">{option.label}</span>
                    {option.details?.length ? (
                      <span className="mt-1 block truncate text-xs leading-4 text-muted-foreground">
                        {option.details.join(" | ")}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
