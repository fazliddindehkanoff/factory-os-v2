export type FinancePaymentStatus = "draft" | "approval" | "ready" | "partial" | "paid"

export type FinanceRequestPosition = {
  name: string
  requestedQuantity: number
  financedQuantity: number
  unit: string
  amount: number
}

export type FinanceRequestSnapshot = {
  id: string
  number: string
  applicant: string
  department: string
  purpose: string
  positions: FinanceRequestPosition[]
}

export type FinanceTransaction = {
  id: string
  date: string
  amount: number
  method: "bank" | "cash"
  reference: string
}

export type FinancePayment = {
  id: string
  createdAt: string
  supplier: string
  supplierTaxId: string
  contractNumber: string
  paymentType: "prepayment" | "postpayment" | "mixed"
  dueDate: string
  amount: number
  prepaidAmount: number
  paidAmount: number
  approval: "not_sent" | "in_review" | "approved"
  status: FinancePaymentStatus
  requests: FinanceRequestSnapshot[]
  transactions: FinanceTransaction[]
}

export const initialFinancePayments: FinancePayment[] = [
  {
    id: "PAY-2026-00048",
    createdAt: "2026-08-16",
    supplier: "Toshkent Metall Savdo",
    supplierTaxId: "305678912",
    contractNumber: "87-M",
    paymentType: "mixed",
    dueDate: "2026-08-26",
    amount: 18_400_000,
    prepaidAmount: 5_000_000,
    paidAmount: 8_000_000,
    approval: "approved",
    status: "partial",
    requests: [{
      id: "order-2026-0012",
      number: "ORD-2026-0012",
      applicant: "FIRAT DENIZ",
      department: "Ishlab chiqarish",
      purpose: "Ishlab chiqarish liniyasi uchun",
      positions: [
        { name: "Po‘lat", requestedQuantity: 500, financedQuantity: 300, unit: "kg", amount: 12_000_000 },
        { name: "Mis kabel", requestedQuantity: 120, financedQuantity: 80, unit: "m", amount: 6_400_000 },
      ],
    }],
    transactions: [{ id: "transaction-48-1", date: "2026-08-17", amount: 8_000_000, method: "bank", reference: "BANK-2026-8841" }],
  },
  {
    id: "PAY-2026-00047",
    createdAt: "2026-08-15",
    supplier: "Asia Cable Group",
    supplierTaxId: "307114820",
    contractNumber: "84-A",
    paymentType: "prepayment",
    dueDate: "2026-08-25",
    amount: 6_501_600,
    prepaidAmount: 6_501_600,
    paidAmount: 0,
    approval: "approved",
    status: "ready",
    requests: [{
      id: "order-2026-0011",
      number: "ORD-2026-0011",
      applicant: "FIRAT DENIZ",
      department: "Ta’minot",
      purpose: "Texnik xizmat va montaj",
      positions: [{ name: "Mis kabel va montaj", requestedQuantity: 40, financedQuantity: 40, unit: "m", amount: 6_501_600 }],
    }],
    transactions: [],
  },
  {
    id: "PAY-2026-00046",
    createdAt: "2026-08-14",
    supplier: "ASR Kimyo Invest",
    supplierTaxId: "301723412",
    contractNumber: "85-C",
    paymentType: "postpayment",
    dueDate: "2026-08-29",
    amount: 12_750_000,
    prepaidAmount: 0,
    paidAmount: 0,
    approval: "in_review",
    status: "approval",
    requests: [
      {
        id: "order-2026-0008",
        number: "ORD-2026-0008",
        applicant: "Dilshod Karimov",
        department: "Ishlab chiqarish",
        purpose: "Rejali ta’mirlash",
        positions: [{ name: "Texnik moy", requestedQuantity: 20, financedQuantity: 20, unit: "l", amount: 5_200_000 }],
      },
      {
        id: "order-2026-0009",
        number: "ORD-2026-0009",
        applicant: "Aziza Usmonova",
        department: "Ishlab chiqarish",
        purpose: "Uskunalarni ta’mirlash",
        positions: [
          { name: "Sanoat filtri", requestedQuantity: 10, financedQuantity: 10, unit: "dona", amount: 750_000 },
          { name: "Kimyoviy reagent", requestedQuantity: 60, financedQuantity: 60, unit: "kg", amount: 6_800_000 },
        ],
      },
    ],
    transactions: [],
  },
  {
    id: "PAY-2026-00045",
    createdAt: "2026-08-12",
    supplier: "SamTex Service",
    supplierTaxId: "309441736",
    contractNumber: "81-S",
    paymentType: "postpayment",
    dueDate: "2026-08-18",
    amount: 4_900_000,
    prepaidAmount: 0,
    paidAmount: 4_900_000,
    approval: "approved",
    status: "paid",
    requests: [{
      id: "order-2026-0005",
      number: "ORD-2026-0005",
      applicant: "Javlon Mirzayev",
      department: "Ishlab chiqarish",
      purpose: "Montaj xizmati",
      positions: [{ name: "Uskuna montaji", requestedQuantity: 1, financedQuantity: 1, unit: "xizmat", amount: 4_900_000 }],
    }],
    transactions: [{ id: "transaction-45-1", date: "2026-08-13", amount: 4_900_000, method: "bank", reference: "BANK-2026-8620" }],
  },
]

export function financePaymentBalance(payment: Pick<FinancePayment, "amount" | "paidAmount">) {
  return Math.max(0, payment.amount - payment.paidAmount)
}
