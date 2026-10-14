/* KasirQuh Web — js/shared/store-adapter.js
 * Adapter aman ke kontrak Store (S, FB).
 * Diekstrak verbatim dari js/app.js (Tahap 2 modularisasi). */


// --- dari js/app.js baris 6 (pindah verbatim, tanpa ubah logika) ---
/* Panggilan aman ke kontrak Store: bila fungsi belum tersedia, kembalikan promise
 * yang ditolak jujur (bukan crash) agar halaman tetap hidup. */
function storePromise(name){const args=[].slice.call(arguments,1);if(typeof Store[name]!=='function')return Promise.reject({code:'STORE_UNAVAILABLE',message:'Layanan '+name+' belum tersedia'});try{const r=Store[name].apply(Store,args);return r&&typeof r.then==='function'?r:Promise.resolve(r)}catch(e){return Promise.reject(e)}}

// --- dari js/app.js baris 7 (pindah verbatim, tanpa ubah logika) ---
function storeVoid(name){const args=[].slice.call(arguments,1);if(typeof Store[name]!=='function')return false;try{Store[name].apply(Store,args)}catch(e){console.error('storeVoid gagal · '+name,e)}return true}
