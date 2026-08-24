"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

export type MultiSelectOption = { value: string; label: string }

export function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  selectedText,
  clearText,
  doneText,
  ariaLabel,
  disabled = false,
}: {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  selectedText: string
  clearText: string
  doneText: string
  ariaLabel: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selectedOptions = value
    .map((selectedValue) => options.find((option) => option.value === selectedValue))
    .filter((option): option is MultiSelectOption => Boolean(option))

  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm shadow-xs outline-none transition-colors hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted/45 disabled:opacity-65"
      >
        {selectedOptions.length === 0 ? (
          <span className="truncate text-muted-foreground">{placeholder}</span>
        ) : (
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {selectedOptions.slice(0, 2).map((option) => (
              <Badge key={option.value} variant="secondary" className="max-w-44">
                <span className="truncate">{option.label}</span>
              </Badge>
            ))}
            {selectedOptions.length > 2 ? (
              <Badge variant="outline">+{selectedOptions.length - 2}</Badge>
            ) : null}
          </span>
        )}
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) max-w-[calc(100vw-2rem)] gap-0 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const selected = value.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    data-checked={selected}
                    className="[&>svg:last-child]:hidden"
                    onSelect={() => toggle(option.value)}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                        selected && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {selected ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <span className="text-xs text-muted-foreground">
            {value.length} {selectedText}
          </span>
          <div className="flex items-center gap-1">
            {value.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
                {clearText}
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              {doneText}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
