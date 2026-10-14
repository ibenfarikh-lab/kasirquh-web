/* KasirQuh Web — js/shared/audio.js
 * Audio notifikasi & pengaturan suara (Web Audio API).
 * Diekstrak verbatim dari js/app.js (Tahap 2 modularisasi). */


// --- dari js/app.js baris 49 (pindah verbatim, tanpa ubah logika) ---
function tone(ctx,frequency,start,duration,type,gain){const osc=ctx.createOscillator(),amp=ctx.createGain();osc.type=type||'sine';osc.frequency.setValueAtTime(frequency,start);amp.gain.setValueAtTime(0.0001,start);amp.gain.exponentialRampToValueAtTime(gain||0.055,start+.015);amp.gain.exponentialRampToValueAtTime(0.0001,start+duration);osc.connect(amp);amp.connect(ctx.destination);osc.start(start);osc.stop(start+duration+.02)}

// --- dari js/app.js baris 67 (pindah verbatim, tanpa ubah logika) ---
function ensureAudio(){var AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)return null;if(!S.audioContext){try{S.audioContext=new AudioCtor()}catch(e){return null}}if(S.audioContext.state==='suspended'){try{S.audioContext.resume()}catch(e){}}return S.audioContext}

// --- dari js/app.js baris 69 (pindah verbatim, tanpa ubah logika) ---
function playNotification(kind,mode,announce){
  if(mode==='silent'){
    if(S.vibrateWhenSilent&&navigator.vibrate){
      var pattern=kind==='order'?[70,45,70]:kind==='promo'?[45,35,45,35,45]:[55];
      try{navigator.vibrate(pattern)}catch(e){}
    }
    if(announce!==false)toast(S.vibrateWhenSilent?'Mode hening · getar':'Mode hening · tanpa suara');
    return;
  }
  var ctx=ensureAudio();
  if(!ctx){if(announce!==false)toast('Audio tidak tersedia di perangkat ini');return}
  var doPlay=function(){
    if(ctx.state==='suspended'){
      if(announce!==false)toast('Ketuk layar sekali lalu coba lagi');
      return;
    }
    try{
      var now=ctx.currentTime+.06;
      if(mode==='system'){tone(ctx,720,now,.15,'sine',.22);tone(ctx,940,now+.17,.2,'sine',.2)}
      else if(kind==='order'){tone(ctx,523,now,.16,'sine',.25);tone(ctx,659,now+.15,.16,'sine',.25);tone(ctx,784,now+.3,.28,'sine',.22)}
      else if(kind==='promo'){tone(ctx,660,now,.12,'triangle',.22);tone(ctx,990,now+.13,.2,'triangle',.2)}
      else if(kind==='chat'){tone(ctx,800,now,.12,'sine',.3);tone(ctx,1000,now+.15,.12,'sine',.3)}
      else{tone(ctx,880,now,.1,'sine',.22);tone(ctx,880,now+.16,.1,'sine',.22)}
      if(announce!==false)toast(mode==='mimi'?'Bunyi Khas Mimi diputar':'Bunyi pratinjau diputar');
    }catch(err){
      if(announce!==false)toast('Gagal bunyi: '+(err&&err.message?err.message:'error'));
    }
  };
  if(ctx.state==='suspended'){
    try{ctx.resume().then(doPlay).catch(doPlay)}catch(e){doPlay()}
  }else{doPlay()}
}

// --- dari js/app.js baris 50 (pindah verbatim, tanpa ubah logika) ---
function syncSoundControls(){
  $$('[data-sound-select]').forEach(function(s){s.value=S.soundSettings[s.dataset.soundSelect]||'system'});
  $$('[data-vibrate-toggle]').forEach(function(b){
    b.setAttribute('aria-pressed',String(!!S.vibrateWhenSilent));
    b.textContent='Getar saat mode hening \u00b7 '+(S.vibrateWhenSilent?'Aktif':'Nonaktif');
  });
  $$('.feature-sheet').forEach(updateSoundPresetState);
}

// --- dari js/app.js baris 58 (pindah verbatim, tanpa ubah logika) ---
function updateSoundPresetState(sheet){
  if(!sheet||typeof sheet.querySelectorAll!=='function')return;
  var selects=sheet.querySelectorAll('[data-sound-select]');
  var presets=sheet.querySelectorAll('[data-sound-preset]');
  if(!selects.length||!presets.length)return;
  var first=selects[0].value,uniform=true;
  selects.forEach(function(s){if(s.value!==first)uniform=false});
  presets.forEach(function(b){b.classList.toggle('active',uniform&&b.dataset.soundPreset===first)});
}

// --- dari js/app.js baris 402 (pindah verbatim, tanpa ubah logika) ---
function collectSoundSettings(sheet){sheet.querySelectorAll('[data-sound-select]').forEach(s=>S.soundSettings[s.dataset.soundSelect]=s.value);syncSoundControls()}
