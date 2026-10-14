/* KasirQuh Web — js/features/admin/dashboard.js
 * Diekstrak verbatim dari js/app.js (Tahap 4 modularisasi). */

// --- dari js/app.js baris 189 (pindah verbatim, tanpa ubah logika) ---
function dashboardShortcutById(id){return S.dashboardShortcutCatalog.find(item=>item.id===id)}
// --- dari js/app.js baris 191 (pindah verbatim, tanpa ubah logika) ---
function saveDashboardShortcuts(){storePromise('saveStoreSettings',{dashboardShortcutIds:S.dashboardShortcutIds}).catch(()=>{})}
// --- dari js/app.js baris 173 (pindah verbatim, tanpa ubah logika) ---
function renderCurrentDate(){$('#dashboardDate').textContent=new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date())}
