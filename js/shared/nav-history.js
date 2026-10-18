/* KasirQuh Web — js/shared/nav-history.js
 * Tombol back browser (2026-10-18).
 * Prinsip: back selalu "mundur satu langkah" — sheet → tab → keluar.
 * Buka sheet / pindah tab via navbar = history.pushState; tombol back = popstate.
 * Sheet tidak ditumpuk (openSheet selalu tutup sheet lama dulu). */

var kqHistDepth = 0;      // jumlah state milik kita di atas history browser
var kqHistIgnore = false; // abaikan popstate berikutnya (bersih-bersih programatik)
var kqFromPop = false;    // sedang menangani popstate (jangan utak-atik history)
var kqReplacing = false;  // openSheet sedang ganti sheet (jangan drop history)
var kqTabHist = [];       // riwayat tab navbar: [{scope:'customer'|'admin', name}]

/* Push satu langkah navigasi ke history browser. */
function kqPushHist() {
  kqHistDepth++;
  try { history.pushState({kq: 1}, ''); } catch (e) {}
}

/* UI menutup/mengalihkan sendiri (tombol ×, backdrop, aksi selesai):
 * buang state history kita agar back tidak mampir ke state basi. */
function kqDropHist() {
  if (kqHistDepth <= 0) return;
  kqHistDepth--;
  kqHistIgnore = true;
  try { history.back(); } catch (e) { kqHistIgnore = false; }
  setTimeout(function(){ kqHistIgnore = false; }, 600);
}

/* Pindah tab via navbar: catat + push (idempoten untuk tab yang sama). */
function kqTrackTab(scope, name) {
  var last = kqTabHist[kqTabHist.length - 1];
  if (last && last.scope === scope && last.name === name) return;
  kqTabHist.push({scope: scope, name: name});
  kqPushHist();
}

/* Masuk/ganti mode: reset riwayat tab dengan tab dasar (tanpa push). */
function kqBaseTab(scope, name) {
  kqTabHist = [{scope: scope, name: name}];
}

window.addEventListener('popstate', function() {
  if (kqHistIgnore) { kqHistIgnore = false; return; }
  if (kqHistDepth > 0) kqHistDepth--;
  kqFromPop = true;
  try { kqOnBack(); } finally { kqFromPop = false; }
});

/* Inti perilaku tombol back. */
function kqOnBack() {
  // 1. Ada sheet terbuka? Tutup saja, tetap di layar.
  if (document.querySelector('.modal.open')) {
    if (typeof closeSheets === 'function') closeSheets();
    return;
  }
  // 2. Ada riwayat tab? Kembali ke tab sebelumnya (tanpa push baru).
  kqTabHist.pop(); // buang tab saat ini
  var prev = kqTabHist[kqTabHist.length - 1];
  if (prev) {
    if (prev.scope === 'customer' && typeof goCustomer === 'function') goCustomer(prev.name);
    else if (prev.scope === 'admin' && typeof showAdminView === 'function') showAdminView(prev.name);
    return;
  }
  // 3. Mentok — biarkan browser kembali ke situs sebelumnya / keluar (default).
}

/* DEBUG SEMENTARA (2026-10-18) - hapus setelah tes */
window.kqDebugStatus = function(){
  return 'kqPushHist=' + (typeof kqPushHist) + ',kqFromPop=' + (typeof kqFromPop) + ',depth=' + kqHistDepth;
};
