/**
 * KasirQuh React — src/pages/admin/StoreProfilePage.tsx
 * Halaman Profil Toko (dulu StoreProfileSheet): #storeProfileModal
 * (identitas & jam operasional toko).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../../components/ui'
import AdminNav from '../../components/AdminNav'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import { useLocalAdminStore } from '../../features/admin/localAdmin'

export default function StoreProfilePage() {
  useAdminBoot()
  const navigate = useNavigate()
  const storeName = useLocalAdminStore((s) => s.storeName)
  const openTime = useLocalAdminStore((s) => s.openTime)
  const closeTime = useLocalAdminStore((s) => s.closeTime)
  const saveStoreSettings = useLocalAdminStore((s) => s.saveStoreSettings)

  const [name, setName] = useState(storeName)
  const [openAt, setOpenAt] = useState(openTime)
  const [closeAt, setCloseAt] = useState(closeTime)
  const [address, setAddress] = useState('Jl. Melati, lingkungan RT 02')
  const [phone, setPhone] = useState('0812-3456-7890')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(storeName)
    setOpenAt(openTime)
    setCloseAt(closeTime)
    setSaving(false)
    // inisialisasi form sekali per mount — nilai store hanya dipakai sebagai nilai awal agar tidak menimpa isian user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = () => {
    const clean = (v: string) => v.replace(/[<>]/g, '').trim()
    setSaving(true)
    saveStoreSettings({
      storeName: clean(name) || 'Warunge Mimi',
      openTime: openAt || '06:00',
      closeTime: closeAt || '21:00',
      storeAddress: clean(address),
      storePhone: clean(phone),
    })
      .then(() => {
        navigate(-1)
        toast('Profil toko disimpan')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal menyimpan')
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="admin-screen">
      <div id="storeProfileView" className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Kelola Warung</small>
            <h2>Profil Toko</h2>
          </span>
        </div>
      <p className="tool-intro">Identitas dan informasi operasional yang dilihat pelanggan.</p>
      <div className="control-grid">
        <label className="control-field full">
          Nama toko
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="control-field">
          Jam buka
          <input type="time" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
        </label>
        <label className="control-field">
          Jam tutup
          <input type="time" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} />
        </label>
        <label className="control-field full">
          Alamat
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="control-field full">
          Telepon
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>
      <button className="primary-wide" style={{ marginTop: 12 }} disabled={saving} onClick={save}>
        {saving ? 'Menyimpan…' : 'Simpan Profil Toko'}
      </button>
        <AdminNav />
      </div>
    </div>
  )
}
