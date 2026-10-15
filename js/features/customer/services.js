/* KasirQuh Web — js/features/customer/services.js
 * Layanan warga: rutin, hajatan, patungan, grosir, pantau harga, AI.
 * Diekstrak verbatim dari js/app.js (Tahap 3 modularisasi). */

// --- dari js/app.js baris 331 (pindah verbatim, tanpa ubah logika) ---
function aiReply(text){const t=text.toLowerCase(),minyak=S.products.find(p=>p.name.toLowerCase().includes('minyak')),cheapest=S.products.slice().sort((a,b)=>a.price-b.price)[0];let r;if(t.includes('minyak')&&minyak)r=`${minyak.name} tersedia ${minyak.stock} ${minyak.unit||'pcs'}, harganya ${money(minyak.price)}.`;else if(t.includes('murah')&&cheapest)r=`${cheapest.name} paling murah, ${money(cheapest.price)}.`;else if(t.includes('promo'))r=S.coinProgramEnabled?'Koin Warga aktif dan bisa ditukar saat checkout.':'Program Koin Warga sedang dimatikan warung.';else if(t.includes('buka')||t.includes('tutup'))r=S.isOpenNow?'Warung sedang buka.':'Warung sedang tutup.';else r='Maaf, aku belum paham. Coba tanya soal stok, harga termurah, promo, atau jam buka.';$('#aiMessage').textContent=r}


// --- dari js/app.js baris 365 (pindah verbatim, tanpa ubah logika) ---
function getBudgetEligible(){return S.products.filter(p=>p.isActive!==false&&p.stock>0&&p.price>0&&p.budgetEligible!==false)}


// --- dari js/app.js baris 385 (pindah verbatim, tanpa ubah logika) ---
function previewBudgetV2(bundle){
  S.currentBudgetCart=bundle;
  const rows=Object.entries(bundle).filter(([id])=>S.products.some(p=>p.id===id));
  const total=rows.reduce((s,[id,q])=>s+S.products.find(p=>p.id===id).price*q,0);
  const amount=Number(($('#budgetAmountInput').value||'').replace(/\D/g,''))||0;
  $('#budgetPreview').innerHTML=rows.length?rows.map(([id,q])=>{const p=S.products.find(x=>x.id===id);return `<div><span>${escapeHtml(p.name)} ×${q}</span><b>${money(p.price*q)}</b></div>`}).join('')+`<div><span>Total</span><b>${money(total)}</b></div><div><span>Sisa budget</span><b>${money(amount-total)}</b></div>`:'<div><span>Pilih produk untuk melihat hitungan.</span><b>—</b></div>';
  $('#applyBudget').disabled=!rows.length;
}


// --- dari js/app.js baris 413 (pindah verbatim, tanpa ubah logika) ---
function routineList(){return Array.isArray(S.routines)?S.routines:[]}


// --- dari js/app.js baris 414 (pindah verbatim, tanpa ubah logika) ---
function routineNextDate(routine){const now=new Date();if(routine.interval!=='mingguan'){const next=new Date(now);next.setDate(next.getDate()+1);return next}const days=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];let diff=(days.indexOf(routine.day)-now.getDay()+7)%7;if(diff===0)diff=7;const next=new Date(now);next.setDate(next.getDate()+diff);return next}


// --- dari js/app.js baris 415 (pindah verbatim, tanpa ubah logika) ---
function saveRoutines(list){S.routines=list;renderRoutines();storePromise('saveCustomerDoc',{routines:list}).catch(error=>{if(error&&error.code!=='OFFLINE')toast('Gagal menyimpan ke akun · sesi ini saja')})}


// --- dari js/app.js baris 416 (pindah verbatim, tanpa ubah logika) ---
function renderRoutines(){const box=$('#routineList');if(!box)return;const list=routineList(),fmt=date=>new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'short'}).format(date);if(!list.length){box.innerHTML='<div class="empty-note">Belum ada jadwal rutin.<br><small>Buat jadwal di atas — tersimpan di akunmu.</small></div>';return}box.innerHTML=list.map((routine,index)=>`<article class="service-row"><div><h3>${escapeHtml(routine.name)}</h3><p>${routine.interval==='mingguan'?'Mingguan · '+escapeHtml(routine.day):'Harian'} · berikut: ${fmt(routineNextDate(routine))}</p></div><button data-remove-routine="${index}">Hapus</button></article>`).join('');$$('[data-remove-routine]').forEach(b=>b.onclick=()=>saveRoutines(routineList().filter((_,index)=>index!==Number(b.dataset.removeRoutine))))}


// --- dari js/app.js baris 433 (pindah verbatim, tanpa ubah logika) ---
function priceWatchList(){return Array.isArray(S.priceAlerts)?S.priceAlerts:[]}


// --- dari js/app.js baris 434 (pindah verbatim, tanpa ubah logika) ---
function priceWatching(id){return priceWatchList().some(watch=>watch.productId===id)}


// --- dari js/app.js baris 435 (pindah verbatim, tanpa ubah logika) ---
function savePriceAlerts(list){S.priceAlerts=list;if(S.currentDetail)$('#detailAlert').textContent=priceWatching(S.currentDetail)?'Harga dipantau':'Pantau harga';renderPriceAlerts();storePromise('saveCustomerDoc',{priceAlerts:list}).catch(error=>{if(error&&error.code!=='OFFLINE')toast('Gagal menyimpan ke akun · sesi ini saja')})}


// --- dari js/app.js baris 436 (pindah verbatim, tanpa ubah logika) ---
function renderPriceAlerts(){const box=$('#priceAlertList'),rows=priceWatchList().map(watch=>({watch:watch,product:S.products.find(p=>p.id===watch.productId)})).filter(row=>row.product);if(!rows.length){box.innerHTML='<div class="empty-note">Belum ada barang dipantau.<br><small>Buka detail produk lalu pilih “Pantau harga”.</small></div>';return}box.innerHTML=rows.map(row=>{const diff=row.product.price-row.watch.priceAtWatch,state=diff<0?'Turun':diff>0?'Naik':'Tetap';return `<article class="service-row"><img src="${row.product.img}" alt="${row.product.name}" style="width:36px;height:36px;object-fit:contain"><div><h3>${escapeHtml(row.product.name)}</h3><p>Saat ditandai ${money(row.watch.priceAtWatch)} · kini ${money(row.product.price)} · <b>${state}</b></p></div><button data-remove-alert="${row.watch.productId}">Hapus</button></article>`}).join('');$$('[data-remove-alert]').forEach(b=>b.onclick=()=>savePriceAlerts(priceWatchList().filter(watch=>watch.productId!==b.dataset.removeAlert)))}


// --- dari js/app.js baris 641 (pindah verbatim, tanpa ubah logika) ---
function findProductByKeywords(keywords){const list=(keywords||[]).map(k=>String(k).toLowerCase());return S.products.find(p=>p.isActive!==false&&p.stock>0&&list.some(k=>p.name.toLowerCase().indexOf(k)>=0))}


// --- dari js/app.js baris 758 (pindah verbatim, tanpa ubah logika) ---
function renderRutinPackages(){
  const grid=document.querySelector('#rutinModal .plan-grid');if(!grid)return;
  const list=S.rutinPackages||[];
  if(!list.length) return;
  grid.innerHTML=list.map((p,i)=>`<button class="plan-card routine-plan${i===0?' active':''}" data-rutin-pkg="${p.id}"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.description||'')}</small><strong>Ikut harga katalog</strong></button>`).join('');
  grid.querySelectorAll('[data-rutin-pkg]').forEach(b=>b.onclick=()=>{
    grid.querySelectorAll('.routine-plan').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');S.routineChoice=b.dataset.rutinPkg;
  });
  if(list.length)S.routineChoice=list[0].id;
}


// --- dari js/app.js baris 770 (pindah verbatim, tanpa ubah logika) ---
function renderHajatanPackages(){
  const grid=document.querySelector('#hajatanModal .plan-grid');if(!grid)return;
  const list=S.hajatanPackages||[];
  if(!list.length) return; // fallback ke paket default di HTML
  grid.innerHTML=list.map((p,i)=>`<button class="plan-card hajatan-plan${i===0?' active':''}" data-hajatan-pkg="${p.id}"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.description||'')}</small><strong>Ikut harga katalog</strong></button>`).join('');
  grid.querySelectorAll('[data-hajatan-pkg]').forEach(b=>b.onclick=()=>{
    grid.querySelectorAll('.hajatan-plan').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');S.hajatanChoice=b.dataset.hajatanPkg;
  });
  if(list.length)S.hajatanChoice=list[0].id;
}

