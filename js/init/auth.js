/* KasirQuh Web — js/init/auth.js
 * Fungsi auth yang mandiri (diekstrak verbatim Tahap 5).
 * CATATAN: enterAdminSession, openAdminAccess, bioLoginFlow, finishCustomerLogin
 * tetap di js/app.js — butuh go()/openSheet() yang bertabrakan/tetap di IIFE.
 * Lihat laporan Tahap 5. */

// --- dari js/app.js baris 220 (pindah verbatim, Tahap 5) ---
function setAuthTab(name){$$('[data-auth-tab]').forEach(button=>{const active=button.dataset.authTab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});$('#loginAuthPanel').classList.toggle('active',name==='login');$('#registerAuthPanel').classList.toggle('active',name==='register');$('#loginAuthStatus').textContent='';$('#registerAuthStatus').textContent=''}
