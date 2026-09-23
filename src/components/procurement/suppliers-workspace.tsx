"use client"

import * as React from "react"
import { ArchiveIcon, BadgeCheckIcon, CircleCheckBigIcon, FileTextIcon, MailIcon, PencilIcon, PhoneIcon, PlusIcon, SearchIcon, TruckIcon } from "lucide-react"

import { AccessDenied } from "@/components/auth/access-denied"
import { useAuthorization } from "@/components/auth/use-authorization"
import { useProcurement } from "@/components/procurement/procurement-provider"
import { avatarTone, initials } from "@/components/dashboard/dashboard-parts"
import { PageHeader, StatTile, Surface } from "@/components/page-header"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Locale, Messages } from "@/lib/i18n"
import type { SupplierRecord, SupplierStatus } from "@/lib/procurement"

export function SuppliersWorkspace({ lang, messages }: { lang: Locale; messages: Messages }) {
  const [archiveError, setArchiveError] = React.useState("")
  const { can } = useAuthorization()
  const { suppliers, quotations, archiveSupplier } = useProcurement()
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<SupplierStatus | "">("")
  const [editing, setEditing] = React.useState<SupplierRecord | "new" | null>(null)
  const [archivePending, setArchivePending] = React.useState(false)
  const [archiving, setArchiving] = React.useState<SupplierRecord | null>(null)

  if (!can("suppliers.view")) {
    return <AccessDenied lang={lang} permissions={["suppliers.view"]} />
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const activeCount = suppliers.filter((supplier) => supplier.status === "active").length
  const usageCopy = lang === "ru" ? { offers: "Предложений", selected: "Выбрано" } : lang === "tr" ? { offers: "Teklifler", selected: "Seçilen" } : { offers: "Takliflar", selected: "Tanlangan" }
  const filteredSuppliers = suppliers.filter((supplier) => {
    const haystack = `${supplier.name} ${supplier.inn} ${supplier.phone} ${supplier.email} ${supplier.contactPerson} ${supplier.category}`.toLocaleLowerCase()
    return (!status || supplier.status === status) && (!normalizedQuery || haystack.includes(normalizedQuery))
  })

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-5 px-4 pb-10 md:px-6">
      {archiveError ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{archiveError}</p> : null}
      <PageHeader
        icon={TruckIcon}
        title={messages.suppliers}
        description={messages.suppliersDescription}
        actions={can("suppliers.manage") ? <Button size="lg" className="w-full shadow-sm shadow-primary/20 sm:w-auto" onClick={() => setEditing("new")}><PlusIcon />{messages.addSupplier}</Button> : null}
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={messages.suppliers}>
        <StatTile label={messages.active} value={activeCount} icon={BadgeCheckIcon} tone="emerald" />
        <StatTile label={messages.archived} value={suppliers.length - activeCount} icon={ArchiveIcon} tone="default" />
        <StatTile label={usageCopy.offers} value={quotations.length} icon={FileTextIcon} tone="primary" />
        <StatTile label={usageCopy.selected} value={quotations.filter((quote) => quote.selected).length} icon={CircleCheckBigIcon} tone="sky" />
      </section>

      <Surface className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center md:p-4">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={messages.searchSuppliers} aria-label={messages.searchSuppliers} className="h-10 rounded-xl pl-9" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value as SupplierStatus | "")} aria-label={messages.allStatuses} className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-56">
            <option value="">{messages.allStatuses}</option>
            <option value="active">{messages.active}</option>
            <option value="archived">{messages.archived}</option>
          </select>
        </div>
        {filteredSuppliers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><TruckIcon className="size-7" aria-hidden="true" /></span>
            <p className="text-sm text-muted-foreground">{messages.noRecords}</p>
            {can("suppliers.manage") && !query && !status ? <Button variant="outline" onClick={() => setEditing("new")}><PlusIcon />{messages.addSupplier}</Button> : null}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">{messages.supplierName}</TableHead>
                <TableHead>{messages.taxId}</TableHead>
                <TableHead>{messages.contactPerson}</TableHead>
                <TableHead>{messages.category}</TableHead>
                <TableHead>{messages.supplierUsage}</TableHead>
                <TableHead>{messages.status}</TableHead>
                {can("suppliers.manage") ? <TableHead className="w-28 pr-4 text-right">{messages.actions}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => {
                const supplierQuotes = quotations.filter((quote) => quote.supplierId === supplier.id)
                const selectedCount = supplierQuotes.filter((quote) => quote.selected).length
                return (
                  <TableRow key={supplier.id} className={supplier.status === "archived" ? "opacity-60" : undefined}>
                    <TableCell className="max-w-80 whitespace-normal py-3 pl-4">
                      <div className="flex items-center gap-3">
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold", avatarTone(supplier.id))}>{initials(supplier.name)}</span>
                        <div className="min-w-0">
                          <div className="font-medium">{supplier.name}</div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {supplier.phone ? <span className="inline-flex items-center gap-1"><PhoneIcon className="size-3" />{supplier.phone}</span> : null}
                            {supplier.email ? <span className="inline-flex items-center gap-1"><MailIcon className="size-3" />{supplier.email}</span> : null}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{supplier.inn || "—"}</TableCell>
                    <TableCell>{supplier.contactPerson || "—"}</TableCell>
                    <TableCell>{supplier.category ? <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{supplier.category}</span> : "—"}</TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold tabular-nums">{supplierQuotes.length}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="font-mono tabular-nums text-emerald-700">{selectedCount}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", supplier.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground")}>
                        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                        {supplier.status === "active" ? messages.active : messages.archived}
                      </span>
                    </TableCell>
                    {can("suppliers.manage") ? (
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label={messages.edit} title={messages.edit} onClick={() => setEditing(supplier)}><PencilIcon /></Button>
                          {supplier.status === "active" ? <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={messages.archive} title={messages.archive} onClick={() => setArchiving(supplier)}><ArchiveIcon /></Button> : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Surface>

      {editing ? <SupplierDialog key={editing === "new" ? "new" : editing.id} supplier={editing === "new" ? undefined : editing} messages={messages} open onOpenChange={(open) => !open && setEditing(null)} /> : null}

      <Dialog open={Boolean(archiving)} onOpenChange={(open) => !open && setArchiving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>{archiveError ? <p role="alert" className="text-destructive">{archiveError}</p> : null}<DialogTitle>{messages.archive}</DialogTitle><DialogDescription>{messages.archiveSupplierConfirmation}</DialogDescription></DialogHeader>
          {archiving ? <p className="rounded-lg bg-muted p-3 font-medium">{archiving.name}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiving(null)}>{messages.cancel}</Button>
            <Button variant="destructive" disabled={archivePending} onClick={async () => { if (!archiving) return; setArchivePending(true); setArchiveError(""); try { await archiveSupplier(archiving.id); setArchiving(null) } catch { setArchiveError(messages.recordUpdateFailed) } finally { setArchivePending(false) } }}><ArchiveIcon />{messages.archive}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SupplierDialog({ supplier, messages, open, onOpenChange }: {
  supplier?: SupplierRecord
  messages: Messages
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { addSupplier, updateSupplier } = useProcurement()
  const [name, setName] = React.useState(supplier?.name ?? "")
  const [inn, setInn] = React.useState(supplier?.inn ?? "")
  const [phone, setPhone] = React.useState(supplier?.phone ?? "")
  const [email, setEmail] = React.useState(supplier?.email ?? "")
  const [contactPerson, setContactPerson] = React.useState(supplier?.contactPerson ?? "")
  const [category, setCategory] = React.useState(supplier?.category ?? "")
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  async function save() {
    if (!name.trim()) {
      setError(messages.requiredSupplierName)
      return
    }
    const fields = { name: name.trim(), inn: inn.trim(), phone: phone.trim(), email: email.trim(), contactPerson: contactPerson.trim(), category: category.trim() }
    setSaving(true)
    if (supplier) {
      try { await updateSupplier({ ...supplier, ...fields }) }
      catch { setError(messages.recordUpdateFailed); setSaving(false); return }
    }
    else if (!await addSupplier(fields)) {
      setError(messages.recordUpdateFailed)
      setSaving(false)
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{supplier ? messages.editSupplier : messages.newSupplier}</DialogTitle>
          <DialogDescription>{messages.suppliersDescription}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <SupplierField label={messages.supplierName} className="sm:col-span-2"><Input autoFocus value={name} onChange={(event) => { setName(event.target.value); setError("") }} aria-invalid={Boolean(error)} /></SupplierField>
          <SupplierField label={messages.taxId}><Input value={inn} onChange={(event) => setInn(event.target.value)} /></SupplierField>
          <SupplierField label={messages.category}><Input value={category} onChange={(event) => setCategory(event.target.value)} /></SupplierField>
          <SupplierField label={messages.contactPerson}><Input value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} /></SupplierField>
          <SupplierField label={messages.phoneNumber}><Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></SupplierField>
          <SupplierField label={messages.email} className="sm:col-span-2"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></SupplierField>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{messages.cancel}</Button>
          <Button onClick={save} disabled={saving}>{messages.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SupplierField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  const id = React.useId()
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label htmlFor={id}>{label}</Label>{React.isValidElement<{ id?: string }>(children) ? React.cloneElement(children, { id }) : children}</div>
}
