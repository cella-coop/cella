import { A4, Pdf, width, wrap, type Page, type Style } from '@cella/org-pdf'
import type { Printed } from '../models/invoice.ts'

// An issued invoice as a PDF a client's accountant accepts: in French, as
// loi n° 94-665 art. 2 asks of an invoice, with the mentions of the code de
// commerce (art. L441-9, R123-237) and of the CGI (annexe II, art. 242
// nonies A), each figure as the invoice was issued.

const margin = 50
const right = A4.width - margin
const room = right - margin
// The lowest a table row or a block may reach before the page breaks,
// above the footer.
const floor = 110

const nbsp = ' '

// Cents as French euros: 12 345,67 €.
export function euros(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, nbsp)
  return `${sign}${whole},${String(abs % 100).padStart(2, '0')}${nbsp}€`
}

// YYYY-MM-DD as 31/12/2026.
export const day = (iso: string) => iso.split('-').reverse().join('/')

// A decimal as text, without its trailing zeros, with a decimal comma.
const decimal = (text: string) => String(Number(text)).replace('.', ',')

// A SIREN in its three groups: 123 456 789.
const siren = (s: string) => s.replace(/\s/g, '').replace(/(\d{3})(?=\d)/g, `$1${nbsp}`)

const small: Style = { size: 8, grey: 0.35 }

// The mentions the seller's papers carry: its name, form and capital, seat,
// SIREN and registry (R123-237), and VAT number (242 nonies A, I, 2°).
function mentions(p: Printed): string[] {
  const s = p.seller
  const named = [s.name, s.form && (s.capital ? `${s.form} au capital de ${s.capital}` : s.form)].filter(Boolean).join(', ')
  return [
    named,
    s.seat && `Siège : ${s.seat}`,
    s.siren && `SIREN ${siren(s.siren)}`,
    s.rcs && `RCS ${s.rcs}`,
    s.vat && `TVA intracommunautaire ${s.vat}`,
  ].filter((m): m is string => !!m)
}

// Mentions joined by a dot into lines no wider than the room, each mention
// whole on one line.
function joined(parts: string[], style: Style): string[] {
  const lines: string[] = []
  for (const part of parts) {
    const last = lines.at(-1)
    if (last !== undefined && width(`${last} · ${part}`, style) <= room) {
      lines[lines.length - 1] = `${last} · ${part}`
    } else {
      lines.push(part)
    }
  }
  return lines
}

// What paying late costs, and when payment is due (L441-9, I, al. 5;
// L441-10; D441-5). No discount is offered for paying early, which the
// article asks to be said.
function terms(p: Printed): string[] {
  return [
    `À régler au plus tard le ${day(p.invoice.due)}. Pas d’escompte pour paiement anticipé.`,
    'Tout retard de paiement entraîne des pénalités au taux de refinancement de la Banque centrale européenne ' +
      'majoré de 10 points (code de commerce, art. L441-10), exigibles dès le lendemain de l’échéance, et, ' +
      `pour un client professionnel, une indemnité forfaitaire pour frais de recouvrement de 40${nbsp}€ (art. D441-5).`,
  ]
}

// The lines' columns: where each starts or, for figures, ends.
const columns = { description: margin + 6, quantity: 345, price: 425, rate: 470, amount: right - 6 }
const described = columns.quantity - 40 - columns.description

function header(page: Page, y: number): number {
  page.fill(margin, y - 6, room, 20, 0.93)
  const head: Style = { size: 8.5, bold: true }
  page.text(columns.description, y, 'Désignation', head)
  page.text(columns.quantity, y, 'Qté', { ...head, align: 'right' })
  page.text(columns.price, y, 'Prix unitaire HT', { ...head, align: 'right' })
  page.text(columns.rate, y, 'TVA', { ...head, align: 'right' })
  page.text(columns.amount, y, 'Montant HT', { ...head, align: 'right' })
  return y - 24
}

export function pdf(p: Printed): Uint8Array {
  const i = p.invoice
  const doc = new Pdf(`Facture ${i.id}`)
  let page = doc.page()

  // The seller, top left; the invoice's number and dates, top right.
  page.text(margin, 790, p.seller.name ?? '', { size: 14, bold: true })
  let y = 774
  for (const line of [p.seller.form, p.seller.seat].filter((l): l is string => !!l)) {
    page.text(margin, y, line, { size: 9, grey: 0.3 })
    y -= 12
  }
  page.text(right, 790, 'FACTURE', { size: 20, bold: true, align: 'right' })
  page.text(right, 770, `N° ${i.id}`, { size: 10, bold: true, align: 'right' })
  page.text(right, 756, `Date d’émission : ${day(i.issued)}`, { size: 9, align: 'right' })
  page.text(right, 744, `Échéance : ${day(i.due)}`, { size: 9, align: 'right' })
  if (i.voided) {
    page.text(right, 726, `ANNULÉE le ${day(i.voided)}`, { size: 10, bold: true, align: 'right' })
  }

  // Whom it bills, as issued.
  const billed = 320
  y = 690
  page.text(billed, y, 'Facturé à', small)
  y -= 14
  page.text(billed, y, i.bill_to, { size: 11, bold: true })
  for (const line of (i.bill_address ?? '').split('\n').filter((l) => l.trim())) {
    y -= 13
    page.text(billed, y, line.trim(), { size: 10 })
  }

  y = Math.min(y, 640) - 30
  for (const line of wrap(`Objet : ${i.label}`, room, { size: 10 })) {
    page.text(margin, y, line, { size: 10 })
    y -= 13
  }

  // Each line: what, how many, at what price and VAT rate, and its amount
  // (242 nonies A, I, 8°).
  y = header(page, y - 12)
  for (const l of i.lines) {
    const text = wrap(l.description, described, { size: 9.5 })
    const tall = text.length * 12 + 6
    if (y - tall < floor) {
      page = doc.page()
      y = header(page, 790)
    }
    text.forEach((t, n) => page.text(columns.description, y - n * 12, t, { size: 9.5 }))
    page.text(columns.quantity, y, decimal(l.quantity), { size: 9.5, align: 'right' })
    page.text(columns.price, y, euros(l.unit_price), { size: 9.5, align: 'right' })
    page.text(columns.rate, y, `${decimal(l.vat_rate)}${nbsp}%`, { size: 9.5, align: 'right' })
    page.text(columns.amount, y, euros(l.amount), { size: 9.5, align: 'right' })
    y -= tall
    page.rule(margin, y + 8, right, y + 8, 0.3, 0.8)
  }

  // The totals: net, the VAT at each rate on its base, and the total due
  // (242 nonies A, I, 10° bis).
  const sums: [string, string, boolean][] = [
    ['Total HT', euros(i.net), false],
    ...p.taxed.map((t): [string, string, boolean] => [`TVA ${decimal(t.rate)}${nbsp}% sur ${euros(t.base)}`, euros(t.tax), false]),
    ['Total TTC', euros(i.total), true],
  ]
  const lines = terms(p).flatMap((t) => wrap(t, room, { size: 8.5 }))
  if (y - sums.length * 16 - 30 - lines.length * 11 < floor) {
    page = doc.page()
    y = 790
  }
  y -= 10
  for (const [label, amount, total] of sums) {
    const style: Style = { size: total ? 11 : 9.5, bold: total }
    if (total) {
      page.rule(330, y + 12, right, y + 12, 0.6)
      y -= 2
    }
    page.text(335, y, label, style)
    page.text(columns.amount, y, amount, { ...style, align: 'right' })
    y -= 16
  }

  // When it is due and what paying late costs.
  y -= 14
  page.text(margin, y, 'Conditions de paiement', { size: 9, bold: true })
  for (const line of lines) {
    y -= 11
    page.text(margin, y, line, { size: 8.5 })
  }

  // The seller's mentions on every page, and the page's number.
  const foot = joined(mentions(p), small)
  for (const [n, each] of doc.pages.entries()) {
    each.rule(margin, 62, right, 62, 0.3, 0.7)
    foot.forEach((line, k) => each.text(margin, 50 - k * 10, line, small))
    each.text(right, 24, `${i.id} · page ${n + 1}/${doc.pages.length}`, { ...small, align: 'right' })
  }
  return doc.bytes()
}
