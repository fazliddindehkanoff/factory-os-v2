"use client"

import * as React from "react"
import { ArchiveIcon, MailIcon, PencilIcon, PhoneIcon, PlusIcon, SearchIcon } from "lucide-react"

import { AccessDenied } from "@/components/auth/access-denied"
import { useAuthorization } from "@/components/auth/use-authorization"
import { useProcurement } from "@/components/procurement/procurement-provider"
import { Badge } from "@/components/ui/badge"
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
  const { can } = useAuthorization()
  const { suppliers, quotations, archiveSupplier } = useProcurement()
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<SupplierStatus | "">("")
  const [editing, setEditing] = React.useState<SupplierRecord | "new" | null>(null)
  const [archiving, setArchiving] = React.useState<SupplierRecord | null>(null)

  if (!can("suppliers.view")) {
    return <AccessDenied lang={lang} permissions={["suppliers.view"]} />
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredSuppliers = suppliers.filter((supplier) => {
    const haystack = `${supplier.name} ${supplier.inn} ${supplier.phone} ${supplier.email} ${supplier.contactPerson} ${supplier.category}`.toLocaleLowerCase()
    return (!status || supplier.status === status) && (!normalizedQuery || haystack.includes(normalizedQuery))
  })

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col gap-5 px-4 pb-8 md:px-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{messages.suppliers}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{messages.suppliersDescription}</p>
        </div>
        {can("suppliers.manage") ? <Button className="w-full sm:w-auto" onClick={() => setEditing("new")}><PlusIcon />{messages.addSupplier}</Button> : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,32rem)_14rem]">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={messages.searchSuppliers} className="pl-8" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value as SupplierStatus | "")} aria-label={messages.allStatuses} className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <option value="">{messages.allStatuses}</option>
          <option value="active">{messages.active}</option>
          <option value="archived">{messages.archived}</option>
        </select>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.supplierName}</TableHead>
              <TableHead>{messages.taxId}</TableHead>
              <TableHead>{messages.contactPerson}</TableHead>
              <TableHead>{messages.category}</TableHead>
              <TableHead>{messages.supplierUsage}</TableHead>
              <TableHead>{messages.status}</TableHead>
              {can("suppliers.manage") ? <TableHead className="w-28 text-right">{messages.actions}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length === 0 ? <TableRow><TableCell colSpan={can("suppliers.manage") ? 7 : 6} className="h-28 text-center text-muted-foreground">{messages.noRecords}</TableCell></TableRow> : filteredSuppliers.map((supplier) => {
              const supplierQuotes = quotations.filter((quote) => quote.supplierId === supplier.id)
              const selectedCount = supplierQuotes.filter((quote) => quote.selected).length
              return (
                <TableRow key={supplier.id}>
                  <TableCell className="max-w-72 whitespace-normal">
                    <div className="font-medium">{supplier.name}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {supplier.phone ? <span className="inline-flex items-center gap-1"><PhoneIcon className="size-3" />{supplier.phone}</span> : null}
                      {supplier.email ? <span className="inline-flex items-center gap-1"><MailIcon className="size-3" />{supplier.email}</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{supplier.inn || "—"}</TableCell>
                  <TableCell>{supplier.contactPerson || "—"}</TableCell>
                  <TableCell>{supplier.category || "—"}</TableCell>
                  <TableCell><span className="font-mono tabular-nums">{supplierQuotes.length}</span><span className="text-muted-foreground"> / {selectedCount}</span></TableCell>
                  <TableCell><Badge variant={supplier.status === "active" ? "secondary" : "outline"}>{supplier.status === "active" ? messages.active : messages.archived}</Badge></TableCell>
                  {can("suppliers.manage") ? (
                    <TableCell>
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
      </div>

      {editing ? <SupplierDialog key={editing === "new" ? "new" : editing.id} supplier={editing === "new" ? undefined : editing} messages={messages} open onOpenChange={(open) => !open && setEditing(null)} /> : null}

      <Dialog open={Boolean(archiving)} onOpenChange={(open) => !open && setArchiving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{messages.archive}</DialogTitle><DialogDescription>{messages.archiveSupplierConfirmation}</DialogDescription></DialogHeader>
          {archiving ? <p className="rounded-lg bg-muted p-3 font-medium">{archiving.name}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiving(null)}>{messages.cancel}</Button>
            <Button variant="destructive" onClick={() => { if (archiving) archiveSupplier(archiving.id); setArchiving(null) }}><ArchiveIcon />{messages.archive}</Button>
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
    if (supplier) updateSupplier({ ...supplier, ...fields })
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
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>
}
