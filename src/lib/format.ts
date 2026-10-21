
export const money = (n: number | null | undefined): string =>
  'Rp' + Number(n || 0).toLocaleString('id-ID')

export const numericValue = (value: unknown): number =>
  Number(String(value || '').replace(/\D/g, '')) || 0

export const groupedNumber = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits ? Number(digits).toLocaleString('id-ID') : ''
}

const DECIMAL_STOCK_UNITS = ['kg', 'kilogram', 'liter', 'l', 'ltr']

export const isDecimalUnit = (unit: unknown): boolean =>
  DECIMAL_STOCK_UNITS.includes(String(unit || 'pcs').toLowerCase())

export interface ProductLike {
  stock?: number | null
  unit?: string | null
  name?: string | null
}

export function stockText(product: ProductLike): string {
  const stock = Number(product.stock) || 0
  return isDecimalUnit(product.unit)
    ? stock.toLocaleString('id-ID', { maximumFractionDigits: 2 })
    : String(Math.round(stock))
}

export function parseDecimalInput(value: unknown): number {
  let s = String(value ?? '').trim()
  if (!s) return 0
  s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s.replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function formatPurchaseDate(key: string): string {
  const date = new Date(key + 'T12:00:00')
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export const isWeightUnit = (u: unknown): boolean =>
  ['kg', 'ons', 'gram'].indexOf(String(u)) >= 0
