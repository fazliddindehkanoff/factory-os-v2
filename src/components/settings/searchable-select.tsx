"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"

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
  selectedLabel?: string
  searchValue?: string
  details?: string[]
}

type CreateFromSearchAction = {
  label: (query: string) => string
  onSelect: (query: string) => void
}

function optionMatchesSearch(option: SearchableSelectOption, search: string) {
  return [option.label, option.searchValue ?? ""]
    .join(" ")
    .toLocaleLowerCase()
    .includes(search.toLocaleLowerCase())
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
  createFromSearch,
}: {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  ariaLabel: string
  disabled?: boolean
  createFromSearch?: CreateFromSearchAction
}) {
  const selected = options.find((option) => option.value === value)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const normalizedSearch = search.trim()
  const canCreateFromSearch = Boolean(
    createFromSearch &&
      normalizedSearch &&
      !options.some((option) => optionMatchesSearch(option, normalizedSearch)),
  )

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm font-normal shadow-xs outline-none transition-colors hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted/45 disabled:opacity-65"
      >
        <span className={cn("min-w-0 flex-1 text-left", !selected && "text-muted-foreground")}>
          <span className="block truncate font-medium">
            {selected?.selectedLabel ?? selected?.label ?? placeholder}
          </span>
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
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {canCreateFromSearch && createFromSearch ? (
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  value={`create:${normalizedSearch}`}
                  className="gap-3 py-3 font-medium text-primary"
                  onSelect={() => {
                    createFromSearch.onSelect(normalizedSearch)
                    changeOpen(false)
                  }}
                >
                  <PlusIcon className="size-4" />
                  <span className="min-w-0 flex-1 truncate">
                    {createFromSearch.label(normalizedSearch)}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : (
              <>
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
                        changeOpen(false)
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
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
