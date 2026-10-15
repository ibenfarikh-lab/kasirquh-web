/* KasirQuh Web — js/features/admin/orders.js
 * Diekstrak verbatim dari js/app.js (Tahap 4 modularisasi). */

// --- state modul, dari js/app.js baris 137-137 ---
const cancelConfirmIds=new Set();
// --- dari js/app.js baris 138 (pindah verbatim, tanpa ubah logika) ---
function orderCard(x){const rows=x.items.map(item=>`<div><span>${item[0]} — ${item[1]}</span><b>${item[2]}</b></div>`).join(''),waDigits=String(x.wa||'').replace(/\D/g,''),waBtn=waDigits?`<button class="order-action wa" data-order-action="wa" data-order-wa="${waDigits}" aria-label="Hubungi lewat WhatsApp">${iconSvg('chat')}</button>`:'';return `<article class="online-order" data-online-order="${x.id}"><div class="order-topline"><time>${x.time}</time><span class="order-status ${x.status==='done'?'done':'waiting'}">${x.status==='done'?'Selesai':x._rawStatus==='dikemas'?'Dikemas':x._rawStatus==='dikirim'?'Dikirim':'Menunggu Diproses'}</span></div><div class="order-customer"><b class="order-info-line">${iconSvg('user')}<span>${x.name} (${x.wa})</span></b></div><p class="order-address order-info-line">${iconSvg('home')}<span>${x.address}</span></p><span class="order-method">${x.method}</span><div class="order-goods"><strong class="order-info-line">${iconSvg('box')}<span>Rincian Barang</span></strong>${rows}</div><div class="order-total"><span>Total Belanja:</span><b>${money(x.total)}</b></div><div class="order-actions">${waBtn}${x.status==='active'?`${x._rawStatus==='menunggu'?`<button class="order-action pack" data-order-action="pack" data-order-id="${x.id}" aria-label="Tandai dikemas"><span>Dikemas</span></button>`:''}${x._rawStatus==='dikemas'?`<button class="order-action ship" data-order-action="ship" data-order-id="${x.id}" aria-label="Tandai dikirim"><span>Dikirim</span></button>`:''}<button class="order-action cancel-order" data-order-action="cancel" data-order-id="${x.id}" aria-label="Batalkan pesanan">${iconSvg('trash')}<span>${cancelConfirmIds.has(x.id)?'Tap lagi untuk batalkan':'Batalkan pesanan'}</span></button><button class="order-action finish" data-order-action="finish" data-order-id="${x.id}" aria-label="Tandai selesai">${iconSvg('check')}</button>`:`<button class="order-action delete" data-order-action="delete" data-order-id="${x.id}" aria-label="Hapus pesanan">${iconSvg('trash')}</button>`}</div></article>`}
// --- dari js/app.js baris 141 (pindah verbatim, tanpa ubah logika) ---
function setOnlineTab(name){$$('[data-online-tab]').forEach(b=>{const active=b.dataset.onlineTab===name;b.classList.toggle('active',active);b.setAttribute('aria-selected',active)});$('#onlineActivePanel').classList.toggle('active',name==='active');$('#onlineDonePanel').classList.toggle('active',name==='done')}
// --- dari js/app.js baris 139 (pindah verbatim, tanpa ubah logika) ---
function renderTransfers(){const list=$('#transferList'),orders=S.onlineOrders.filter(order=>order.method==='Transfer');const label=order=>order.status==='done'?'LUNAS':order.transferStatus==='rejected'?'DITOLAK':'PERIKSA';list.innerHTML=orders.length?orders.map(order=>{const state=label(order),ref=order.transferReference?`<br>Referensi: ${escapeHtml(order.transferReference)}`:'<br><small>Pelanggan belum menulis referensi transfer</small>';return `<article class="transfer-card" data-transfer-card data-order-id="${escapeHtml(order.id)}"><header><span><b>#${escapeHtml(order.id)} · ${escapeHtml(order.name)}</b><small>${money(order.total)} · ${escapeHtml(order.time)}</small></span><span class="${state==='PERIKSA'?'notice-count':state==='LUNAS'?'stock-pill':'approval-state rejected'}">${state}</span></header>${state==='LUNAS'?'':`<div class="transfer-proof">KONFIRMASI TRANSFER${ref}<br>${money(order.total)}<br>${escapeHtml(order.time)}</div>${state==='DITOLAK'?`<div class="card-actions"><button class="verify" data-verify-transfer>Verifikasi</button><small class="form-hint-note">Penolakan tersimpan · Verifikasi untuk melunaskan bila ternyata sudah dibayar.</small></div>`:`<div class="card-actions"><button class="verify" data-verify-transfer>Verifikasi</button><button class="reject" data-reject-transfer>Tolak</button></div>`}`}</article>`}).join(''):'<div class="empty-note">Belum ada pembayaran transfer.</div>';$$('[data-verify-transfer]').forEach(button=>button.onclick=()=>{const order=S.onlineOrders.find(item=>item.id===button.closest('[data-transfer-card]').dataset.orderId);if(!order||!order._docId)return;button.disabled=true;Store.settleOrder(order._docId,'Verifikasi transfer').then(()=>{setOnlineTab('done');toast('Transfer terverifikasi · penjualan masuk Pembukuan')}).catch(error=>{button.disabled=false;if(!error||error.code!=='OFFLINE')toast(error&&error.message?error.message:'Verifikasi gagal')})});$$('[data-reject-transfer]').forEach(button=>button.onclick=()=>{const order=S.onlineOrders.find(item=>item.id===button.closest('[data-transfer-card]').dataset.orderId);if(!order||!order._docId)return;button.disabled=true;storePromise('rejectTransfer',order._docId).then(()=>toast('Transfer ditolak · status tersimpan')).catch(error=>{button.disabled=false;if(!error||error.code!=='OFFLINE')toast(error&&error.message?error.message:'Penolakan gagal')})})}
// --- dari js/app.js baris 820 (pindah verbatim, tanpa ubah logika) ---
function renderActiveOrder(){
  try{
    const card=$('#activeOrderCard');
    if(!card) return;
    const order=S.activeOrder;
    if(!order){
      card.hidden=true;
      return;
    }
    card.hidden=false;
    const titleEl=card.querySelector('b');
    const descEl=card.querySelector('small');
    if(titleEl) titleEl.textContent='Pesanan '+order.id;
    if(descEl) descEl.textContent=order.status+' · '+order.detail;
    // Update modal detail
    const modalId=$('#orderModalId');
    const modalBody=$('#orderModalBody');
    if(modalId) modalId.textContent=order.id;
    if(modalBody){
      modalBody.innerHTML='<div class="service-row"><div><h3>'+escapeHtml(order.id)+'</h3><p>'+escapeHtml(order.status)+'</p><p>'+escapeHtml(order.detail)+'</p></div></div>';
    }
  }catch(e){ console.error('renderActiveOrder gagal', e); }
}
