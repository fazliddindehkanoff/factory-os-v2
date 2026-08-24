"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { AccessDenied } from "@/components/auth/access-denied";
import { useAuthorization } from "@/components/auth/use-authorization";
import { OrderProcurementPanel } from "@/components/orders/order-procurement-panel";
import { useOrders } from "@/components/orders/orders-provider";
import { useSettings } from "@/components/settings/settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Locale, Messages } from "@/lib/i18n";
import {
  canUserViewRejectedOrder,
  isOrderWaitingForUser,
  type OrderRecord,
  type OrderStatus,
  type UrgencyLevel,
} from "@/lib/orders";
import { getLocalizedTitle } from "@/lib/settings";

type Filters = {
  type: string;
  status: string;
  urgency: string;
  departmentId: string;
  warehouseId: string;
};

const initialFilters: Filters = {
  type: "",
  status: "",
  urgency: "",
  departmentId: "",
  warehouseId: "",
};

export function OrdersList({
  lang,
  messages,
}: {
  lang: Locale;
  messages: Messages;
}) {
  const {
    orders,
    deleteOrders,
    approveOrder,
    rejectOrder,
    submitWarehouseReport,
  } = useOrders();
  const { data } = useSettings();
  const { can, canViewOrders, currentUser } = useAuthorization();
  const searchParams = useSearchParams();
  const waitingOnly = searchParams.get("view") === "waiting";
  const copy = workflowCopy(lang);
  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState(initialFilters);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [detailOrderId, setDetailOrderId] = React.useState<string | null>(
    searchParams.get("order"),
  );
  const canCreate = can("requests.create");
  const canDelete = can("requests.edit");
  const ownOnly = !can("requests.view") && can("requests.view_own");
  const departmentScoped = currentUser?.roleIds.includes("role-dept_head") ?? false;
  const procurementSpecialistScoped = currentUser?.roleIds.includes("role-procurement_manager") ?? false;
  const normalizedQuery = query.trim().toLocaleLowerCase();

  function waitingForCurrentUser(order: OrderRecord) {
    const warehouseResponsibleUserId = data.warehouses.find(
      (warehouse) => warehouse.id === order.warehouseId,
    )?.responsibleUserId;
    return isOrderWaitingForUser(
      order,
      currentUser?.id,
      warehouseResponsibleUserId,
    );
  }

  function visibleAfterRejection(order: OrderRecord) {
    const applicant = data.users.find((user) => user.id === order.applicantId);
    const supervisorUserId = applicant?.roleIds.includes("role-dept_head")
      ? applicant.id
      : data.users.find(
          (user) =>
            user.roleIds.includes("role-dept_head") &&
            user.departmentIds.some((id) => order.departmentIds.includes(id)),
        )?.id;
    return canUserViewRejectedOrder(order, currentUser?.id, supervisorUserId);
  }

  const filteredOrders = orders.filter((order) => {
    const applicant = data.users.find((user) => user.id === order.applicantId);
    const productSearch = order.lines
      .map((line) =>
        data.products.find((product) => product.id === line.productId),
      )
      .filter(Boolean)
      .map(
        (product) =>
          `${product?.code} ${product?.titleUz} ${product?.titleRu} ${product?.titleTr}`,
      )
      .join(" ");
    const searchText =
      `${order.number} ${applicant?.fullName ?? ""} ${productSearch}`.toLocaleLowerCase();

    return (
      (!waitingOnly || waitingForCurrentUser(order)) &&
      (!ownOnly || order.createdByUserId === currentUser?.id) &&
      (!departmentScoped || order.departmentIds.some((id) => currentUser?.departmentIds.includes(id))) &&
      (!procurementSpecialistScoped || order.procurementSpecialistUserId === currentUser?.id) &&
      visibleAfterRejection(order) &&
      (!normalizedQuery || searchText.includes(normalizedQuery)) &&
      (!filters.type || order.type === filters.type) &&
      (!filters.status || order.status === filters.status) &&
      (!filters.urgency || order.urgency === filters.urgency) &&
      (!filters.departmentId ||
        order.departmentIds.includes(filters.departmentId)) &&
      (!filters.warehouseId || order.warehouseId === filters.warehouseId)
    );
  });
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageOrders = filteredOrders.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const pageIds = pageOrders.map((order) => order.id);
  const pageIdKey = pageIds.join("\u0000");
  const validSelectedIds = new Set(
    [...selectedIds].filter((id) =>
      filteredOrders.some((order) => order.id === id),
    ),
  );
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => validSelectedIds.has(id));
  const partiallySelected =
    pageIds.some((id) => validSelectedIds.has(id)) && !allPageSelected;
  const hasFilters = Object.values(filters).some(Boolean);
  const detailOrder = filteredOrders.find((order) => order.id === detailOrderId);

  React.useEffect(() => {
    const ids = pageIdKey;
    function selectPage(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "a" &&
        !target?.matches("input, textarea, select, [contenteditable='true']")
      ) {
        event.preventDefault();
        setSelectedIds(
          (current) =>
            new Set([...current, ...(ids ? ids.split("\u0000") : [])]),
        );
      }
    }
    window.addEventListener("keydown", selectPage);
    return () => window.removeEventListener("keydown", selectPage);
  }, [pageIdKey]);

  if (!canViewOrders) {
    return (
      <AccessDenied
        lang={lang}
        permissions={["requests.view", "requests.view_own"]}
      />
    );
  }

  function togglePage(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      pageIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function toggleOrder(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setSelectedIds(new Set());
  }

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col gap-4 px-4 pb-8 md:px-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {messages.orderList}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {messages.orderListDescription}
          </p>
        </div>
        {canCreate ? (
          <Link
            href={`/${lang}/orders/new`}
            className={buttonVariants({ className: "w-full sm:w-auto" })}
          >
            <PlusIcon />
            {messages.newOrder}
          </Link>
        ) : null}
      </div>

      <nav
        aria-label={copy.queueLabel}
        className="flex w-fit rounded-lg border bg-background p-1"
      >
        <Link
          href={`/${lang}/orders`}
          aria-current={!waitingOnly ? "page" : undefined}
          className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary/10 aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
        >
          {copy.allOrders}
        </Link>
        <Link
          href={`/${lang}/orders?view=waiting`}
          aria-current={waitingOnly ? "page" : undefined}
          className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary/10 aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
        >
          {copy.waitingForMe} (
          {
            orders.filter(waitingForCurrentUser)
              .length
          }
          )
        </Link>
      </nav>

      <div className="relative max-w-lg">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder={messages.searchOrders}
          className="pl-8"
        />
      </div>

      <div className="space-y-2 rounded-xl bg-muted/45 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FilterIcon className="size-4" />
            {messages.filters}
          </div>
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(initialFilters);
                setPage(1);
              }}
            >
              <XIcon />
              {messages.clearFilters}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <OrderFilter
            label={messages.orderType}
            value={filters.type}
            onChange={(value) => updateFilter("type", value)}
            messages={messages}
            options={[
              { value: "material", label: messages.material },
              { value: "service", label: messages.service },
            ]}
          />
          <OrderFilter
            label={messages.orderStatus}
            value={filters.status}
            onChange={(value) => updateFilter("status", value)}
            messages={messages}
            options={statusOptions(messages, lang)}
          />
          <OrderFilter
            label={messages.urgency}
            value={filters.urgency}
            onChange={(value) => updateFilter("urgency", value)}
            messages={messages}
            options={urgencyOptions(messages)}
          />
          <OrderFilter
            label={messages.departmentsField}
            value={filters.departmentId}
            onChange={(value) => updateFilter("departmentId", value)}
            messages={messages}
            options={data.departments.map((item) => ({
              value: item.id,
              label: getLocalizedTitle(item, lang),
            }))}
          />
          <OrderFilter
            label={messages.warehouse}
            value={filters.warehouseId}
            onChange={(value) => updateFilter("warehouseId", value)}
            messages={messages}
            options={data.warehouses.map((item) => ({
              value: item.id,
              label: getLocalizedTitle(item, lang),
            }))}
          />
        </div>
      </div>

      {validSelectedIds.size === 0 ? (
        <p className="text-xs text-muted-foreground">
          {messages.selectionShortcut}
        </p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allPageSelected}
                indeterminate={partiallySelected}
                onCheckedChange={(checked) => togglePage(checked === true)}
                aria-label={messages.selectAllPage}
              />
            </TableHead>
            <TableHead>{messages.orderNumber}</TableHead>
            <TableHead>{messages.orderType}</TableHead>
            <TableHead>{messages.applicant}</TableHead>
            <TableHead>{messages.departmentsField}</TableHead>
            <TableHead>{messages.warehouse}</TableHead>
            <TableHead>{messages.positionsCount}</TableHead>
            <TableHead>{messages.expectedDate}</TableHead>
            <TableHead>{messages.urgency}</TableHead>
            <TableHead>{messages.orderStatus}</TableHead>
            <TableHead>{messages.createdAt}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageOrders.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={11}
                className="h-28 text-center text-muted-foreground"
              >
                {waitingOnly ? copy.noWaiting : messages.noRecords}
              </TableCell>
            </TableRow>
          ) : (
            pageOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                lang={lang}
                messages={messages}
                selected={validSelectedIds.has(order.id)}
                onToggle={toggleOrder}
                onOpen={() => setDetailOrderId(order.id)}
                data={data}
              />
            ))
          )}
        </TableBody>
      </Table>

      {validSelectedIds.size > 0 ? (
        <div
          role="toolbar"
          aria-label={messages.bulkActions}
          className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border bg-popover p-1.5 shadow-lg"
        >
          <span className="px-2 text-sm font-medium">
            {validSelectedIds.size} {messages.selectedRows}
          </span>
          {canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2Icon />
              {messages.delete}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={messages.cancel}
            onClick={() => setSelectedIds(new Set())}
          >
            <XIcon />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {messages.rowsPerPage}
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-8 rounded-lg border border-input bg-background px-2 text-foreground"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {safePage} {messages.pageOf} {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
          >
            {messages.previousPage}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === pageCount}
            onClick={() => setPage(Math.min(pageCount, safePage + 1))}
          >
            {messages.nextPage}
          </Button>
        </div>
      </div>

      {detailOrder ? (
        <OrderDetailsDialog
          key={detailOrder.id}
          order={detailOrder}
          lang={lang}
          messages={messages}
          data={data}
          isCurrentAssignee={waitingForCurrentUser(detailOrder)}
          canApprove={can("approvals.approve")}
          canReject={can("approvals.reject")}
          canWarehouseReport={can("warehouse.check_stock")}
          canRevise={
            detailOrder.status === "rejected" &&
            detailOrder.createdByUserId === currentUser?.id
          }
          open
          onOpenChange={(open) => {
            if (!open) setDetailOrderId(null);
          }}
          onApprove={(id) => {
            approveOrder(id);
            setDetailOrderId(null);
          }}
          onReject={(id) => {
            rejectOrder(id);
            setDetailOrderId(null);
          }}
          onWarehouseReport={(id, quantities) => {
            submitWarehouseReport(id, quantities);
            setDetailOrderId(null);
          }}
        />
      ) : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{messages.deleteOrders}</DialogTitle>
            <DialogDescription>
              {messages.deleteOrdersConfirmation}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              {messages.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteOrders([...validSelectedIds]);
                setSelectedIds(new Set());
                setConfirmDelete(false);
              }}
            >
              <Trash2Icon />
              {messages.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderRow({
  order,
  lang,
  messages,
  selected,
  onToggle,
  onOpen,
  data,
}: {
  order: OrderRecord;
  lang: Locale;
  messages: Messages;
  selected: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onOpen: () => void;
  data: ReturnType<typeof useSettings>["data"];
}) {
  const applicant = data.users.find((user) => user.id === order.applicantId);
  const warehouse = data.warehouses.find(
    (item) => item.id === order.warehouseId,
  );
  const departments = order.departmentIds
    .map((id) => data.departments.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => (item ? getLocalizedTitle(item, lang) : ""))
    .join(", ");
  const fulfilledLines = order.lines.filter(
    (line) => line.fulfillmentStatus === "fulfilled_from_stock",
  ).length;
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      tabIndex={0}
      aria-label={`${workflowCopy(lang).openDetails}: ${order.number}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <TableCell
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onToggle(order.id, checked === true)}
          aria-label={`${messages.selectOption}: ${order.number}`}
        />
      </TableCell>
      <TableCell className="font-medium">{order.number}</TableCell>
      <TableCell>
        {order.type === "material" ? messages.material : messages.service}
      </TableCell>
      <TableCell>{applicant?.fullName ?? "—"}</TableCell>
      <TableCell>{departments || "—"}</TableCell>
      <TableCell>
        {warehouse ? getLocalizedTitle(warehouse, lang) : "—"}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span>{order.lines.length}</span>
          {fulfilledLines ? (
            <Badge
              variant="outline"
              className="w-fit border-primary/30 bg-primary/5 text-[10px] text-primary"
            >
              {fulfilledLines} {workflowCopy(lang).fulfilledShort}
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell>{formatDate(order.expectedDate)}</TableCell>
      <TableCell>
        <UrgencyBadge urgency={order.urgency} messages={messages} />
      </TableCell>
      <TableCell>
        <StatusBadge status={order.status} messages={messages} lang={lang} />
      </TableCell>
      <TableCell>{formatDate(order.createdAt.slice(0, 10))}</TableCell>
    </TableRow>
  );
}

function OrderDetailsDialog({
  order,
  lang,
  messages,
  data,
  isCurrentAssignee,
  canApprove,
  canReject,
  canWarehouseReport,
  canRevise,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onWarehouseReport,
}: {
  order: OrderRecord;
  lang: Locale;
  messages: Messages;
  data: ReturnType<typeof useSettings>["data"];
  isCurrentAssignee: boolean;
  canApprove: boolean;
  canReject: boolean;
  canWarehouseReport: boolean;
  canRevise: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onWarehouseReport: (id: string, quantities: Record<string, number>) => void;
}) {
  const copy = workflowCopy(lang);
  const [quantities, setQuantities] = React.useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        order.lines.map((line) => [line.id, line.availableQuantity ?? 0]),
      ),
  );
  const applicant = data.users.find((user) => user.id === order.applicantId);
  const creator = data.users.find((user) => user.id === order.createdByUserId);
  const waitingFor = data.users.find(
    (user) => user.id === order.waitingForUserId,
  );
  const warehouse = data.warehouses.find(
    (item) => item.id === order.warehouseId,
  );
  const purpose = data["order-purposes"].find(
    (item) => item.id === order.purposeId,
  );
  const departments = order.departmentIds
    .map((id) => data.departments.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => (item ? getLocalizedTitle(item, lang) : ""))
    .join(", ");
  const branches = order.branchIds
    .map((id) => data.branches.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => (item ? getLocalizedTitle(item, lang) : ""))
    .join(", ");
  const isWarehouseAction = isCurrentAssignee && canWarehouseReport && order.currentStep === "warehouse";
  const isProcurementAction = isCurrentAssignee && [
    "procurement_accept",
    "sourcing",
    "price_check",
  ].includes(order.currentStep);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] min-w-0 max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto p-4 sm:max-h-[calc(100svh-2rem)] sm:w-full sm:max-w-4xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle>{order.number}</DialogTitle>
            <StatusBadge
              status={order.status}
              messages={messages}
              lang={lang}
            />
            <UrgencyBadge urgency={order.urgency} messages={messages} />
          </div>
          <DialogDescription>{copy.detailsDescription}</DialogDescription>
        </DialogHeader>

        <section aria-labelledby="order-context" className="space-y-3">
          <h3 id="order-context" className="text-sm font-semibold">
            {messages.generalInformation}
          </h3>
          <div className="grid gap-x-6 gap-y-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField
              label={messages.applicant}
              value={applicant?.fullName}
            />
            <DetailField label={copy.createdBy} value={creator?.fullName} />
            <DetailField
              label={messages.orderType}
              value={
                order.type === "material" ? messages.material : messages.service
              }
            />
            <DetailField
              label={messages.departmentsField}
              value={departments}
            />
            <DetailField label={messages.branchesField} value={branches} />
            <DetailField
              label={messages.warehouse}
              value={warehouse ? getLocalizedTitle(warehouse, lang) : undefined}
            />
            <DetailField
              label={messages.purpose}
              value={purpose ? getLocalizedTitle(purpose, lang) : undefined}
            />
            <DetailField
              label={messages.expectedDate}
              value={formatDate(order.expectedDate)}
            />
            <DetailField
              label={messages.createdAt}
              value={formatDate(order.createdAt.slice(0, 10))}
            />
            <DetailField
              label={copy.workflowStep}
              value={stepLabel(order.currentStep, lang)}
            />
            <DetailField
              label={copy.waitingFor}
              value={waitingFor?.fullName ?? copy.completed}
            />
          </div>
        </section>

        <WorkflowTimeline order={order} data={data} lang={lang} />

        <section aria-labelledby="order-lines" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="order-lines" className="text-sm font-semibold">
              {messages.orderPositions}
            </h3>
            <span className="text-xs text-muted-foreground">
              {order.lines.length} {messages.positionsCount.toLocaleLowerCase()}
            </span>
          </div>
          <div className="space-y-3">
            {order.lines.map((line, index) => {
              const product = data.products.find(
                (item) => item.id === line.productId,
              );
              const unit = data["unit-types"].find(
                (item) => item.id === product?.unitTypeId,
              );
              const available = line.availableQuantity ?? 0;
              const remaining = Math.max(0, line.quantity - available);
              return (
                <article key={line.id} className="rounded-xl border p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {index + 1}.{" "}
                        {product
                          ? getLocalizedTitle(product, lang)
                          : line.productId}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product?.code ?? "—"}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {fulfillmentLabel(line.fulfillmentStatus, lang)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <DetailField
                      label={copy.requested}
                      value={`${line.quantity} ${unit?.code ?? ""}`.trim()}
                    />
                    <DetailField
                      label={copy.available}
                      value={`${available} ${unit?.code ?? ""}`.trim()}
                    />
                    <DetailField
                      label={copy.remaining}
                      value={`${remaining} ${unit?.code ?? ""}`.trim()}
                    />
                  </div>
                  {line.note ? (
                    <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                      <span className="font-medium">{messages.note}: </span>
                      {line.note}
                    </p>
                  ) : null}
                  {isWarehouseAction ? (
                    <label className="mt-3 grid max-w-56 gap-1 text-xs font-medium">
                      {copy.available}
                      <Input
                        type="number"
                        min="0"
                        max={line.quantity}
                        step="any"
                        value={quantities[line.id] ?? 0}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [line.id]: Math.min(
                              line.quantity,
                              Math.max(0, Number(event.target.value)),
                            ),
                          }))
                        }
                      />
                    </label>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">{messages.comment}</h3>
            <p className="mt-2 whitespace-pre-wrap rounded-xl border bg-muted/20 p-3 text-sm">
              {order.comment || "—"}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">{messages.attachments}</h3>
            <ul className="mt-2 space-y-1 rounded-xl border bg-muted/20 p-3 text-sm">
              {order.attachmentNames.length ? (
                order.attachmentNames.map((name) => (
                  <li key={name} className="break-all">
                    {name}
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">—</li>
              )}
            </ul>
          </div>
        </section>

        {order.lines.some((line) => line.fulfillmentStatus === "needs_procurement") &&
        ["procurement_accept", "sourcing", "price_check", "director", "complete"].includes(order.currentStep) ? (
          <OrderProcurementPanel order={order} lang={lang} messages={messages} />
        ) : null}

        {isWarehouseAction ? (
          <p className="rounded-lg bg-primary/5 p-3 text-sm text-foreground">
            {copy.warehouseHelp}
          </p>
        ) : null}

        <DialogFooter className="sticky -bottom-4 z-10 bg-background/95 backdrop-blur">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.close}
          </Button>
          {canRevise ? (
            <Link
              href={`/${lang}/orders/new?revise=${encodeURIComponent(order.id)}`}
              className={buttonVariants()}
            >
              {copy.editAndResend}
            </Link>
          ) : null}
          {isCurrentAssignee && !isWarehouseAction && !isProcurementAction ? (
            <>
              {canReject ? (
                <Button variant="destructive" onClick={() => onReject(order.id)}>
                  {copy.reject}
                </Button>
              ) : null}
              {canApprove ? (
                <Button onClick={() => onApprove(order.id)}>
                  {copy.approve}
                </Button>
              ) : null}
            </>
          ) : null}
          {isWarehouseAction ? (
            <Button onClick={() => onWarehouseReport(order.id, quantities)}>
              {copy.submitReport}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function WorkflowTimeline({
  order,
  data,
  lang,
}: {
  order: OrderRecord;
  data: ReturnType<typeof useSettings>["data"];
  lang: Locale;
}) {
  const copy = workflowCopy(lang);
  const steps: Exclude<OrderRecord["currentStep"], "complete">[] = [
    "department_supervisor",
    "warehouse",
    "chief_engineer",
    "procurement_accept",
    "sourcing",
    "price_check",
    "director",
  ];
  const creator = data.users.find((user) => user.id === order.createdByUserId);
  const currentIndex = steps.findIndex((step) => step === order.currentStep);
  const rejectedIndex = order.status === "rejected"
    ? Math.max(0, steps.findIndex((step) => workflowAssignee(step, order, data)?.id === order.lastActorUserId))
    : -1;
  const supervisorId = workflowAssignee("department_supervisor", order, data)?.id;
  const supervisorWasSkipped = order.createdByUserId === supervisorId;

  const items = [
    {
      id: "created",
      title: copy.requestCreated,
      subtitle: `${creator?.fullName ?? order.createdByUserId} · ${formatDate(order.createdAt.slice(0, 10))}`,
      state: "completed" as const,
    },
    ...steps.map((step, index) => {
      let state: "completed" | "current" | "pending" | "rejected" | "skipped" = "pending";
      if (order.status === "approved") state = "completed";
      else if (order.status === "fulfilled") state = index <= steps.indexOf("warehouse") ? "completed" : "skipped";
      else if (order.status === "rejected") state = index < rejectedIndex ? "completed" : index === rejectedIndex ? "rejected" : "skipped";
      else if (index < currentIndex) state = "completed";
      else if (index === currentIndex) state = "current";

      const assignee = workflowAssignee(step, order, data);
      const isAutomatic = step === "department_supervisor" && supervisorWasSkipped;
      if (isAutomatic && state === "completed") state = "skipped";
      return {
        id: step,
        title: stepLabel(step, lang),
        subtitle: assignee?.fullName ?? copy.unassigned,
        state,
        isAutomatic,
      };
    }),
  ];

  return (
    <section aria-labelledby="workflow-progress" className="min-w-0 space-y-3">
      <h3 id="workflow-progress" className="text-sm font-semibold">
        {copy.workflowProgress}
      </h3>
      <ol className="rounded-xl border bg-muted/20 p-4">
        {items.map((item, index) => {
          const stateLabel = item.state === "completed"
            ? ("isAutomatic" in item && item.isAutomatic ? copy.automaticStep : copy.completedStep)
            : item.state === "current"
              ? copy.currentStepLabel
              : item.state === "rejected"
                ? copy.rejectedStep
                : item.state === "skipped"
                  ? ("isAutomatic" in item && item.isAutomatic ? copy.automaticStep : copy.notRequired)
                  : copy.pendingStep;
          return (
            <li key={item.id} className="relative flex min-w-0 gap-3 pb-5 last:pb-0">
              {index < items.length - 1 ? (
                <span aria-hidden="true" className="absolute left-[9px] top-5 h-[calc(100%-0.25rem)] w-px bg-border" />
              ) : null}
              <span
                aria-hidden="true"
                className={item.state === "completed"
                  ? "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
                  : item.state === "current"
                    ? "relative z-10 size-5 shrink-0 rounded-full border-2 border-primary bg-background ring-4 ring-primary/10"
                    : item.state === "rejected"
                      ? "relative z-10 size-5 shrink-0 rounded-full border-4 border-destructive bg-background"
                      : "relative z-10 size-5 shrink-0 rounded-full border-2 border-muted-foreground/60 bg-background"}
              >
                {item.state === "completed" ? <CheckIcon className="size-3" /> : null}
              </span>
              <div className="min-w-0 flex-1 -mt-0.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="break-words text-sm font-medium">{item.title}</p>
                  <span className="text-xs text-muted-foreground">{stateLabel}</span>
                </div>
                <p className="mt-1 break-words text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function workflowAssignee(
  step: Exclude<OrderRecord["currentStep"], "complete">,
  order: Pick<OrderRecord, "departmentIds" | "warehouseId" | "procurementSpecialistUserId">,
  data: ReturnType<typeof useSettings>["data"],
) {
  if (step === "department_supervisor") {
    return data.users.find(
      (user) =>
        user.roleIds.includes("role-dept_head") &&
        user.departmentIds.some((id) => order.departmentIds.includes(id)),
    );
  }
  if (step === "warehouse") {
    const responsibleId = data.warehouses.find(
      (warehouse) => warehouse.id === order.warehouseId,
    )?.responsibleUserId;
    return data.users.find((user) => user.id === responsibleId);
  }
  if (step === "sourcing" && order.procurementSpecialistUserId) {
    return data.users.find((user) => user.id === order.procurementSpecialistUserId);
  }
  const roleByStep = {
    chief_engineer: "role-deputy_director",
    procurement_accept: "role-procurement_head",
    sourcing: "role-procurement_manager",
    price_check: "role-procurement_head",
    director: "role-director",
  } as const;
  return data.users.find((user) => user.roleIds.includes(roleByStep[step]));
}

function OrderFilter({
  label,
  value,
  onChange,
  options,
  messages,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  messages: Messages;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm font-normal text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">{messages.allOptions}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function statusOptions(messages: Messages, lang: Locale) {
  const copy = workflowCopy(lang);
  return [
    { value: "supervisor_review", label: copy.supervisorReview },
    { value: "warehouse_check", label: messages.statusWarehouseCheck },
    { value: "in_progress", label: copy.inProgress },
    { value: "fulfilled", label: copy.fulfilled },
    { value: "approved", label: messages.statusApproved },
    { value: "rejected", label: messages.statusRejected },
    { value: "draft", label: messages.statusDraft },
  ];
}
function urgencyOptions(messages: Messages) {
  return [
    { value: "normal", label: messages.urgencyNormal },
    { value: "high", label: messages.urgencyHigh },
    { value: "urgent", label: messages.urgencyUrgent },
    { value: "critical", label: messages.urgencyCritical },
  ];
}
function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}
function StatusBadge({
  status,
  messages,
  lang,
}: {
  status: OrderStatus;
  messages: Messages;
  lang: Locale;
}) {
  const copy = workflowCopy(lang);
  const labels: Record<OrderStatus, string> = {
    supervisor_review: copy.supervisorReview,
    warehouse_check: messages.statusWarehouseCheck,
    in_progress: copy.inProgress,
    fulfilled: copy.fulfilled,
    approved: messages.statusApproved,
    rejected: messages.statusRejected,
    draft: messages.statusDraft,
  };
  const variant =
    status === "rejected"
      ? "destructive"
      : status === "approved" || status === "fulfilled"
        ? "default"
        : status === "draft"
          ? "outline"
          : "secondary";
  return <Badge variant={variant}>{labels[status]}</Badge>;
}
function UrgencyBadge({
  urgency,
  messages,
}: {
  urgency: UrgencyLevel;
  messages: Messages;
}) {
  const labels = {
    normal: messages.urgencyNormal,
    high: messages.urgencyHigh,
    urgent: messages.urgencyUrgent,
    critical: messages.urgencyCritical,
  };
  const variants = {
    normal: "secondary",
    high: "outline",
    urgent: "default",
    critical: "destructive",
  } as const;
  return <Badge variant={variants[urgency]}>{labels[urgency]}</Badge>;
}

function stepLabel(step: OrderRecord["currentStep"], lang: Locale) {
  const labels = {
    uz: {
      department_supervisor: "Bo‘lim rahbari",
      warehouse: "Ombor nazorati",
      chief_engineer: "Bosh muhandis",
      procurement_accept: "Ta’minot rahbari — qabul qilish",
      sourcing: "Ta’minotchi — qidiruv",
      price_check: "Ta’minot rahbari — narx tekshiruvi",
      director: "Direktor",
      complete: "Yakunlangan",
    },
    ru: {
      department_supervisor: "Руководитель отдела",
      warehouse: "Контроль склада",
      chief_engineer: "Главный инженер",
      procurement_accept: "Руководитель снабжения — приём заявки",
      sourcing: "Снабженец — поиск",
      price_check: "Руководитель снабжения — проверка цены",
      director: "Директор",
      complete: "Завершено",
    },
    tr: {
      department_supervisor: "Bölüm yöneticisi",
      warehouse: "Depo kontrolü",
      chief_engineer: "Baş mühendis",
      procurement_accept: "Satın alma yöneticisi — talep kabulü",
      sourcing: "Satın almacı — tedarik araması",
      price_check: "Satın alma yöneticisi — fiyat kontrolü",
      director: "Direktör",
      complete: "Tamamlandı",
    },
  } as const;
  return labels[lang][step];
}

function fulfillmentLabel(
  status: OrderRecord["lines"][number]["fulfillmentStatus"],
  lang: Locale,
) {
  const labels = {
    uz: {
      pending: "Tekshirilmagan",
      fulfilled_from_stock: "Ombordan ta’minlandi",
      needs_procurement: "Xarid talab etiladi",
    },
    ru: {
      pending: "Не проверено",
      fulfilled_from_stock: "Выдано со склада",
      needs_procurement: "Требуется закупка",
    },
    tr: {
      pending: "Kontrol edilmedi",
      fulfilled_from_stock: "Depodan karşılandı",
      needs_procurement: "Satın alma gerekli",
    },
  } as const;
  return labels[lang][status ?? "pending"];
}

function detailCopy(lang: Locale) {
  if (lang === "ru")
    return {
      openDetails: "Открыть заявку",
      detailsDescription:
        "Полная информация о заявке и текущем этапе согласования.",
      createdBy: "Создал заявку",
      workflowStep: "Текущий этап",
      waitingFor: "Ожидает действия",
      completed: "Процесс завершён",
      remaining: "Осталось закупить",
      close: "Закрыть",
      workflowProgress: "Ход согласования",
      requestCreated: "Создание заявки",
      completedStep: "Завершено",
      currentStepLabel: "Текущий этап",
      pendingStep: "Ожидает",
      rejectedStep: "Отклонено здесь",
      automaticStep: "Пропущено автоматически",
      notRequired: "Не требуется",
      editAndResend: "Изменить и отправить снова",
      unassigned: "Исполнитель не назначен",
    };
  if (lang === "tr")
    return {
      openDetails: "Talebi aç",
      detailsDescription: "Talebin tüm ayrıntıları ve mevcut onay aşaması.",
      createdBy: "Talebi oluşturan",
      workflowStep: "Mevcut aşama",
      waitingFor: "İşlem beklenen kişi",
      completed: "Süreç tamamlandı",
      remaining: "Satın alınacak",
      close: "Kapat",
      workflowProgress: "Onay ilerlemesi",
      requestCreated: "Talep oluşturuldu",
      completedStep: "Tamamlandı",
      currentStepLabel: "Mevcut aşama",
      pendingStep: "Bekliyor",
      rejectedStep: "Burada reddedildi",
      automaticStep: "Otomatik geçildi",
      notRequired: "Gerekli değil",
      editAndResend: "Düzenle ve yeniden gönder",
      unassigned: "Sorumlu atanmadı",
    };
  return {
    openDetails: "Buyurtmani ochish",
    detailsDescription:
      "Buyurtmaning barcha tafsilotlari va joriy tasdiqlash bosqichi.",
    createdBy: "Buyurtmani yaratgan",
    workflowStep: "Joriy bosqich",
    waitingFor: "Amalni kutmoqda",
    completed: "Jarayon yakunlangan",
    remaining: "Xarid qilinishi kerak",
    close: "Yopish",
    workflowProgress: "Tasdiqlash jarayoni",
    requestCreated: "Buyurtma yaratildi",
    completedStep: "Yakunlangan",
    currentStepLabel: "Joriy bosqich",
    pendingStep: "Kutilmoqda",
    rejectedStep: "Shu yerda rad etilgan",
    automaticStep: "Avtomatik o‘tkazilgan",
    notRequired: "Talab etilmaydi",
    editAndResend: "Tahrirlash va qayta yuborish",
    unassigned: "Mas’ul tayinlanmagan",
  };
}

function workflowCopy(lang: Locale) {
  return { ...workflowCopyBase(lang), ...detailCopy(lang) };
}

function workflowCopyBase(lang: Locale) {
  if (lang === "ru")
    return {
      queueLabel: "Фильтр заявок",
      allOrders: "Все заявки",
      waitingForMe: "Ожидает меня",
      noWaiting: "Нет заявок, ожидающих вашего действия",
      approve: "Одобрить",
      reject: "Отклонить",
      warehouseReport: "Отчет склада",
      warehouseHelp: "Укажите доступное количество для каждой позиции.",
      requested: "Запрошено",
      available: "Доступно",
      submitReport: "Отправить отчет",
      cancel: "Отмена",
      supervisorReview: "На согласовании руководителя",
      inProgress: "В процессе",
      fulfilled: "Исполнено со склада",
      fulfilledShort: "со склада",
    };
  if (lang === "tr")
    return {
      queueLabel: "Talep filtresi",
      allOrders: "Tüm talepler",
      waitingForMe: "Beni bekliyor",
      noWaiting: "İşleminizi bekleyen talep yok",
      approve: "Onayla",
      reject: "Reddet",
      warehouseReport: "Depo raporu",
      warehouseHelp: "Her kalem için mevcut miktarı girin.",
      requested: "Talep",
      available: "Mevcut",
      submitReport: "Raporu gönder",
      cancel: "İptal",
      supervisorReview: "Bölüm onayı bekliyor",
      inProgress: "Devam ediyor",
      fulfilled: "Depodan karşılandı",
      fulfilledShort: "depodan",
    };
  return {
    queueLabel: "Buyurtma filtri",
    allOrders: "Barcha buyurtmalar",
    waitingForMe: "Meni kutmoqda",
    noWaiting: "Sizning amalingizni kutayotgan buyurtma yo‘q",
    approve: "Tasdiqlash",
    reject: "Rad etish",
    warehouseReport: "Ombor hisoboti",
    warehouseHelp: "Har bir pozitsiya uchun mavjud miqdorni kiriting.",
    requested: "So‘ralgan",
    available: "Mavjud",
    submitReport: "Hisobotni yuborish",
    cancel: "Bekor qilish",
    supervisorReview: "Bo‘lim rahbari tasdig‘ida",
    inProgress: "Jarayonda",
    fulfilled: "Ombordan ta’minlandi",
    fulfilledShort: "ombordan",
  };
}
