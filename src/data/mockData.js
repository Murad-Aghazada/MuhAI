/* ============================================================
   Mock business data powering the dashboard & modules.
   Names use vendor/category keys resolved via i18n where needed.
   ============================================================ */

// 12-month cash flow (in ₺)
export const cashflow = [
  { income: 142000, expense: 98000 },
  { income: 158000, expense: 104000 },
  { income: 149000, expense: 101000 },
  { income: 171000, expense: 112000 },
  { income: 183000, expense: 118000 },
  { income: 176000, expense: 109000 },
  { income: 198000, expense: 124000 },
  { income: 211000, expense: 131000 },
  { income: 205000, expense: 127000 },
  { income: 228000, expense: 138000 },
  { income: 241000, expense: 142000 },
  { income: 263000, expense: 151000 },
]

export const kpis = {
  revenue: 263000,
  revenueDelta: 9.1,
  expense: 151000,
  expenseDelta: 6.3,
  profit: 112000,
  profitDelta: 12.8,
  tax: 38400,
  taxDelta: 4.2,
}

// Expense breakdown by category key (resolved via dashboard.cat.*)
export const expenseBreakdown = [
  { key: 'salaries', value: 58000, color: 'var(--c-emerald)' },
  { key: 'supplies', value: 31000, color: 'var(--c-amber)' },
  { key: 'rent', value: 24000, color: 'var(--c-sky)' },
  { key: 'marketing', value: 18000, color: 'var(--c-coral)' },
  { key: 'utilities', value: 12000, color: 'var(--c-violet)' },
  { key: 'other', value: 8000, color: '#b9bfbc' },
]

export const recentInvoices = [
  { id: 'INV-2026-0412', vendor: 'Anadolu Tedarik A.Ş.', date: '2026-06-24', amount: 14820, status: 'paid' },
  { id: 'INV-2026-0411', vendor: 'Marmara Lojistik', date: '2026-06-22', amount: 6450, status: 'pending' },
  { id: 'INV-2026-0410', vendor: 'Ege Ambalaj Ltd.', date: '2026-06-20', amount: 9230, status: 'paid' },
  { id: 'INV-2026-0409', vendor: 'Teknoloji Bilişim', date: '2026-06-18', amount: 22100, status: 'overdue' },
  { id: 'INV-2026-0408', vendor: 'Yıldız Matbaa', date: '2026-06-15', amount: 3780, status: 'paid' },
]

export const allInvoices = [
  ...recentInvoices,
  { id: 'INV-2026-0407', vendor: 'Boğaziçi Yazılım', date: '2026-06-12', amount: 18900, status: 'paid' },
  { id: 'INV-2026-0406', vendor: 'Akdeniz Gıda', date: '2026-06-10', amount: 7640, status: 'pending' },
  { id: 'INV-2026-0405', vendor: 'Kuzey Enerji', date: '2026-06-07', amount: 11250, status: 'paid' },
  { id: 'INV-2026-0404', vendor: 'Star Ofis Mobilya', date: '2026-06-04', amount: 26400, status: 'overdue' },
  { id: 'INV-2026-0403', vendor: 'Doğan Nakliyat', date: '2026-06-01', amount: 4980, status: 'paid' },
]

export const invoiceKpis = {
  total: 412,
  pending: 23,
  paid: 376,
  ocr: 98.6,
}

// OCR demo result
export const ocrSample = {
  vendor: 'Anadolu Tedarik A.Ş.',
  invoiceNo: 'AND-2026-8842',
  taxId: '4830027561',
  subtotal: 12350,
  vat: 2470,
  total: 14820,
  confidence: 98.6,
  lineItems: [
    { name: 'A4 Fotokopi Kağıdı (koli)', qty: 40, unit: 185, total: 7400 },
    { name: 'Toner Kartuş HP-26A', qty: 8, unit: 420, total: 3360 },
    { name: 'Dosya Klasör (paket)', qty: 30, unit: 53, total: 1590 },
  ],
}

// ---- Tax ----
export const taxKpis = {
  vat: 38400,
  withholding: 9200,
  income: 21500,
  nextDays: 6,
}

export const taxBreakdown = [
  { key: 'vat', label: 'KDV', labelEn: 'VAT', value: 38400, color: 'var(--c-emerald)' },
  { key: 'withholding', label: 'Stopaj', labelEn: 'Withholding', value: 9200, color: 'var(--c-amber)' },
  { key: 'income', label: 'Gelir V.', labelEn: 'Income', value: 21500, color: 'var(--c-sky)' },
  { key: 'stamp', label: 'Damga', labelEn: 'Stamp', value: 2300, color: 'var(--c-coral)' },
]

export const taxTimeline = [
  { type: 'KDV Beyannamesi', typeEn: 'VAT Declaration', date: '2026-07-28', amount: 38400, status: 'due' },
  { type: 'Muhtasar (SGK)', typeEn: 'Withholding (SGK)', date: '2026-07-26', amount: 30700, status: 'draft' },
  { type: 'Geçici Vergi', typeEn: 'Provisional Tax', date: '2026-08-17', amount: 41200, status: 'draft' },
]

export const filings = [
  { period: '2026 / 05', type: 'KDV', typeEn: 'VAT', amount: 35100, status: 'filed' },
  { period: '2026 / 05', type: 'Muhtasar', typeEn: 'Withholding', amount: 29400, status: 'filed' },
  { period: '2026 / 06', type: 'KDV', typeEn: 'VAT', amount: 38400, status: 'draft' },
  { period: '2026 / 06', type: 'Muhtasar', typeEn: 'Withholding', amount: 30700, status: 'due' },
  { period: '2026 / Q2', type: 'Geçici Vergi', typeEn: 'Provisional', amount: 41200, status: 'draft' },
]

// ---- Inventory ----
export const inventoryKpis = {
  sku: 248,
  value: 1284000,
  low: 12,
  turnover: 5.4,
}

// 7-day movements
export const stockMovements = [
  { inbound: 320, outbound: 280 },
  { inbound: 410, outbound: 360 },
  { inbound: 280, outbound: 340 },
  { inbound: 460, outbound: 390 },
  { inbound: 380, outbound: 420 },
  { inbound: 520, outbound: 470 },
  { inbound: 440, outbound: 510 },
]

export const products = [
  { name: 'Premium Zeytinyağı 1L', sku: 'GD-1001', stock: 1240, price: 285, status: 'in' },
  { name: 'Organik Bal 850g', sku: 'GD-1002', stock: 42, price: 410, status: 'low' },
  { name: 'El Yapımı Sabun', sku: 'KZ-2210', stock: 0, price: 95, status: 'out' },
  { name: 'Türk Kahvesi 500g', sku: 'GD-1015', stock: 860, price: 175, status: 'in' },
  { name: 'Seramik Kupa Set', sku: 'EV-3304', stock: 28, price: 240, status: 'low' },
  { name: 'Doğal Kuru Kayısı 1kg', sku: 'GD-1042', stock: 540, price: 320, status: 'in' },
  { name: 'Lavanta Mum 200g', sku: 'KZ-2255', stock: 0, price: 130, status: 'out' },
  { name: 'Bakır Cezve', sku: 'EV-3318', stock: 310, price: 480, status: 'in' },
]

export const topMoved = [
  { name: 'Premium Zeytinyağı 1L', moved: 480 },
  { name: 'Türk Kahvesi 500g', moved: 360 },
  { name: 'Doğal Kuru Kayısı 1kg', moved: 290 },
  { name: 'Bakır Cezve', moved: 210 },
  { name: 'Organik Bal 850g', moved: 150 },
]

// ---- Payroll ----
export const payrollKpis = {
  employees: 18,
  gross: 612000,
  sgk: 137700,
  net: 428400,
}

export const payrollBreakdown = [
  { key: 'net', value: 428400, color: 'var(--c-emerald)' },
  { key: 'sgkEmployer', value: 137700, color: 'var(--c-amber)' },
  { key: 'sgkEmployee', value: 91800, color: 'var(--c-sky)' },
  { key: 'incomeTax', value: 84600, color: 'var(--c-coral)' },
  { key: 'stampTax', value: 4640, color: 'var(--c-violet)' },
]

export const employees = [
  { name: 'Ayşe Yılmaz', role: 'Genel Müdür', roleEn: 'CEO', gross: 78000, deductions: 24180, net: 53820, status: 'paid' },
  { name: 'Mehmet Demir', role: 'Satış Müdürü', roleEn: 'Sales Lead', gross: 52000, deductions: 15600, net: 36400, status: 'paid' },
  { name: 'Zeynep Kaya', role: 'Muhasebe', roleEn: 'Accountant', gross: 41000, deductions: 12300, net: 28700, status: 'paid' },
  { name: 'Can Öztürk', role: 'Yazılım', roleEn: 'Developer', gross: 58000, deductions: 17400, net: 40600, status: 'pending' },
  { name: 'Elif Şahin', role: 'Pazarlama', roleEn: 'Marketing', gross: 44000, deductions: 13200, net: 30800, status: 'paid' },
  { name: 'Burak Aydın', role: 'Lojistik', roleEn: 'Logistics', gross: 36000, deductions: 10800, net: 25200, status: 'pending' },
]

// Business summary handed to the AI assistant for grounding
export const businessSummary = {
  revenue: '₺263.000',
  expense: '₺151.000',
  profit: '₺112.000',
  tax: '₺38.400',
  pendingInvoices: 23,
}
