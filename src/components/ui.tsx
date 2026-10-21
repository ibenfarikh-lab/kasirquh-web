import { useEffect, useId, type ReactNode, type MouseEvent } from 'react'
import { create } from 'zustand'
import { useSheetRoute } from '../lib/sheetRoute'

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


export function Sheet({
  open,
  onClose,
  children,
  sheetClassName = 'sheet feature-sheet',
  labelledBy,
  sheetId,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  sheetClassName?: string
  labelledBy?: string
  sheetId?: string
}) {
  const autoId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const id = sheetId || `sheet-${autoId}`
  useSheetRoute(id, open, onClose)
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

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  type?: ToastType
  action?: ToastAction
  duration?: number
}

interface ToastItem {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
  duration: number
}

interface ToastState {
  items: ToastItem[]
  push: (message: string, opts?: ToastOptions) => void
  dismiss: (id: number) => void
}

let toastSeq = 1
const TOAST_DEFAULT_DURATION = 3200

export const useToastStore = create<ToastState>()((set, get) => ({
  items: [],
  push: (message, opts) => {
    if (get().items.some((t) => t.message === message)) return
    const id = toastSeq++
    const duration = Math.max(500, opts?.duration ?? TOAST_DEFAULT_DURATION)
    const item: ToastItem = {
      id,
      message,
      type: opts?.type ?? 'info',
      action: opts?.action,
      duration,
    }
    set((s) => ({ items: [...s.items, item].slice(-2) }))
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }))
    }, duration)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

export function toast(message: string, opts?: ToastOptions): void {
  useToastStore.getState().push(message, opts)
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: 'check',
  warning: 'alert',
  error: 'alert',
  info: 'bell',
}

export function Toaster() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast-item toast-${t.type}`}
          role="status"
          tabIndex={0}
          onClick={() => dismiss(t.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') dismiss(t.id)
          }}
        >
          <Icon name={TOAST_ICONS[t.type]} className="toast-icon" />
          <span className="toast-msg">{t.message}</span>
          {t.action ? (
            <button
              type="button"
              className="toast-action"
              onClick={(e) => {
                e.stopPropagation()
                dismiss(t.id)
                t.action?.onClick()
              }}
            >
              {t.action.label}
            </button>
          ) : null}
          <span
            className="toast-bar"
            style={{ animationDuration: `${t.duration}ms` }}
            aria-hidden="true"
          />
        </div>
      ))}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="empty-note">{children}</div>
}
