/* ============================================================
   Demo dataset generator.

   Writes a realistic 12-month trading history into Firestore for a company:
   transactions, five invoices, stock and staff. Everything the dashboard,
   tax page and Muhai Score display is then computed from these documents —
   there are no hardcoded numbers anywhere in the UI.

   Deterministic by design: a seeded PRNG means the same company always gets
   the same figures, so a demo is repeatable and a screenshot stays true.
   ============================================================ */
import { COLLECTIONS, addMany, updateCompany } from './db.js'

// ── Deterministic PRNG (mulberry32) ───────────────────────────────────
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (d, n) => new Date(d.getTime() + n * 86400000)
const round2 = (n) => Math.round(n * 100) / 100

// ── Business shape ────────────────────────────────────────────────────
const SALES_CUSTOMERS = [
  'Anadolu Tedarik A.Ş.',
  'Marmara Lojistik Ltd.',
  'Ege Ambalaj San. Tic.',
  'Boğaziçi Yazılım A.Ş.',
  'Akdeniz Gıda Ltd.',
  'Kuzey Enerji A.Ş.',
]

// Recurring monthly cost base — category, vendor, share of the month's spend.
const RECURRING_COSTS = [
  { category: 'payroll', vendor: 'Personel bordrosu', share: 0.42, description: 'Aylık maaş ödemesi' },
  { category: 'rent', vendor: 'Kadıköy Emlak', share: 0.14, description: 'İşyeri kira ödemesi' },
  { category: 'raw_materials', vendor: 'Ege Ambalaj San. Tic.', share: 0.16, description: 'Hammadde alımı' },
  { category: 'utilities', vendor: 'Enerjisa', share: 0.06, description: 'Elektrik ve doğalgaz faturası' },
  { category: 'software', vendor: 'Google Workspace', share: 0.04, description: 'Yazılım abonelik lisansı' },
  { category: 'marketing', vendor: 'Meta Ads', share: 0.07, description: 'Sosyal medya reklam harcaması' },
  { category: 'shipping', vendor: 'Aras Kargo', share: 0.05, description: 'Kargo ve nakliye gideri' },
  { category: 'fuel', vendor: 'Opet', share: 0.03, description: 'Araç akaryakıt alımı' },
  { category: 'insurance', vendor: 'Anadolu Sigorta', share: 0.02, description: 'İşyeri sigorta poliçesi' },
  { category: 'bank_fees', vendor: 'Ziraat Bankası', share: 0.01, description: 'Banka havale komisyonu' },
]

const PRODUCTS = [
  { name: 'A4 Fotokopi Kağıdı (koli)', sku: 'KGT-A4-500', stock: 128, minStock: 40, unitPrice: 185, unit: 'koli', monthlyUsage: 38 },
  { name: 'Toner Kartuş HP-26A', sku: 'TNR-HP26A', stock: 6, minStock: 12, unitPrice: 420, unit: 'adet', monthlyUsage: 9 },
  { name: 'Dosya Klasör (paket)', sku: 'OFS-KLS-10', stock: 74, minStock: 25, unitPrice: 53, unit: 'paket', monthlyUsage: 18 },
  { name: 'Streç Film 50cm', sku: 'AMB-STR-50', stock: 210, minStock: 60, unitPrice: 96, unit: 'rulo', monthlyUsage: 52 },
  { name: 'Koli Bandı Şeffaf', sku: 'AMB-BND-45', stock: 18, minStock: 30, unitPrice: 24, unit: 'adet', monthlyUsage: 40 },
  { name: 'Palet Ahşap 120x80', sku: 'LOJ-PLT-1208', stock: 45, minStock: 20, unitPrice: 310, unit: 'adet', monthlyUsage: 14 },
]

const EMPLOYEES = [
  { name: 'Emin Baytar', role: 'Genel Müdür', grossSalary: 92000, startDate: '2021-02-15', sgkNo: '1023456781' },
  { name: 'Selin Karaca', role: 'Mali İşler Uzmanı', grossSalary: 58000, startDate: '2022-09-01', sgkNo: '1023456782' },
  { name: 'Mert Doğan', role: 'Satış Sorumlusu', grossSalary: 46000, startDate: '2023-06-12', sgkNo: '1023456783' },
  { name: 'Ayşe Yılmaz', role: 'Depo Sorumlusu', grossSalary: 38000, startDate: '2024-03-04', sgkNo: '1023456784' },
]

const VAT_RATE = 0.2

/** Split a gross (KDV-inclusive) amount into net + VAT. */
function splitVat(gross, rate = VAT_RATE) {
  const net = round2(gross / (1 + rate))
  return { net, vat: round2(gross - net) }
}

// ── Generators ────────────────────────────────────────────────────────

/**
 * 12 months of trading. Revenue grows ~3%/month with noise; costs follow
 * revenue through the recurring cost base, so margins stay plausible.
 */
function buildTransactions(rand, today) {
  const txs = []
  const MONTHS = 12
  let monthlyRevenue = 148000

  for (let back = MONTHS - 1; back >= 0; back--) {
    const anchor = new Date(today.getFullYear(), today.getMonth() - back, 1)
    const year = anchor.getFullYear()
    const month = anchor.getMonth()
    const lastDay = new Date(year, month + 1, 0).getDate()
    // The current month is partial — only bill through today.
    const throughDay = back === 0 ? today.getDate() : lastDay

    const revenue = round2(monthlyRevenue * (0.93 + rand() * 0.14))
    const expenseTotal = round2(revenue * (0.6 + rand() * 0.08))

    // Revenue arrives as 6–9 customer payments spread across the month.
    const saleCount = 6 + Math.floor(rand() * 4)
    let remaining = revenue
    for (let i = 0; i < saleCount; i++) {
      const isLast = i === saleCount - 1
      const share = isLast ? remaining : revenue * (0.6 / saleCount + rand() * 0.12)
      const amount = round2(Math.max(Math.min(share, remaining), 0))
      remaining = round2(remaining - amount)
      const day = Math.max(1, Math.min(throughDay, 1 + Math.floor(rand() * lastDay)))
      if (amount <= 0) continue
      txs.push({
        date: iso(new Date(year, month, day)),
        amount,
        type: 'income',
        category: 'sales',
        vendor: SALES_CUSTOMERS[Math.floor(rand() * SALES_CUSTOMERS.length)],
        description: 'Satış tahsilatı',
      })
    }

    // Costs follow the recurring base, each on a stable day of the month.
    RECURRING_COSTS.forEach((cost, idx) => {
      const amount = round2(expenseTotal * cost.share * (0.9 + rand() * 0.2))
      const day = Math.min(throughDay, 2 + ((idx * 3) % 26))
      if (amount <= 0 || day < 1) return
      txs.push({
        date: iso(new Date(year, month, day)),
        amount,
        type: 'expense',
        category: cost.category,
        vendor: cost.vendor,
        description: cost.description,
      })
    })

    monthlyRevenue = round2(monthlyRevenue * 1.03)
  }

  return txs
}

/**
 * The five invoices. Deliberately mixed so every downstream code path is
 * exercised by real data: paid and unpaid, sales and purchase, one already
 * past its due date, one OCR-scanned with a sub-threshold confidence field.
 */
function buildInvoices(today) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const seq = (n) => `MUH-${y}-${String(n).padStart(4, '0')}`

  const specs = [
    {
      number: seq(1),
      vendor: 'Anadolu Tedarik A.Ş.',
      taxId: '4830027561',
      direction: 'sales',
      gross: 148200,
      issue: new Date(y, m, Math.min(4, today.getDate())),
      dueInDays: 30,
      status: 'paid',
      paidOffsetDays: 21,
      category: 'sales',
      source: 'manual',
    },
    {
      number: seq(2),
      vendor: 'Marmara Lojistik Ltd.',
      taxId: '2910044873',
      direction: 'sales',
      gross: 64500,
      issue: new Date(y, m, Math.min(9, today.getDate())),
      dueInDays: 14,
      status: 'pending',
      category: 'sales',
      source: 'manual',
    },
    {
      number: seq(3),
      vendor: 'Ege Ambalaj San. Tic.',
      taxId: '3510092204',
      direction: 'purchase',
      gross: 92300,
      issue: new Date(y, m - 1, 20),
      dueInDays: 30,
      status: 'paid',
      paidOffsetDays: 26,
      category: 'raw_materials',
      source: 'ocr',
      ocrConfidence: 0.94,
    },
    {
      number: seq(4),
      vendor: 'Teknoloji Bilişim A.Ş.',
      taxId: '6120038119',
      direction: 'purchase',
      gross: 22100,
      issue: new Date(y, m - 1, 8),
      dueInDays: 21,
      status: 'overdue',
      category: 'software',
      source: 'ocr',
      // Below the 0.7 threshold — this invoice lands in the review queue.
      ocrConfidence: 0.61,
    },
    {
      number: seq(5),
      vendor: 'Yıldız Matbaa Ltd.',
      taxId: '8840051177',
      direction: 'purchase',
      gross: 37800,
      issue: new Date(y, m, Math.min(2, today.getDate())),
      dueInDays: 45,
      status: 'pending',
      category: 'marketing',
      source: 'manual',
    },
  ]

  return specs.map((s) => {
    const { net, vat } = splitVat(s.gross)
    const due = addDays(s.issue, s.dueInDays)
    return {
      number: s.number,
      vendor: s.vendor,
      taxId: s.taxId,
      direction: s.direction,
      issueDate: iso(s.issue),
      dueDate: iso(due),
      paidDate: s.paidOffsetDays ? iso(addDays(s.issue, s.paidOffsetDays)) : null,
      amount: s.gross,
      netAmount: net,
      vatAmount: vat,
      vatRate: VAT_RATE,
      status: s.status,
      category: s.category,
      source: s.source,
      ocrConfidence: s.ocrConfidence ?? null,
      needsReview: s.ocrConfidence != null && s.ocrConfidence < 0.7,
      currency: 'TRY',
      demo: true,
    }
  })
}

/** Cash movements for the invoices that are already settled. */
function invoiceLedgerEntries(invoices) {
  return invoices
    .filter((inv) => inv.status === 'paid' && inv.paidDate)
    .map((inv) => ({
      date: inv.paidDate,
      amount: inv.amount,
      type: inv.direction === 'sales' ? 'income' : 'expense',
      category: inv.category,
      vendor: inv.vendor,
      description: `${inv.number} · ${inv.vendor}`,
      invoiceNumber: inv.number,
    }))
}

/** The next few statutory obligations, sized from the seeded trading. */
function buildTaxObligations(today, monthlyRevenue, monthlyExpense, payroll) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const kdv = Math.max(
    round2((monthlyRevenue - monthlyExpense) * (VAT_RATE / (1 + VAT_RATE))),
    0,
  )
  const period = `${y}-${String(m + 1).padStart(2, '0')}`

  return [
    {
      type: 'kdv',
      name: 'KDV Beyannamesi',
      period,
      dueDate: iso(new Date(y, m + 1, 28)),
      amount: kdv,
      status: 'draft',
    },
    {
      type: 'muhtasar',
      name: 'Muhtasar ve Prim Hizmet Beyannamesi',
      period,
      dueDate: iso(new Date(y, m + 1, 26)),
      amount: round2(payroll * 0.15),
      status: 'draft',
    },
    {
      type: 'sgk',
      name: 'SGK Primi',
      period,
      dueDate: iso(new Date(y, m + 1, 30)),
      amount: round2(payroll * 0.345),
      status: 'draft',
    },
    {
      type: 'gecici',
      name: 'Geçici Vergi (Kurumlar)',
      period: `${y}-Q${Math.floor(m / 3) + 1}`,
      dueDate: iso(new Date(y, Math.floor(m / 3) * 3 + 4, 17)),
      amount: round2(Math.max(monthlyRevenue - monthlyExpense, 0) * 3 * 0.25),
      status: 'draft',
    },
  ]
}

// ── Entry point ───────────────────────────────────────────────────────

/**
 * Seed a company with a full demo dataset.
 * @param {string} companyId
 * @param {{ today?: Date, seedKey?: string }} options
 * @returns {Promise<{invoices:number, transactions:number, products:number, employees:number, taxObligations:number}>}
 */
export async function seedCompany(companyId, { today = new Date(), seedKey } = {}) {
  const rand = rng(seedFromString(seedKey || companyId))

  const baseTransactions = buildTransactions(rand, today)
  const invoices = buildInvoices(today)
  const transactions = [...baseTransactions, ...invoiceLedgerEntries(invoices)]

  const thisMonth = iso(today).slice(0, 7)
  const monthTx = transactions.filter((t) => t.date.startsWith(thisMonth))
  const monthlyRevenue = round2(
    monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
  )
  const monthlyExpense = round2(
    monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  )
  const payroll = EMPLOYEES.reduce((s, e) => s + e.grossSalary, 0)

  await Promise.all([
    addMany(companyId, COLLECTIONS.transactions, transactions),
    addMany(companyId, COLLECTIONS.invoices, invoices),
    addMany(companyId, COLLECTIONS.products, PRODUCTS.map((p) => ({ ...p, demo: true }))),
    addMany(companyId, COLLECTIONS.employees, EMPLOYEES.map((e) => ({ ...e, demo: true }))),
    addMany(
      companyId,
      COLLECTIONS.taxObligations,
      buildTaxObligations(today, monthlyRevenue, monthlyExpense, payroll),
    ),
  ])

  // Opening cash so the runway and Muhai Score have a balance to work with.
  const netFlow = transactions.reduce(
    (s, t) => s + (t.type === 'income' ? t.amount : -t.amount),
    0,
  )
  await updateCompany(companyId, {
    seeded: true,
    seededAt: new Date().toISOString(),
    cashBalance: round2(Math.max(netFlow, 0) + 180000),
  })

  return {
    invoices: invoices.length,
    transactions: transactions.length,
    products: PRODUCTS.length,
    employees: EMPLOYEES.length,
    taxObligations: 4,
  }
}

export { PRODUCTS, EMPLOYEES, VAT_RATE, splitVat }
