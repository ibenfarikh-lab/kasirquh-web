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

