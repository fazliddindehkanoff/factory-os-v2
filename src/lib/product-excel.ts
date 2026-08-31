import ExcelJS from "exceljs"

const PRODUCT_SHEET_NAME = "Products"
const MAX_PRODUCT_ROWS = 5_000

const productColumns = [
  { header: "Code", key: "code", width: 18 },
  { header: "Title (Uzbek)", key: "titleUz", width: 30 },
  { header: "Title (Russian)", key: "titleRu", width: 30 },
  { header: "Title (Turkish)", key: "titleTr", width: 30 },
  { header: "Category ID", key: "categoryId", width: 24 },
  { header: "Category", key: "category", width: 28 },
] as const

export type ProductWorkbookProduct = {
  code: string
  categoryId: string
  titleUz: string
  titleRu: string
  titleTr: string
}

export type ProductWorkbookCategory = {
  id: string
  titleUz: string
  titleRu: string
  titleTr: string
}

export type ProductWorkbookReferences = {
  categories: ProductWorkbookCategory[]
}

export type ProductImportIssue = {
  row: number
  message: string
}

export class ProductWorkbookValidationError extends Error {
  issues: ProductImportIssue[]

  constructor(message: string, issues: ProductImportIssue[]) {
    super(message)
    this.name = "ProductWorkbookValidationError"
    this.issues = issues
  }
}

function localizedLabel(item: { titleUz: string; titleRu: string; titleTr: string }) {
  return item.titleUz || item.titleRu || item.titleTr
}

function styleHeader(worksheet: ExcelJS.Worksheet) {
  const header = worksheet.getRow(1)
  header.height = 26
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.alignment = { vertical: "middle" }
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F766E" },
  }
  header.eachCell((cell) => {
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF115E59" } },
    }
  })
}

function finishSheet(worksheet: ExcelJS.Worksheet, columnCount: number) {
  styleHeader(worksheet)
  worksheet.views = [{ state: "frozen", ySplit: 1, showGridLines: false }]
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount },
  }

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    row.height = 22
    row.alignment = { vertical: "middle" }
    if (rowNumber % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0FDFA" },
      }
    }
  }
}

export async function createProductsWorkbook(
  products: ProductWorkbookProduct[],
  references: ProductWorkbookReferences,
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Factory OS"
  workbook.lastModifiedBy = "Factory OS"
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.subject = "Factory OS product catalog"

  const categoryById = new Map(references.categories.map((category) => [category.id, category]))
  const productsSheet = workbook.addWorksheet(PRODUCT_SHEET_NAME, {
    properties: { defaultRowHeight: 22 },
  })
  productsSheet.columns = productColumns.map((column) => ({ ...column }))
  productsSheet.addRows(products.map((product) => {
    const category = categoryById.get(product.categoryId)
    return {
      code: product.code,
      titleUz: product.titleUz,
      titleRu: product.titleRu,
      titleTr: product.titleTr,
      categoryId: product.categoryId,
      category: category ? localizedLabel(category) : "",
    }
  }))
  finishSheet(productsSheet, productColumns.length)

  const categoriesSheet = workbook.addWorksheet("Categories", {
    properties: { defaultRowHeight: 22 },
  })
  categoriesSheet.columns = [
    { header: "ID", key: "id", width: 26 },
    { header: "Uzbek", key: "titleUz", width: 30 },
    { header: "Russian", key: "titleRu", width: 30 },
    { header: "Turkish", key: "titleTr", width: 30 },
  ]
  categoriesSheet.addRows(references.categories)
  finishSheet(categoriesSheet, 4)

  const categoryRangeEnd = Math.max(2, references.categories.length + 1)
  for (let rowNumber = 2; rowNumber <= MAX_PRODUCT_ROWS + 1; rowNumber += 1) {
    productsSheet.getCell(`E${rowNumber}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`'Categories'!$A$2:$A$${categoryRangeEnd}`],
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "Invalid category",
      error: "Choose a Category ID from the Categories sheet.",
    }
  }

  const output = await workbook.xlsx.writeBuffer()
  return Buffer.from(output)
}

const requiredHeaders = [
  "code",
  "title (uzbek)",
  "title (russian)",
  "title (turkish)",
  "category id",
] as const

function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase()
}

function cellText(row: ExcelJS.Row, column: number) {
  return row.getCell(column).text.trim()
}

export async function parseProductsWorkbook(
  input: Buffer,
  references: ProductWorkbookReferences,
) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Uint8Array.from(input).buffer)
  const worksheet = workbook.getWorksheet(PRODUCT_SHEET_NAME)

  if (!worksheet) {
    throw new ProductWorkbookValidationError("The Products sheet is missing.", [
      { row: 1, message: "The workbook must contain a sheet named Products." },
    ])
  }

  const headerPositions = new Map<string, number>()
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    headerPositions.set(normalizeHeader(cell.text), columnNumber)
  })
  const missingHeaders = requiredHeaders.filter((header) => !headerPositions.has(header))
  if (missingHeaders.length > 0) {
    throw new ProductWorkbookValidationError("Required columns are missing.", missingHeaders.map((header) => ({
      row: 1,
      message: `Missing column: ${header}.`,
    })))
  }

  if (worksheet.actualRowCount - 1 > MAX_PRODUCT_ROWS) {
    throw new ProductWorkbookValidationError("The workbook has too many product rows.", [
      { row: MAX_PRODUCT_ROWS + 2, message: `A maximum of ${MAX_PRODUCT_ROWS} products can be imported at once.` },
    ])
  }

  const categoryIds = new Set(references.categories.map((category) => category.id))
  const seenCodes = new Set<string>()
  const issues: ProductImportIssue[] = []
  const products: ProductWorkbookProduct[] = []

  const columns = Object.fromEntries(requiredHeaders.map((header) => [header, headerPositions.get(header)!]))
  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const rawCode = cellText(row, columns["code"])
    const titleUz = cellText(row, columns["title (uzbek)"])
    const titleRu = cellText(row, columns["title (russian)"])
    const titleTr = cellText(row, columns["title (turkish)"])
    const categoryId = cellText(row, columns["category id"])

    if (![rawCode, titleUz, titleRu, titleTr, categoryId].some(Boolean)) continue

    const code = rawCode.toLocaleUpperCase()

    if (!code) issues.push({ row: rowNumber, message: "Code is required." })
    if (!titleUz && !titleRu && !titleTr) {
      issues.push({ row: rowNumber, message: "At least one translated title is required." })
    }
    if (!categoryIds.has(categoryId)) {
      issues.push({ row: rowNumber, message: `Unknown Category ID: ${categoryId || "(blank)"}.` })
    }
    if (seenCodes.has(code)) {
      issues.push({ row: rowNumber, message: `Duplicate product code in workbook: ${code}.` })
    }
    seenCodes.add(code)

    if (code && (titleUz || titleRu || titleTr) && categoryIds.has(categoryId)) {
      products.push({
        code,
        categoryId,
        titleUz,
        titleRu,
        titleTr,
      })
    }
  }

  if (products.length === 0 && issues.length === 0) {
    issues.push({ row: 2, message: "The Products sheet does not contain any product rows." })
  }
  if (issues.length > 0) {
    throw new ProductWorkbookValidationError("The workbook contains invalid products.", issues)
  }

  return products
}
