/* KasirQuh Web — js/features/customer/catalog.js
 * Katalog & detail produk sisi pelanggan.
 * Diekstrak verbatim dari js/app.js (Tahap 3 modularisasi). */

// --- dari js/app.js baris 236 (pindah verbatim, tanpa ubah logika) ---
function updateDetailTotal(){const p=S.products.find(x=>x.id===S.currentDetail);if(!p)return;const isW=typeof isWeightUnit==='function'&&isWeightUnit(p.unit);const q=isW?Math.max(0.1,S.detailQty||0.5):Math.max(1,Math.round(S.detailQty||1));$('#detailQty').textContent=isW?(String(q).replace('.',',')+' '+p.unit):q;$('#detailTotal').textContent=money(Math.round(p.price*q))}


// --- dari js/app.js baris 237 (pindah verbatim, tanpa ubah logika) ---
function showDetailSlide(index){$$('.detail-slide').forEach((x,i)=>x.classList.toggle('active',i===index));$$('.slider-dot').forEach((x,i)=>x.classList.toggle('active',i===index))}


// --- dari js/app.js baris 267 (pindah verbatim, tanpa ubah logika) ---
function categoryNames(){return [...new Set(S.products.map(product=>product.cat).filter(Boolean))]}

