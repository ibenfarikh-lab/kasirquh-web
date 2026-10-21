/**
 * KasirQuh React — src/pages/customer/RutinPage.tsx
 * Pengganti RutinSheet (#rutinModal) — halaman penuh, bukan modal.
 *
 * TODO(koordinator): jadwal rutin disimpan lokal — gantikan dengan dokumen
 * customers/{uid} (worker auth) saat tersedia.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import { toast } from '../../components/ui'
import { useSettingsLocal, useRoutinesLocal, useSessionLocal, routineNextDate } from '../../features/customer/local'
import type { CartMap } from '../../types'

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

function findProductByKeywords(keywords: string[]) {
  const list = keywords.map((k) => k.toLowerCase())
  return useProductsStore
    .getState()
    .products.find((p) => p.isActive !== false && p.stock > 0 && list.some((k) => p.name.toLowerCase().includes(k)))
}

export default function RutinPage() {
  const navigate = useNavigate()
  const settings = useSettingsLocal((s) => s.settings)
  const routines = useRoutinesLocal((s) => s.routines)
  const saveRoutines = useRoutinesLocal((s) => s.saveRoutines)
  const isGuest = useSessionLocal((s) => s.isGuest)
  const addCustomerItem = useCartStore((s) => s.addCustomerItem)

  const packages = settings.rutinPackages || []
  const [choice, setChoice] = useState<string>('dapur')
  const [name, setName] = useState('')
  const [interval, setInterval] = useState<'harian' | 'mingguan'>('harian')
  const [day, setDay] = useState('Sabtu')

  const activeChoice = packages.length ? packages[0].id : choice

  function repeatRoutine() {
    const pkg = packages.find((p) => p.id === (packages.length ? activeChoice : undefined))
    if (pkg && pkg.items && pkg.items.length) {
      const products = useProductsStore.getState().products
      const bundle: CartMap = {}
      for (const it of pkg.items) {
        const p = products.find((x) => x.id === it.productId)
        if (!p || p.stock <= 0) {
          toast('Paket belum bisa disusun · ada produk yang belum tersedia')
          return
        }
        bundle[it.productId] = (bundle[it.productId] || 0) + Math.max(1, Math.round(Number(it.qty) || 1))
      }
      Object.entries(bundle).forEach(([id, q]) => addCustomerItem(id, q))
      navigate('/beranda/keranjang')
      return
    }
    // Fallback paket bawaan (port verbatim dari app.js)
    const specs =
      activeChoice === 'minum'
        ? [
            { kw: ['aqua', 'air mineral'], qty: 4, label: 'Air mineral' },
            { kw: ['teh'], qty: 1, label: 'Teh' },
            { kw: ['kopi'], qty: 5, label: 'Kopi' },
          ]
        : [
            { kw: ['minyak'], qty: 1, label: 'Minyak' },
            { kw: ['mi', 'mie', 'indomie'], qty: 4, label: 'Mie' },
            { kw: ['kopi'], qty: 4, label: 'Kopi' },
          ]
    const bundle: CartMap = {}
    const missing: string[] = []
    for (const spec of specs) {
      const p = findProductByKeywords(spec.kw)
      if (!p) {
        missing.push(spec.label)
        continue
      }
      bundle[p.id] = (bundle[p.id] || 0) + spec.qty
    }
    if (missing.length) {
      toast('Stok habis: ' + missing.join(', ') + '. Paket belum bisa disusun.')
      return
    }
    if (!Object.keys(bundle).length) {
      toast('Paket belum bisa disusun · ada produk yang belum tersedia')
      return
    }
    Object.entries(bundle).forEach(([id, q]) => addCustomerItem(id, q))
    navigate('/beranda/keranjang')
  }

  function saveRoutine() {
    const clean = name.trim()
    if (!clean) {
      toast('Isi nama jadwal dulu')
      return
    }
    saveRoutines(routines.concat([{ name: clean, interval, day, createdAt: new Date().toISOString() }]))
    setName('')
    toast(isGuest ? 'Jadwal tersimpan selama sesi ini' : 'Jadwal tersimpan di akunmu')
  }

  function removeRoutine(index: number) {
    saveRoutines(routines.filter((_, i) => i !== index))
  }

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(d)

  return (
    <div id="rutinCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Tak perlu mengingat ulang</p>
          <h1>Belanja Rutin</h1>
        </div>
      </header>
      <main className="content">
        <div className="plan-grid">
          {packages.length ? (
            packages.map((p, i) => (
              <button
                key={p.id}
                className={`plan-card routine-plan${(i === 0 && !packages.find((x) => x.id === choice)) || choice === p.id ? ' active' : ''}`}
                onClick={() => setChoice(p.id)}
              >
                <b>{p.name}</b>
                <small>{p.desc}</small>
                <strong>Ikut harga katalog</strong>
              </button>
            ))
          ) : (
            <>
              <button className={`plan-card routine-plan${activeChoice === 'dapur' ? ' active' : ''}`} onClick={() => setChoice('dapur')}>
                <b>Paket dapur</b>
                <small>Minyak, mi, kopi</small>
                <strong>Ikut harga katalog</strong>
              </button>
              <button className={`plan-card routine-plan${activeChoice === 'minum' ? ' active' : ''}`} onClick={() => setChoice('minum')}>
                <b>Paket minum</b>
                <small>Aqua, teh, kopi</small>
                <strong>Ikut harga katalog</strong>
              </button>
            </>
          )}
        </div>
        <button id="repeatRoutineBtn" className="primary-wide" onClick={repeatRoutine}>
          Masukkan paket ke keranjang
        </button>
        <div className="routine-schedule">
          <h3>Jadwal belanjaku</h3>
          <p className="service-note">
            Jadwal tersimpan di akunmu. Warung tidak mengirim pengingat otomatis — tanggal berikut dihitung dari kalender.
          </p>
          <div className="form-stack">
            <label htmlFor="routineName">Nama jadwal</label>
            <input id="routineName" placeholder="Contoh: Belanja mingguan" value={name} onChange={(e) => setName(e.target.value)} />
            <label htmlFor="routineInterval">Interval</label>
            <select id="routineInterval" value={interval} onChange={(e) => setInterval(e.target.value as 'harian' | 'mingguan')}>
              <option value="harian">Harian</option>
              <option value="mingguan">Mingguan</option>
            </select>
            <label htmlFor="routineDay">Hari</label>
            <select id="routineDay" value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <button id="saveRoutineBtn" className="secondary-wide" onClick={saveRoutine}>
            Simpan jadwal
          </button>
          <div id="routineList" className="service-list">
            {routines.length ? (
              routines.map((r, i) => (
                <article key={i} className="service-row">
                  <div>
                    <h3>{r.name}</h3>
                    <p>
                      {r.interval === 'mingguan' ? 'Mingguan · ' + r.day : 'Harian'} · berikut: {fmt(routineNextDate(r))}
                    </p>
                  </div>
                  <button onClick={() => removeRoutine(i)}>Hapus</button>
                </article>
              ))
            ) : (
              <div className="empty-note">Belum ada jadwal rutin.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
