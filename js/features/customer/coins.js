/* KasirQuh Web — js/features/customer/coins.js
 * Koin Warga: saldo, misi, check-in harian.
 * Diekstrak verbatim dari js/app.js (Tahap 3 modularisasi). */

// --- dari js/app.js baris 231 (pindah verbatim, tanpa ubah logika) ---
function runDailyCheckin(){if(S.isGuest||S.dailyCheckedIn||!S.activeCustomerId||!S.myCustomerDoc)return;const statusEl=$('#checkinStatus');if(S.myCustomerDoc.lastCheckin===S.todayKey){S.dailyCheckedIn=true;if(statusEl)statusEl.textContent='Sudah diambil';return}if(!(S.coinProgramEnabled&&S.coinEvents.checkin&&S.coinRewards.checkin>0)){S.dailyCheckedIn=true;if(statusEl)statusEl.textContent='Nonaktif';return}Store.grantCoins(S.activeCustomerId,S.coinRewards.checkin,{reason:'harian',label:'Check-in harian',detail:'Bonus hari ini'}).then(()=>{S.dailyCheckedIn=true;if(statusEl)statusEl.textContent='Sudah diambil';setTimeout(()=>{celebrate('coin');toast('Bonus harian · +'+S.coinRewards.checkin+' Koin Warga')},180)}).catch(error=>{if(!error||error.code!=='OFFLINE')toast(error&&error.message?error.message:'Bonus harian gagal · bisa dicoba lagi')})}


// --- dari js/app.js baris 353 (pindah verbatim, tanpa ubah logika) ---
function updateCoinUI(){const bal=S.coinBalance||0,txt=bal>0?bal.toLocaleString('id-ID')+' koin':'Belum ada koin',rp=bal>0?'Rp'+(bal*(S.coinValue||1)).toLocaleString('id-ID'):'Belum ada koin';document.querySelectorAll('.coin-chip span:last-child').forEach(el=>el.textContent=txt);const hc=$('#headCoinText');if(hc)hc.textContent=bal>0?bal.toLocaleString('id-ID'):'0';const cb=$('#coinBalance');if(cb)cb.textContent=txt;const cr=$('#coinRupiahValue');if(cr)cr.textContent=rp;const mb=$('#missionCoinBalance');if(mb)mb.textContent=txt;}


// --- dari js/app.js baris 637 (pindah verbatim, tanpa ubah logika) ---
function weekKeyOf(date){const t=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())),dow=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-dow+3);const first=new Date(Date.UTC(t.getUTCFullYear(),0,4));return t.getUTCFullYear()+'-W'+String(Math.ceil(((t-first)/86400000+1)/7)).padStart(2,'0')}


// --- dari js/app.js baris 638 (pindah verbatim, tanpa ubah logika) ---
function claimMissionCoins(detailLabel,claimKey){if(!S.coinProgramEnabled||!S.coinEvents.mission||!S.coinRewards.mission)return toast('Event misi sedang dimatikan admin');const done=()=>{updateCoinUI();renderMissions();celebrate('coin');toast(S.coinRewards.mission+' Koin Warga masuk')};if(S.activeCustomerId&&!S.isGuest){Store.grantCoins(S.activeCustomerId,S.coinRewards.mission,{reason:'misi',label:'Hadiah misi',detail:detailLabel,claimKey:claimKey}).then(done).catch(error=>{if(!error||error.code!=='OFFLINE')toast(error&&error.message?error.message:'Bonus gagal')})}}


// --- dari js/app.js baris 639 (pindah verbatim, tanpa ubah logika) ---
function currentCustomerOrders(){return (S.onlineOrders||[]).filter(o=>o.customerId===S.activeCustomerId)}


// --- dari js/app.js baris 640 (pindah verbatim, tanpa ubah logika) ---
function renderMissions(){const mine=currentCustomerOrders().slice().sort((a,b)=>String(b._dateKey||'').localeCompare(String(a._dateKey||''))),today=new Date(S.todayKey+'T12:00:00+07:00'),wk=weekKeyOf(today),n=Math.min(3,mine.filter(o=>{const d=new Date((o._dateKey||S.todayKey)+'T12:00:00+07:00'),days=(today-d)/86400000;return days>=0&&days<7}).length),countEl=$('#missionShopCount'),bar=$('#missionShopBar'),shopBtn=$('#missionShopBtn');if(countEl)countEl.textContent=n+'/3';if(bar)bar.style.width=Math.round(n/3*100)+'%';const shopDetail='Misi Belanja 3 kali · '+wk,shopKey='misi_belanja3_'+wk,missionClaims=(S.myCustomerDoc&&S.myCustomerDoc.missionClaims)||{},shopClaimed=S.isGuest?(S.coinHistory||[]).some(x=>x.kind==='income'&&x.detail&&x.detail.indexOf(shopDetail)>=0):(!!missionClaims[shopKey]||(S.coinHistory||[]).some(x=>x.kind==='income'&&x.detail&&x.detail.indexOf(shopDetail)>=0));if(shopBtn){shopBtn.disabled=!(n>=3&&!shopClaimed);shopBtn.textContent=shopClaimed?'Sudah diambil':'+'+S.coinRewards.mission+' koin';shopBtn.onclick=()=>claimMissionCoins(shopDetail,shopKey)}const priorIds=new Set();mine.slice(1).forEach(o=>(o.items||[]).forEach(it=>{if(it[3])priorIds.add(it[3])}));const latestIds=((mine[0]||{}).items||[]).map(it=>it[3]).filter(Boolean),newThisOrder=latestIds.some(id=>!priorIds.has(id)),stateEl=$('#missionNewState');if(stateEl)stateEl.textContent=newThisOrder?'Selesai':'Belum ada';const newDetail='Misi Coba produk baru',newKey='misi_coba_produk_baru',newClaimed=S.isGuest?(S.coinHistory||[]).some(x=>x.kind==='income'&&x.detail&&x.detail.indexOf(newDetail)>=0):(!!missionClaims[newKey]||(S.coinHistory||[]).some(x=>x.kind==='income'&&x.detail&&x.detail.indexOf(newDetail)>=0)),claimBtn=$('#claimMissionBtn');if(claimBtn){claimBtn.disabled=!(newThisOrder&&!newClaimed&&S.coinProgramEnabled&&S.coinEvents.mission);claimBtn.textContent=newClaimed?'Sudah diambil':(!newThisOrder?'Belum tersedia':(S.coinEvents.mission?'Ambil +'+S.coinRewards.mission+' koin':'Misi dimatikan'));claimBtn.onclick=()=>claimMissionCoins(newDetail,newKey)}}


/* --- Game Tangkap Diskon → Misi Koin (2026-10-17, uji coba) ---
 * Alur: tile di Misi Koin → modal game (iframe) → game kirim skor mentah
 * via postMessage → aplikasi utama yang hitung koin (1000 poin = 1) →
 * tombol klaim → Store.grantGameCoins (transaksi, cap 500 koin/hari). */
var GAME_POINTS_PER_COIN=1000,GAME_MAX_COINS_DAY=500,GAME_SESSION_MAX_POINTS=60000,GAME_MIN_DURATION_MS=20000;
function onTangkapDiskonScore(d){
  var points=Math.max(0,Math.floor(Number(d&&d.points)||0));
  var durationMs=Math.max(0,Number(d&&d.durationMs)||0);
  var panel=$('#gameClaimPanel');if(!panel)return;
  var scoreEl=$('#gameScoreLabel'),coinEl=$('#gameCoinLabel'),claimBtn=$('#gameClaimBtn'),noteEl=$('#gameClaimNote');
  var loggedIn=S.activeCustomerId&&!S.isGuest;
  var coins=Math.floor(points/GAME_POINTS_PER_COIN);
  var sane=points>0&&points<=GAME_SESSION_MAX_POINTS&&durationMs>=GAME_MIN_DURATION_MS;
  S.gamePending=sane?{points:points,coins:coins}:null;
  if(scoreEl)scoreEl.textContent=points.toLocaleString('id-ID')+' poin';
  if(!sane){
    if(coinEl)coinEl.textContent='Skor tidak wajar.';
    if(claimBtn)claimBtn.hidden=true;
    if(noteEl)noteEl.textContent='Mainkan gamenya sampai selesai ya.';
  }else if(!loggedIn){
    if(coinEl)coinEl.textContent='= '+coins+' koin';
    if(claimBtn)claimBtn.hidden=true;
    if(noteEl)noteEl.textContent='Login/daftar dulu untuk klaim koinmu.';
  }else if(coins<=0){
    if(coinEl)coinEl.textContent='Belum cukup untuk 1 koin (butuh 1000 poin).';
    if(claimBtn)claimBtn.hidden=true;
    if(noteEl)noteEl.textContent='Coba lagi — makin banyak diskon tertangkap, makin banyak poin.';
  }else{
    if(coinEl)coinEl.textContent='= '+coins+' koin';
    if(claimBtn){claimBtn.hidden=false;claimBtn.textContent='Klaim +'+coins+' koin';}
    if(noteEl)noteEl.textContent='Maksimal 500 koin/hari dari game.';
  }
  panel.hidden=false;
}
window.addEventListener('message',function(e){
  if(e.origin!==location.origin)return;
  var d=e.data;if(!d||d.type!=='tangkapDiskonScore')return;
  onTangkapDiskonScore(d);
});

/* --- Game Buru Diskon → Misi Koin (2026-10-17, dari artefak) ---
 * Pola sama dengan Tangkap Diskon: tile → modal (iframe) → postMessage
 * skor → aplikasi hitung koin (1000 poin = 1) → klaim via grantGameCoins
 * (kuota 500/hari DIGABUNG dengan Tangkap Diskon). */
function onBuruDiskonScore(d){
  var points=Math.max(0,Math.floor(Number(d&&d.points)||0));
  var durationMs=Math.max(0,Number(d&&d.durationMs)||0);
  var panel=$('#buruClaimPanel');if(!panel)return;
  var scoreEl=$('#buruScoreLabel'),coinEl=$('#buruCoinLabel'),claimBtn=$('#buruClaimBtn'),noteEl=$('#buruClaimNote');
  var loggedIn=S.activeCustomerId&&!S.isGuest;
  var coins=Math.floor(points/GAME_POINTS_PER_COIN);
  var sane=points>0&&points<=GAME_SESSION_MAX_POINTS&&durationMs>=GAME_MIN_DURATION_MS;
  S.buruPending=sane?{points:points,coins:coins}:null;
  if(scoreEl)scoreEl.textContent=points.toLocaleString('id-ID')+' poin';
  if(!sane){
    if(coinEl)coinEl.textContent='Skor tidak wajar.';
    if(claimBtn)claimBtn.hidden=true;
    if(noteEl)noteEl.textContent='Mainkan gamenya sampai selesai ya.';
  }else if(!loggedIn){
    if(coinEl)coinEl.textContent='= '+coins+' koin';
    if(claimBtn)claimBtn.hidden=true;
    if(noteEl)noteEl.textContent='Login/daftar dulu untuk klaim koinmu.';
  }else if(coins<=0){
    if(coinEl)coinEl.textContent='Belum cukup untuk 1 koin (butuh 1000 poin).';
    if(claimBtn)claimBtn.hidden=true;
    if(noteEl)noteEl.textContent='Coba lagi — tangkap yang berlabel diskon.';
  }else{
    if(coinEl)coinEl.textContent='= '+coins+' koin';
    if(claimBtn){claimBtn.hidden=false;claimBtn.textContent='Klaim +'+coins+' koin';}
    if(noteEl)noteEl.textContent='Maksimal 500 koin/hari dari game.';
  }
  panel.hidden=false;
}
window.addEventListener('message',function(e){
  if(e.origin!==location.origin)return;
  var d=e.data;if(!d||d.type!=='buruDiskonScore')return;
  onBuruDiskonScore(d);
});
function claimBuruDiskonCoins(){
  var p=S.buruPending;if(!p||!p.coins)return;
  if(!S.coinProgramEnabled){toast('Program koin sedang dimatikan admin');return;}
  var btn=$('#buruClaimBtn');if(btn)btn.disabled=true;
  Store.grantGameCoins(S.activeCustomerId,p.coins,{points:p.points,reason:'game_buru_diskon',label:'Buru Diskon',dateField:'buruGameCoinsDate',todayField:'buruGameCoinsToday'}).then(function(res){
    if(btn)btn.disabled=false;
    if(res&&res.granted>0){
      S.buruPending=null;var panel=$('#buruClaimPanel');if(panel)panel.hidden=true;
      updateCoinUI();renderMissions();celebrate('coin');
      toast('+'+res.granted+' Koin Warga'+(res.capped?' (batas 500/hari tercapai)':''));
    }else{toast('Batas 500 koin game hari ini sudah tercapai');}
  }).catch(function(error){
    if(btn)btn.disabled=false;
    if(!error||error.code!=='OFFLINE')toast(error&&error.message?'Klaim gagal':error.message);
  });
}
function renderBuruDiskonTile(){
  var prog=$('#buruDayProgress'),doc=S.myCustomerDoc;
  if(prog){var got=(doc&&doc.buruGameCoinsDate===S.todayKey)?Math.max(0,Math.floor(Number(doc.buruGameCoinsToday)||0)):0;
    prog.textContent='Hari ini: '+got+'/'+GAME_MAX_COINS_DAY+' koin';}
  var claimBtn=$('#buruClaimBtn');
  if(claimBtn&&!claimBtn.dataset.bound){claimBtn.dataset.bound='1';claimBtn.onclick=claimBuruDiskonCoins;}
  var replayBtn=$('#buruReplayBtn');
  if(replayBtn&&!replayBtn.dataset.bound){replayBtn.dataset.bound='1';replayBtn.onclick=function(){
    var p=$('#buruClaimPanel');if(p)p.hidden=true;var f=$('#buruGameFrame');if(f)f.src='games/buru-diskon.html?v=20261020ah';};}
}
function claimTangkapDiskonCoins(){
  var p=S.gamePending;if(!p||!p.coins)return;
  if(!S.coinProgramEnabled){toast('Program koin sedang dimatikan admin');return;}
  var btn=$('#gameClaimBtn');if(btn)btn.disabled=true;
  Store.grantGameCoins(S.activeCustomerId,p.coins,{points:p.points}).then(function(res){
    if(btn)btn.disabled=false;
    if(res&&res.granted>0){
      S.gamePending=null;var panel=$('#gameClaimPanel');if(panel)panel.hidden=true;
      updateCoinUI();renderMissions();celebrate('coin');
      toast('+'+res.granted+' Koin Warga'+(res.capped?' (batas 500/hari tercapai)':''));
    }else{toast('Batas 500 koin game hari ini sudah tercapai');}
  }).catch(function(error){
    if(btn)btn.disabled=false;
    if(!error||error.code!=='OFFLINE')toast(error&&error.message?'Klaim gagal':error.message);
  });
}
function renderGameTile(){
  // Tombol #playGameBtn membuka #gameModal secara deklaratif (data-open-sheet);
  // di sini hanya: progres harian + binding tombol klaim/main-lagi di dalam modal game.
  var prog=$('#gameDayProgress'),doc=S.myCustomerDoc;
  if(prog){var got=(doc&&doc.gameCoinsDate===S.todayKey)?Math.max(0,Math.floor(Number(doc.gameCoinsToday)||0)):0;
    prog.textContent='Hari ini: '+got+'/'+GAME_MAX_COINS_DAY+' koin';}
  var claimBtn=$('#gameClaimBtn');
  if(claimBtn&&!claimBtn.dataset.bound){claimBtn.dataset.bound='1';claimBtn.onclick=claimTangkapDiskonCoins;}
  var replayBtn=$('#gameReplayBtn');
  if(replayBtn&&!replayBtn.dataset.bound){replayBtn.dataset.bound='1';replayBtn.onclick=function(){
    var p=$('#gameClaimPanel');if(p)p.hidden=true;var f=$('#gameFrame');if(f)f.src='games/tangkap-diskon.html?v=20261020ac';};}
}

/* --- Admin: daftar saldo koin pelanggan (di modal Koin Warga) ---
 * Ikut pola native "Ubah saldo koin pelanggan": daftar + ketuk untuk koreksi.
 * S.customerData sudah memuat semua pelanggan (field coins dipetakan). */
function renderCoinCustomerList(){
  var list=$('#coinCustomerList');if(!list)return;
  var q=($('#coinCustomerSearch')&&$('#coinCustomerSearch').value||'').toLowerCase();
  var rows=(S.customerData||[]).filter(function(x){
    return !q||String(x.name||'').toLowerCase().indexOf(q)>=0;
  });
  list.innerHTML=rows.length?rows.map(function(x){
    return '<button class="customer-row" data-open-sheet="adjustCoinModal" data-adjust-coin="'+x.id+'"><span class="avatar">'+escapeHtml(String(x.name||'?').charAt(0))+'</span><span><b>'+escapeHtml(x.name)+'</b><small>'+escapeHtml(x.email||x.wa||'Akun pelanggan')+'</small></span><span class="customer-total">'+Number(x.coins||0).toLocaleString('id-ID')+' koin</span></button>';
  }).join(''):'<div class="notification-empty"><b>Belum ada data pelanggan</b><p>Pelanggan akan tampil setelah pendaftaran disetujui admin.</p></div>';
  list.querySelectorAll('[data-adjust-coin]').forEach(function(b){
    b.onclick=function(){prepareAdjustCoin(b.getAttribute('data-adjust-coin'));};
  });
}
var adjustCoinUid=null;
function prepareAdjustCoin(uid){
  var x=(S.customerData||[]).find(function(c){return c.id===uid;});if(!x)return;
  adjustCoinUid=uid;
  var nm=$('#adjustCoinName'),bl=$('#adjustCoinBalance');
  if(nm)nm.textContent=x.name;
  if(bl)bl.textContent='Saldo: '+Number(x.coins||0).toLocaleString('id-ID')+' koin';
  var am=$('#adjustCoinAmount'),nt=$('#adjustCoinNote'),dr=$('#adjustCoinDir');
  if(am)am.value='';if(nt)nt.value='';if(dr)dr.value='1';
  /* Modal dibuka via data-open-sheet="adjustCoinModal" (delegated handler di app.js);
   * openSheet() tidak global (app.js dibungkus IIFE) jadi tidak dipanggil langsung. */
}

/* ============ RIWAYAT KOIN PELANGGAN (2026-10-18) ============
 * Ikut pola native: ikon +/- lingkaran, label, sub (detail · waktu), nominal.
 * Data dari S.coinHistory (watch coin_ledger milik sendiri). */
function renderCoinHistory(){
  var el=$('#coinHistory');if(!el)return;
  var list=S.coinHistory||[];
  if(!list.length){el.innerHTML='<div class="notification-empty">Belum ada riwayat koin.</div>';return;}
  el.innerHTML=list.map(function(x){
    var plus=x.kind==='income';
    return '<article class="coin-history-row"><span class="coin-history-icon '+(plus?'in':'out')+'">'+(plus?'+':'−')+'</span><span class="coin-history-main"><b>'+escapeHtml(x.label)+'</b><small>'+escapeHtml(x.sub||'')+'</small></span><span class="coin-history-amount '+(plus?'in':'out')+'">'+(plus?'+':'−')+Number(x.amount||0).toLocaleString('id-ID')+'</span></article>';
  }).join('');
}

/* ============ ATURAN PROGRAM (2026-10-18) ============
 * Daftar dibaca dari settingan live (ikut pola native), bukan teks bebas. */
function renderCoinRuleList(){
  var el=$('#coinRuleList');if(!el)return;
  var r=S.coinRewards||{},spendRule=S.coinSpendRule||100,spendReward=S.coinSpendReward||1,redeem=S.coinRedeemPercent||50;
  var items=[
    'Bonus harian: +'+Number(r.checkin||0).toLocaleString('id-ID')+' koin (1x sehari)',
    'Belanja: +'+Number(spendReward).toLocaleString('id-ID')+' koin tiap Rp'+Number(spendRule).toLocaleString('id-ID')+' (otomatis)',
    'Misi koin: +'+Number(r.mission||0).toLocaleString('id-ID')+' koin per misi',
    'Tebak harga: +'+Number(r.guess||0).toLocaleString('id-ID')+' koin (1x sehari)',
    'Tukar: maks '+Number(redeem).toLocaleString('id-ID')+'% dari total belanja'
  ];
  el.innerHTML=items.map(function(t){return '<li>'+escapeHtml(t)+'</li>';}).join('');
}
