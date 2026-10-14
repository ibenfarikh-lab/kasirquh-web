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

// --- Tahap 5: konstanta + fungsi prefs pelanggan (pindah verbatim dari js/app.js) ---
var CUSTOMER_PREFS_KEY='kasirquh-customer-prefs';
// --- dari js/app.js baris 90 (pindah verbatim, Tahap 5) ---
function saveCustomerPrefs(){
  try{
    localStorage.setItem(CUSTOMER_PREFS_KEY,JSON.stringify({
      theme:S.customerTheme||'light',
      density:($('#customer')&&$('#customer').dataset.density)||'compact',
      sound:S.soundSettings||{order:'system',promo:'system',chat:'system'},
      vibrate:!!S.vibrateWhenSilent
    }));
  }catch(e){}
}
// --- dari js/app.js baris 100 (pindah verbatim, Tahap 5) ---
function loadCustomerPrefs(){
  try{
    var raw=localStorage.getItem(CUSTOMER_PREFS_KEY);
    if(!raw)return;
    var p=JSON.parse(raw);
    if(p.theme&&['light','dark','oled','system'].indexOf(p.theme)>=0)S.customerTheme=p.theme;
    if(p.density)$('#customer').dataset.density=p.density;
    if(p.sound){['order','promo','chat'].forEach(function(k){if(typeof p.sound[k]==='string')S.soundSettings[k]=p.sound[k]})}
    if(typeof p.vibrate==='boolean')S.vibrateWhenSilent=p.vibrate;
    // Sinkronkan tampilan tombol aktif
    $$('[data-customer-theme]').forEach(function(b){b.classList.toggle('active',b.dataset.customerTheme===S.customerTheme)});
    $$('[data-density-choice]').forEach(function(b){b.classList.toggle('active',b.dataset.densityChoice===($('#customer').dataset.density||'compact'))});
    applyRoleTheme('customer');
    syncSoundControls();
  }catch(e){}
}
