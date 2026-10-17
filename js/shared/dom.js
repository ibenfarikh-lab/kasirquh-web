/* KasirQuh Web — js/shared/dom.js
 * Helper DOM & UI dasar (dipakai mode pelanggan + admin).
 * Diekstrak verbatim dari js/app.js (Tahap 1 modularisasi). */

// --- dari js/app.js baris 3 (pindah verbatim, tanpa ubah logika) ---
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
// --- dari js/app.js baris 56 (pindah verbatim, tanpa ubah logika) ---
function friendlyError(error,fallback){if(!error)return fallback||'Terjadi kesalahan';if(error.code==='OFFLINE')return null;const msg=String(error.message||'');if(error.code==='permission-denied'||msg.includes('Missing or insufficient permissions'))return 'Akses ditolak. Silakan masuk dulu.';if(msg.includes('not-found'))return 'Data tidak ditemukan.';return fallback||'Terjadi kesalahan. Coba lagi.'}
// --- dari js/app.js baris 57 (pindah verbatim, tanpa ubah logika) ---
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__tt);window.__tt=setTimeout(()=>t.classList.remove('show'),1800)}
// --- dari js/app.js baris 194 (pindah verbatim, tanpa ubah logika) ---
function iconSvg(name){return `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`}
// --- dari js/app.js baris 266 (pindah verbatim, tanpa ubah logika) ---
function cleanInput(value){return String(value||'').replace(/[<>]/g,'').trim()}
// --- dari js/app.js baris 267 (pindah verbatim, tanpa ubah logika) ---
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}

/* Avatar pelanggan: foto bila ada, huruf awal bila belum. (2026-10-18) */
function avatarHtml(photoURL, initial, cls){
  cls = cls || 'avatar';
  if (photoURL) return '<span class="'+cls+' has-photo"><img src="'+String(photoURL).replace(/"/g,'&quot;')+'" alt="Foto profil"></span>';
  return '<span class="'+cls+'">'+escapeHtml(initial || '?')+'</span>';
}
