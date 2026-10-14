/* KasirQuh Web — js/features/customer/home.js
 * Beranda pelanggan: kartu produk mini, kabar, promo, kilat.
 * Diekstrak verbatim dari js/app.js (Tahap 3 modularisasi). */

// --- dari js/app.js baris 148 (pindah verbatim, tanpa ubah logika) ---
function updatePremiumHeader(){const h=new Date().getHours(),greet=h<11?'Selamat pagi':h<15?'Selamat siang':h<19?'Selamat sore':'Selamat malam',g=$('#timeGreeting');if(g&&!S.isGuest)g.textContent=greet;const openT=(S.storeSettings&&S.storeSettings.openTime)||'06:00',closeT=(S.storeSettings&&S.storeSettings.closeTime)||'21:00',toMin=t=>{const m=String(t).match(/(\d{1,2}):(\d{2})/);return m?(Number(m[1])*60+Number(m[2])):null},now=new Date(),cur=now.getHours()*60+now.getMinutes(),oMin=toMin(openT),cMin=toMin(closeT),open=oMin!==null&&cMin!==null?(oMin<=cMin?(cur>=oMin&&cur<cMin):(cur>=oMin||cur<cMin)):true,badge=$('#storeStatusBadge');if(badge){badge.hidden=false;badge.textContent=open?'● BUKA':'● TUTUP';badge.classList.toggle('closed',!open)}}


// --- dari js/app.js baris 170 (pindah verbatim, tanpa ubah logika) ---
function initKabarCarousel(){
try{
var track=document.getElementById('kabarTrack');
if(!track)return;
var dots=Array.prototype.slice.call(document.querySelectorAll('.kabar-dot'));
if(!dots.length)return;
var idx=0;
function kabarGo(i){
idx=i;
track.style.transform='translateX(-'+(i*100)+'%)';
for(var j=0;j<dots.length;j++){dots[j].classList.toggle('active',j===i);}
}
for(var k=0;k<dots.length;k++){
(function(n){dots[n].addEventListener('click',function(e){e.preventDefault();kabarGo(n);});})(k);
}
setInterval(function(){kabarGo((idx+1)%dots.length);},5000);
}catch(e){}
}


// --- dari js/app.js baris 251 (pindah verbatim, tanpa ubah logika) ---
function productMini(p,kind,opt){opt=opt||{};const qty=opt.qty||1,label=opt.label||p.short,price=p.price*qty,promo=opt.promo===false?false:p.promo,outOfStock=(p.stock||0)<=0;return `<article class="${kind}-card" data-detail="${p.id}" tabindex="0" role="button" aria-label="Lihat detail ${escapeHtml(label)}">${promo?'<span class="promo-flag">PROMO</span>':''}${outOfStock?'<span class="promo-flag" style="background:#999">HABIS</span>':''}<img src="${p.img}" alt="${escapeHtml(label)}"><h3>${escapeHtml(label)}</h3><div class="price">${money(price)}</div>${opt.meta?`<small class="home-data-note">${escapeHtml(opt.meta)}</small>`:''}<button class="tiny-add" data-add-home="${p.id}" data-home-qty="${qty}" aria-label="Tambah ${escapeHtml(label)}"${outOfStock?' disabled style="opacity:.4"':''}>+</button></article>`}


// --- dari js/app.js baris 265 (pindah verbatim, tanpa ubah logika) ---
function purchaseAgeLabel(dateKey){const today=new Date(S.todayKey+'T12:00:00+07:00'),purchaseDate=new Date(dateKey+'T12:00:00+07:00'),days=Math.max(0,Math.round((today-purchaseDate)/86400000));return days===0?'Dibeli hari ini':days===1?'Dibeli kemarin':'Dibeli '+days+' hari lalu'}


// --- dari js/app.js baris 355 (pindah verbatim, tanpa ubah logika) ---
function syncHomeSectionLayout(){const secs=S.homeSections||{};['restock','popular','recipe'].forEach(key=>{const cfg=secs[key]||{show:true,order:1},section=document.querySelector('[data-home-section="'+key+'"]'),toggle=document.querySelector('.home-section-toggle[data-section="'+key+'"]'),order=document.querySelector('[data-section-order="'+key+'"]');if(toggle){toggle.setAttribute('aria-pressed',String(!!cfg.show));toggle.textContent=cfg.show?'TAMPIL':'SEMBUNYI'}if(order)order.value=String(cfg.order||1);if(section){section.hidden=!cfg.show;section.style.order=''}});const host=$('#homeRestockSection'),container=host?host.parentElement:null;if(container){container.style.display='';container.style.flexDirection=''}}


// --- dari js/app.js baris 624 (pindah verbatim, tanpa ubah logika) ---
function renderFlashCard(){const card=$('#flashCard');if(!card)return;const products=S.products||[];if(!S.flashProductId){card.hidden=true;return}if(!products.length)return;const product=products.find(p=>p.id===S.flashProductId)||(S.flashProductName?products.find(p=>p.name===S.flashProductName):null);if(!product){card.hidden=true;return}card.hidden=false;const title=$('#flashTitle'),rule=$('#flashRule'),price=S.promoUnitPrice[product.id]||product.price;if(title)title.textContent=product.name+' cuma '+money(price);if(rule)rule.textContent=S.flashRule||'Selama persediaan masih ada.';const cd=$('#flashCountdown');if(cd&&cd.textContent==='--:--:--'){const end=new Date().setHours(24,0,0,0);const left=Math.max(0,Math.floor((end-Date.now())/1000)),h=String(Math.floor(left/3600)).padStart(2,'0'),m=String(Math.floor(left%3600/60)).padStart(2,'0'),s=String(left%60).padStart(2,'0');cd.textContent=`${h}:${m}:${s}`}}


// --- dari js/app.js baris 625 (pindah verbatim, tanpa ubah logika) ---
function renderPromoModalList(){const list=$('#promoModalList');if(!list)return;const promos=S.promos||[];list.innerHTML=promos.length?promos.map(d=>`<article class="promo-modal-item"><b>${escapeHtml(d.title||d.name||'Promo')}</b><p>${escapeHtml(d.copy||d.description||'')}</p></article>`).join(''):'<div class="empty-note">Belum ada promo.</div>'}


// --- dari js/app.js baris 628 (pindah verbatim, tanpa ubah logika) ---
function promoAction(p){const t=((p.title||'')+' '+(p.copy||'')).toLowerCase();if(t.includes('koin'))return'coinModal';if(t.includes('patungan'))return'patunganModal';if(t.includes('grosir'))return'grosirModal';if(t.includes('rutin'))return'rutinModal';if(t.includes('hajatan'))return'hajatanModal';if(t.includes('anggaran')||t.includes('budget'))return'budgetModal';if(t.includes('pantau harga')||t.includes('harga naik')||t.includes('harga turun'))return'priceAlertModal';if(t.includes('titip'))return'titipModal';if(t.includes('misi'))return'missionsModal';if(t.includes('ide')||t.includes('resep')||(t.includes('menu')&&!t.includes('hemat')))return'scroll-recipe';if(t.includes('laris')||t.includes('incaran')||t.includes('best seller')||t.includes('terlaris'))return'scroll-popular';if(t.includes('ongkir')||t.includes('gratis antar')||t.includes('diantar'))return'go-produk-ongkir';if(t.includes('produk')||t.includes('belanja')||t.includes('katalog')||t.includes('sembako')||t.includes('hemat')||t.includes('paket')||t.includes('baru datang'))return'go-produk';return'promoModal'}


// --- dari js/app.js baris 629 (pindah verbatim, tanpa ubah logika) ---
function showPromo(i){const track=$('#promoTrack');if(!track||!track.children.length)return;const n=track.children.length;S.promoIndex=((i%n)+n)%n;Array.from(track.children).forEach((s,idx)=>s.classList.toggle('active',idx===S.promoIndex));$$('#promoDots [data-promo-slide]').forEach((d,idx)=>d.classList.toggle('active',idx===S.promoIndex));track.style.transform='translateX(-'+(S.promoIndex*100)+'%)'}


// --- dari js/app.js baris 630 (pindah verbatim, tanpa ubah logika) ---
function startPromo(){if(S.promoTimer)clearInterval(S.promoTimer);const track=$('#promoTrack');if(!track||track.children.length<2)return;S.promoTimer=setInterval(()=>{showPromo((S.promoIndex||0)+1)},5000)}

