/**
 * KasirQuh React — src/pages/admin/StoreNotesPage.tsx
 * Halaman (dulu StoreNotesSheet): catatan toko.
 * Pengganti #storeNotesModal (Catatan Toko — pengingat internal, koleksi
 * `store_memos`). Dibuka dari Menu (Laci Alat). Tidak ada di daftar bernomor
 * tugas, tetapi dibutuhkan grid Menu — dibuat agar porting utuh.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminBoot } from '../../features/admin/useAdminBoot'
import AdminNav from '../../components/AdminNav'
import { Icon, toast } from '../../components/ui'
import { useLocalAdminStore } from '../../features/admin/localAdmin'

export default function StoreNotesPage() {
  useAdminBoot()
  const navigate = useNavigate()
  const memos = useLocalAdminStore((s) => s.storeMemos)
  const addStoreMemo = useLocalAdminStore((s) => s.addStoreMemo)
  const deleteStoreMemo = useLocalAdminStore((s) => s.deleteStoreMemo)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const add = () => {
    const text = body.trim()
    if (!text) {
      toast('Tulis isi catatan dulu')
      return
    }
    setSaving(true)
    addStoreMemo({ title: title.trim(), body: text })
      .then(() => {
        setTitle('')
        setBody('')
        toast('Catatan toko ditambahkan')
      })
      .catch((error: unknown) => {
        const e = error as { code?: string; message?: string }
        if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Gagal menyimpan catatan')
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="admin-screen">
      <div className="subview admin-page active">
        <div className="admin-page-head">
          <span>
            <small>Hanya untuk admin</small>
            <h2>Catatan Toko</h2>
          </span>
          <button className="ghost" onClick={() => navigate('/admin/menu')} aria-label="Kembali ke Menu">
            {'‹ Kembali'}
          </button>
        </div>
      <div className="notes-form">
        <input
          maxLength={80}
          placeholder="Judul catatan (opsional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Tulis pengingat, contoh: cek stok gas sore ini"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button disabled={saving} onClick={add}>
          {saving ? 'Menyimpan…' : 'Tambah catatan'}
        </button>
      </div>
      <div className="store-notes">
        {memos.length ? (
          memos.map((m) => (
            <article className="note-card" key={m.id}>
              <header>
                <h3>{m.title || 'Catatan'}</h3>
                <small>{m.at}</small>
              </header>
              <p>{m.body}</p>
              <div className="card-actions">
                <button
                  className="ghost"
                  aria-label="Hapus catatan"
                  onClick={() =>
                    deleteStoreMemo(m.id).catch((error: unknown) => {
                      const e = error as { code?: string; message?: string }
                      if (!e || e.code !== 'OFFLINE') toast(e && e.message ? e.message : 'Hapus gagal')
                    })
                  }
                >
                  <Icon name="trash" />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-note">Belum ada catatan toko.</div>
        )}
      </div>
          </div>
      <AdminNav />
    </div>
  )
}