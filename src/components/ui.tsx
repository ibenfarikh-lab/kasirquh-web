/**
 * KasirQuh React — src/components/ui.tsx
 * Primitif UI bersama. Class CSS dipakai apa adanya dari app.css lama
 * agar tampilan 1:1 — JANGAN rename class.
 */
import { useEffect, type ReactNode, type MouseEvent } from 'react'
import { create } from 'zustand'

/* ---------- Icon: sprite SVG inline (SvgSprite, 39 simbol — port vanilla) ---------- */
export function Icon({
  name,
  className = 'icon',
  label,
}: {
  name: string
  className?: string
  label?: string
}) {
  return (
    <svg className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <use href={`#${name}`} />
    </svg>
  )
}

/* ---------- Sheet: pengganti openSheet()/closeSheets() + .modal/.sheet ---------- */
export function Sheet({
  open,
  onClose,
  children,
  sheetClassName = 'sheet feature-sheet',
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  sheetClassName?: string
  labelledBy?: string
}) {
  // KNOWN LIMITATION (T9, 2026-10-19): tombol back Android tidak menutup sheet/modal
  // (regresi UX dibanding vanilla). Pendekatan lama berbasis history (src/lib/sheetHistory.ts)
  // dinonaktifkan 2026-10-18 karena justru membuat sheet tidak terbuka di beberapa browser,
  // lalu modulnya dihapus (commit 371c5f2). Implementasi ulang yang benar butuh integrasi
  // dengan React Router + penanganan sheet bertumpuk + uji perangkat Android/PWA nyata —
  // sengaja TIDAK dikerjakan buta di sini. Penutup sheet yang tetap berfungsi: tombol ×,
  // tap backdrop, dan tombol Escape (desktop).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const onBackdrop = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains('modal')) onClose()
  }

  return (
    <div className="modal open" onClick={onBackdrop} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <section className={sheetClassName}>
        <div className="sheet-handle" aria-hidden="true" />
        {children}
      </section>
    </div>
  )
}

export function SheetHeader({
  kicker,
  title,
  onClose,
}: {
  kicker?: string
  title: string
  onClose: () => void
}) {
  return (
    <div className="sheet-top">
      <div>
        {kicker ? <small className="page-kicker">{kicker}</small> : null}
        <h2>{title}</h2>
      </div>
      <button className="sheet-close" onClick={onClose} aria-label="Tutup">
        ×
      </button>
    </div>
  )
}

/* ---------- Toast: pengganti toast() global ---------- */
interface ToastItem {
  id: number
  message: string
}

interface ToastState {
  items: ToastItem[]
  push: (message: string) => void
  dismiss: (id: number) => void
}

let toastSeq = 1

export const useToastStore = create<ToastState>()((set) => ({
  items: [],
  push: (message) => {
    const id = toastSeq++
    set((s) => ({ items: [...s.items, { id, message }] }))
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }))
    }, 3200)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

/** Pengganti global toast(msg) dari kode lama. */
export function toast(message: string): void {
  useToastStore.getState().push(message)
}

export function Toaster() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((t) => (
        <button key={t.id} className="toast-item" onClick={() => dismiss(t.id)}>
          {t.message}
        </button>
      ))}
    </div>
  )
}

/* ---------- Util kecil ---------- */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="empty-note">{children}</div>
}
