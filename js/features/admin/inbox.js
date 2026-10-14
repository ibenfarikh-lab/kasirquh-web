/* KasirQuh Web — js/features/admin/inbox.js
 * Diekstrak verbatim dari js/app.js (Tahap 4 modularisasi). */

// --- dari js/app.js baris 130 (pindah verbatim, tanpa ubah logika) ---
function loadInboxRead(){try{const raw=localStorage.getItem('kqh_inbox_read');if(raw){const ids=JSON.parse(raw);if(Array.isArray(ids))S.inboxReadIds=ids}}catch(e){}}
// --- dari js/app.js baris 129 (pindah verbatim, tanpa ubah logika) ---
function saveInboxRead(){const ids=(S.inboxItems||[]).filter(x=>x&&x.read).map(x=>x.id).slice(0,200);S.inboxReadIds=ids;try{localStorage.setItem('kqh_inbox_read',JSON.stringify(ids))}catch(e){}storePromise('saveStoreSettings',{inboxReadIds:ids}).catch(()=>{})}
// --- dari js/app.js baris 128 (pindah verbatim, tanpa ubah logika) ---
function updateInboxBadge(){const unread=S.inboxItems.filter(x=>!x.read).length;$('#inboxBadge').textContent=unread;$('#inboxBadge').hidden=unread===0}
