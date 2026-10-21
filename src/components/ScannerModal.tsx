import { useEffect, useRef, useState } from 'react'
import { Sheet, SheetHeader, toast } from './ui'

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  try {
    const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
    return typeof w.BarcodeDetector !== 'undefined' ? w.BarcodeDetector : null
  } catch {
    return null
  }
}

export default function ScannerModal({
  open,
  onClose,
  onScan,
}: {
  open: boolean
  onClose: () => void
  onScan: (code: string) => void
}) {
  const [hint, setHint] = useState('Menyiapkan kamera…')
  const [manual, setManual] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    if (!open) return
    busyRef.current = false
    setHint('Menyiapkan kamera…')
    setManual('')
    let cancelled = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | null = null

    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      if (stream) {
        try {
          stream.getTracks().forEach((t) => t.stop())
        } catch {
        }
        stream = null
      }
    }

    const start = async () => {
      const Ctor = getBarcodeDetector()
      if (!Ctor) {
        setHint('Browser tidak mendukung pindai otomatis · pakai ketik manual di bawah')
        return
      }
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const ps = await navigator.permissions.query({
            name: 'camera' as PermissionName,
          })
          if (cancelled) return
          if (ps.state === 'denied') {
            setHint('Izin kamera ditolak · aktifkan di Pengaturan HP > Aplikasi > Izin')
            toast('Izin kamera ditolak · cek Pengaturan HP')
            return
          }
        }
      } catch {
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!cancelled) setHint('Browser tidak mendukung kamera · pakai ketik manual di bawah')
        return
      }
      try {
        setHint('Meminta izin kamera…')
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          try {
            s.getTracks().forEach((t) => t.stop())
          } catch {
          }
          return
        }
        stream = s
        const video = videoRef.current
        if (video) {
          video.srcObject = s
          try {
            await video.play()
          } catch {
          }
        }
        if (cancelled) return
        setHint('Arahkan barcode ke dalam bingkai')
        let detector: BarcodeDetectorLike | null = null
        try {
          detector = new Ctor({
            formats: [
              'ean_13',
              'ean_8',
              'code_128',
              'code_39',
              'upc_a',
              'upc_e',
              'itf',
              'codabar',
              'qr_code',
            ],
          })
        } catch {
          try {
            detector = new Ctor()
          } catch {
            detector = null
          }
        }
        if (!detector) {
          setHint('Pemindai tidak tersedia · pakai ketik manual di bawah')
          return
        }
        const det = detector
        timer = setInterval(async () => {
          if (cancelled || busyRef.current) return
          try {
            const el = videoRef.current
            if (!el || el.readyState < 2) return
            const codes = await det.detect(el)
            if (codes && codes.length) {
              const code = String((codes[0] && codes[0].rawValue) || '').trim()
              if (code && !busyRef.current) {
                busyRef.current = true
                onScanRef.current(code)
              }
            }
          } catch {
          }
        }, 500)
      } catch (err) {
        if (cancelled) return
        const nm = err instanceof Error ? err.name : ''
        if (nm === 'NotAllowedError') {
          setHint('Izin kamera ditolak · aktifkan di Pengaturan HP > Aplikasi > Izin')
        } else if (nm === 'NotFoundError') {
          setHint('Kamera tidak ditemukan di HP ini')
        } else if (nm === 'NotReadableError') {
          setHint('Kamera dipakai aplikasi lain · tutup dulu')
        } else {
          setHint('Gagal memulai kamera · atau ketik manual di bawah')
        }
        toast('Gagal memulai kamera')
      }
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ])

  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const submitManual = () => {
    const value = manual.trim()
    if (!value) {
      toast('Ketik dulu kode barcodenya')
      return
    }
    setManual('')
    onScan(value)
  }

  return (
    <Sheet open={open} onClose={onClose} sheetClassName="sheet feature-sheet scanner-sheet">
      <SheetHeader kicker="Kasir cepat" title="Pindai Barcode" onClose={onClose} />
      <div className="scanner-frame" aria-label="Pratinjau kamera pemindai barcode">
        <div className="scanner-viewport">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div className="scanner-corners" />
        <span className="scanner-line" aria-hidden="true" />
        <span className="scanner-hint">{hint}</span>
      </div>
      <div className="scanner-manual">
        <label htmlFor="scannerManualInput">Kode susah terpindai? Ketik manual</label>
        <div className="scanner-manual-row">
          <input
            id="scannerManualInput"
            inputMode="text"
            autoComplete="off"
            placeholder="Contoh: 8991002103733"
            aria-label="Ketik kode barcode manual"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitManual()
              }
            }}
          />
          <button type="button" onClick={submitManual}>
            Cari
          </button>
        </div>
      </div>
      <div className="scanner-actions">
        <button className="scanner-close-button" type="button" onClick={onClose}>
          Tutup
        </button>
      </div>
    </Sheet>
  )
}
