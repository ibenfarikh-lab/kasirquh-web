/* KasirQuh Web — js/features/customer/cart.js
 * Keranjang belanja (pure calc).
 * Diekstrak verbatim dari js/app.js (Tahap 3 modularisasi). */

// --- dari js/app.js baris 301 (pindah verbatim, tanpa ubah logika) ---
function cartTotals(){const entries=Object.entries(S.customerCart).filter(x=>x[1]>0);let gross=0,total=0;entries.forEach(([id,q])=>{const p=S.products.find(x=>x.id===id);if(!p)return;gross+=p.price*q;total+=Store.customerUnitPrice(p,q)*q});return {gross,total,discount:gross-total}}

