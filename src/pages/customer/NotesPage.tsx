/**
 * KasirQuh React — src/pages/customer/NotesPage.tsx
 * Pengganti NotesSheet (port renderCustomerNotes) — halaman penuh, bukan modal.
 *
 * TODO(koordinator): catatan masih lokal — gantikan dengan store catatan resmi
 * (catatan/tagihan dari admin untuk pelanggan) saat worker admin selesai.
 */

import { money } from '../../lib/format'
import { useNotesLocal } from '../../features/customer/local'

const TYPE_LABEL: Record<string, string> = {
  tagihan: 'Tagihan',
  pembayaran: 'Pembayaran',
  catatan: 'Catatan',
}

export default function NotesPage() {
  const notes = useNotesLocal((s) => s.notes)

  return (
    <div id="notesCustomerView" className="customer-view">
      <header className="plain-head top-safe">
        <div>
          <p className="page-kicker">Dari Warunge Mimi</p>
          <h1>Catatan &amp; Tagihan</h1>
        </div>
      </header>
      <main className="content">
        <div id="customerNotes">
          {notes.length ? (
            notes.map((n) => (
              <article key={n.id} className="note-card">
                <header>
                  <h3>
                    {TYPE_LABEL[n.type] || 'Catatan'}
                    {n.amount ? ' · ' + money(n.amount) : ''}
                  </h3>
                  <span className="stock-pill">Baru</span>
                </header>
                <p>{n.note}</p>
                <small>{n.time || ''}</small>
              </article>
            ))
          ) : (
            <div className="empty-note">Belum ada catatan dari warung.</div>
          )}
        </div>
      </main>
    </div>
  )
}
