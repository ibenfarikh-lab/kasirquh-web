/* KasirQuh Web — js/features/customer/account.js
 * Akun pelanggan: tile, catatan, barcode.
 * Diekstrak verbatim dari js/app.js (Tahap 3 modularisasi). */

// --- dari js/app.js baris 279 (pindah verbatim, tanpa ubah logika) ---
function setProfileIdentity(name){const safe=cleanInput(name)||'Pelanggan';$('#profileName').textContent=safe;$('#profileInitial').textContent=safe.charAt(0).toUpperCase();$('#customerNameInput').value=safe}


// --- dari js/app.js baris 350 (pindah verbatim, tanpa ubah logika) ---
function barcodeRects(value,y,height){let x=18,out='';('*'+value+'*').split('').forEach(ch=>{S.code39[ch].split('').forEach((kind,i)=>{const w=kind==='w'?5:2;if(i%2===0)out+=`<rect x="${x}" y="${y}" width="${w}" height="${height}" fill="#171313"/>`;x+=w});x+=2});return {rects:out,width:x+18}}


// --- Barcode member: UNIK per member, format KQ-XXXXXXXX (8 karakter awal UID Auth) ---
function memberBarcodeCode(){
  const uid = (window.S && S.activeCustomerId) || '';
  if (!uid) return null;
  return 'KQ-' + String(uid).slice(0, 8).toUpperCase();
}

function renderAppBarcode(){
  const code = memberBarcodeCode();
  const svg=$('#appBarcode');
  if (!svg) return;
  if (!code) {
    svg.innerHTML = '<text x="160" y="52" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#777">Login untuk barcode member</text>';
    return;
  }
  const made=barcodeRects(code,8,78);
  svg.setAttribute('viewBox',`0 0 ${made.width} 104`);
  svg.innerHTML=`<rect width="100%" height="104" fill="#fff"/>${made.rects}<text x="${made.width/2}" y="99" text-anchor="middle" font-family="monospace" font-size="10" fill="#171313">*${code}*</text>`;
  // Update label teks di bawah barcode
  const label = svg.closest('.code-card')?.querySelector('strong');
  if (label) label.textContent = code;
}


// --- dari js/app.js baris 651 (pindah verbatim, tanpa ubah logika) ---
function renderCustomerNotes(){const box=$('#customerNotes');if(!box)return;const notes=S.customerNotesList||[],typeLabel={tagihan:'Tagihan',pembayaran:'Pembayaran',catatan:'Catatan'};box.innerHTML=notes.length?notes.map(n=>`<article class="note-card"><header><h3>${escapeHtml(typeLabel[n.type]||'Catatan')}${n.amount?' · '+money(n.amount):''}</h3><span class="stock-pill">Baru</span></header><p>${escapeHtml(n.note)}</p><small>${escapeHtml(n.time||'')}</small></article>`).join(''):'<div class="empty-note">Belum ada catatan dari warung.</div>'}


// --- dari js/app.js baris 928 (pindah verbatim, tanpa ubah logika) ---
function renderAccountTiles(){
  try{
    // Update meta pesanan di halaman akun
    const orderMeta=$('#accountOrderMeta');
    if(orderMeta){
      const order=S.activeOrder;
      orderMeta.textContent=order?('Aktif: '+order.id+' · '+order.status):'Tidak ada pesanan aktif';
    }
    // Update meta riwayat
    const historyMeta=$('#accountHistoryMeta');
    if(historyMeta){
      const count=(S.onlineOrders||[]).filter(o=>o.customerId===S.activeCustomerId).length;
      historyMeta.textContent=count?count+' pesanan':'Belum ada riwayat';
    }
    // Update badge catatan
    const noteBadge=$('#accountNoteBadge');
    if(noteBadge){
      const notes=S.customerNotes||[];
      noteBadge.textContent=notes.length||'';
      noteBadge.hidden=!notes.length;
    }
    const noteMeta=$('#accountNoteMeta');
    if(noteMeta){
      const notes=S.customerNotes||[];
      noteMeta.textContent=notes.length?notes.length+' catatan':'Belum ada catatan';
    }
  }catch(e){ console.error('renderAccountTiles gagal', e); }
}

