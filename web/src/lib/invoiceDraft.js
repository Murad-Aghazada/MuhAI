/* ============================================================
   An invoice document, and how an OCR result becomes one.

   Extracted out of pages/Invoices.jsx because the native app performs the
   same scan and must produce the same document. This mapping decides the
   amount, the VAT split and whether a human is asked to check the result —
   duplicating it across two clients is how one of them starts quietly
   reporting different money from the other.

   Pure JS by design: no DOM, no React, no browser API. Bundled by Vite for
   the web app and by Metro for the Expo app, from this one file.
   ============================================================ */
import { splitVat } from './vat.js'

/** Below this, the invoice is flagged for review rather than trusted.
    Matches the server's own threshold in ocr_service.py. */
export const CONFIDENCE_THRESHOLD = 0.7

const iso = (d) => d.toISOString().slice(0, 10)

export function emptyInvoice() {
  const today = new Date()
  return {
    number: '',
    vendor: '',
    taxId: '',
    direction: 'purchase',
    issueDate: iso(today),
    dueDate: iso(new Date(Date.now() + 30 * 86400000)),
    paidDate: null,
    amount: 0,
    netAmount: 0,
    vatAmount: 0,
    vatRate: 0.2,
    status: 'pending',
    category: 'other',
    source: 'manual',
    ocrConfidence: null,
    needsReview: false,
    currency: 'TRY',
  }
}

/**
 * A /api/compute/ocr result -> an invoice draft.
 *
 * Two judgements live here and are worth stating. The VAT falls back to a
 * split of the gross when the scan did not find a VAT line, because a Turkish
 * invoice always carries KDV and a zero would understate the deductible. And
 * the confidence shown is the page's mean word confidence — the same figure
 * the in-browser scan reports — so the two scan modes can be compared. The
 * per-field scores still travel in `fieldConfidence`, where the review form
 * marks each doubtful field, and still decide `needsReview` on the server.
 * An engine that reports no page figure falls back to the weakest of the
 * three fields that matter.
 */
export function ocrToDraft(result) {
  const value = (f) => result?.[f]?.value ?? null
  const conf = (f) => result?.[f]?.confidence ?? 0

  const total = Number(value('total_amount')) || 0
  const vat = Number(value('vat_amount')) || splitVat(total).vat

  return {
    ...emptyInvoice(),
    vendor: value('vendor_name') || '',
    // The server reads the tax number into `parsed`, not into a top-level
    // field, and this mapping used to skip it: the form's Vergi No stayed
    // blank on every server scan. VKN first, as document_reader does.
    taxId: result?.parsed?.vkn || result?.parsed?.tckn || '',
    number: value('invoice_number') || '',
    issueDate: value('date') || emptyInvoice().issueDate,
    amount: total,
    vatAmount: vat,
    netAmount: Math.max(total - vat, 0),
    source: 'ocr',
    ocrConfidence:
      result?.confidence ??
      Math.min(conf('vendor_name'), conf('invoice_number'), conf('total_amount')),
    needsReview: Boolean(result?.needs_review),
    rawText: result?.raw_text || '',
    fieldConfidence: {
      vendor: conf('vendor_name'),
      number: conf('invoice_number'),
      date: conf('date'),
      amount: conf('total_amount'),
      vat: conf('vat_amount'),
    },
  }
}
