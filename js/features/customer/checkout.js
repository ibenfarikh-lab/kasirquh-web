/* KasirQuh Web — js/features/customer/checkout.js
 * Checkout & pesanan aktif sisi pelanggan.
 * Diekstrak verbatim dari js/app.js (Tahap 3 modularisasi). */

// --- dari js/app.js baris 623 (pindah verbatim, tanpa ubah logika) ---
function restoreActiveOrder(){if(S.activeOrder||S.isGuest||!S.activeCustomerId)return;const order=(S.onlineOrders||[]).find(o=>o.customerId===S.activeCustomerId&&o.status==='active');if(!order)return;const stepMap={menunggu:0,dikemas:1,dikirim:2},step=stepMap[order._rawStatus]||0,statusLabels=['Menunggu konfirmasi','Sedang dikemas','Sedang dikirim'];S.activeOrder={id:order.id,customerId:order.customerId,status:statusLabels[step],detail:(order.address||'Ambil di warung setelah pesanan siap'),method:order.method,step:step}}

