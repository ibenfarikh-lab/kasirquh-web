/* KasirQuh Web — js/init/gateway.js
 * Timer & slide gateway (diekstrak verbatim Tahap 5).
 * CATATAN: fungsi gateway lain (startGateway, showGatewaySlide, dsb.)
 * tetap di js/app.js karena cascade 37 fungsi — lihat laporan Tahap 5. */

// --- dari js/app.js baris 174 (pindah verbatim, Tahap 5) ---
function stopGatewayTimer(){if(S.gatewayTimer)clearTimeout(S.gatewayTimer);S.gatewayTimer=null}
