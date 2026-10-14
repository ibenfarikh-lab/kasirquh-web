/* KasirQuh Web — js/shared/theme.js
 * Tema peran (customer/admin) & preferensi pelanggan.
 * Diekstrak verbatim dari js/app.js (Tahap 2 modularisasi). */


// --- dari js/app.js baris 46 (pindah verbatim, tanpa ubah logika) ---
function resolvedTheme(choice){if(choice==='oled')return'dark';return choice==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):choice}

// --- dari js/app.js baris 47 (pindah verbatim, tanpa ubah logika) ---
function applyRoleTheme(role){const choice=role==='admin'?S.adminTheme:S.customerTheme,actual=resolvedTheme(choice),surface=$('#'+role);surface.dataset.themeMode=choice;surface.dataset.renderTheme=actual;if(S.activeRole===role){document.body.dataset.uiTheme=actual;document.documentElement.style.colorScheme=actual}}

// --- dari js/app.js baris 48 (pindah verbatim, tanpa ubah logika) ---
function activateRoleTheme(role){S.activeRole=role;applyRoleTheme(role)}

// --- dari js/app.js baris 406 (pindah verbatim, tanpa ubah logika) ---
function toggleSimpleSetting(button,onText,offText){const on=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(on));button.textContent=on?onText:offText;return on}

// --- dari js/app.js baris 407 (pindah verbatim, tanpa ubah logika) ---
function syncNavMotionToggle(){const on=S.navMotion!==false,btn=$('#navAnimationToggle');if(btn){btn.setAttribute('aria-pressed',String(on));btn.textContent=on?'NYALA':'MATI'}const admin=$('#admin');if(admin)admin.dataset.navMotion=on?'on':'off'}
