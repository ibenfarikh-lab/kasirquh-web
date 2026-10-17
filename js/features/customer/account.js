/* KasirQuh Web — js/features/customer/account.js
 * Akun pelanggan: tile, catatan, barcode.
 * Diekstrak verbatim dari js/app.js (Tahap 3 modularisasi). */

// --- dari js/app.js baris 279 (pindah verbatim, tanpa ubah logika) ---
function setProfileIdentity(name){const safe=cleanInput(name)||'Pelanggan';$('#profileName').textContent=safe;const pi=$('#profileInitial');if(pi&&!(S.myCustomerDoc&&S.myCustomerDoc.photoURL))pi.textContent=safe.charAt(0).toUpperCase();$('#customerNameInput').value=safe;try{if(typeof renderProfilePhoto==='function')renderProfilePhoto()}catch(e){}}


// --- dari js/app.js baris 350 (pindah verbatim, tanpa ubah logika) ---
function barcodeRects(value,y,height){let x=18,out='';('*'+value+'*').split('').forEach(ch=>{S.code39[ch].split('').forEach((kind,i)=>{const w=kind==='w'?5:2;if(i%2===0)out+=`<rect x="${x}" y="${y}" width="${w}" height="${height}" fill="#171313"/>`;x+=w});x+=2});return {rects:out,width:x+18}}


// --- Barcode member: UNIK per member, format KQ-XXXXXXXX (8 karakter awal UID Auth) ---
// Pakai Firebase Auth UID langsung (ikut native) — S.activeCustomerId
// baru di-set setelah dokumen Firestore dibaca, terlalu lambat untuk render
function memberBarcodeCode(){
  let uid = '';
  try {
    if (window.FB && FB.auth && FB.auth.currentUser) uid = FB.auth.currentUser.uid || '';
  } catch (e) {}
  if (!uid && window.S && S.activeCustomerId) uid = S.activeCustomerId;
  if (!uid) return null;
  return 'KQ-' + String(uid).slice(0, 8).toUpperCase();
}

function renderAppBarcode(){
  // Legacy: modal barcodeModal sudah dihapus, fungsi ini jadi no-op aman
  const svg=$('#appBarcode');
  if (!svg) return;
  renderMemberCardBarcode(svg, null);
}

/* Kartu member di halaman akun: render barcode + kode */
function renderMemberCardBarcode(svg, labelEl){
  const code = memberBarcodeCode();
  if (!code) {
    svg.innerHTML = '<text x="160" y="52" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#777">Login untuk kartu member</text>';
    if (labelEl) labelEl.textContent = '-';
    return;
  }
  const made=barcodeRects(code,8,78);
  svg.setAttribute('viewBox',`0 0 ${made.width} 104`);
  svg.innerHTML=`<rect width="100%" height="104" fill="#fff"/>${made.rects}<text x="${made.width/2}" y="99" text-anchor="middle" font-family="monospace" font-size="10" fill="#171313">*${code}*</text>`;
  if (labelEl) labelEl.textContent = code;
}

function renderMemberCard(){
  const svg=$('#memberCardBarcode');
  if (!svg) return;
  const label=$('#memberCardCode');
  renderMemberCardBarcode(svg, label);
}


// --- dari js/app.js baris 651 (pindah verbatim, tanpa ubah logika) ---
function renderCustomerNotes(){const box=$('#customerNotes');if(!box)return;const notes=S.customerNotesList||[],typeLabel={tagihan:'Tagihan',pembayaran:'Pembayaran',catatan:'Catatan'};box.innerHTML=notes.length?notes.map(n=>`<article class="note-card"><header><h3>${escapeHtml(typeLabel[n.type]||'Catatan')}${n.amount?' · '+money(n.amount):''}</h3><span class="stock-pill">Baru</span></header><p>${escapeHtml(n.note)}</p><small>${escapeHtml(n.time||'')}</small></article>`).join(''):'<div class="empty-note">Belum ada catatan dari warung.</div>'}


// --- dari js/app.js baris 928 (pindah verbatim, tanpa ubah logika) ---
function renderAccountTiles(){
  try{
    // Render kartu member (pastikan barcode tampil setelah login)
    if (typeof renderMemberCard === 'function') renderMemberCard();
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


/* ============ FOTO PROFIL PELANGGAN (2026-10-18) ============
 * Kompres di client (max 200x200 JPEG) → base64 di field photoURL
 * dokumen customers/{uid}. Bukan Firebase Storage. */

/* Tampilkan foto profil di avatar halaman akun (ganti huruf awal). */
function renderProfilePhoto(){
  const box = $('#profileInitial');
  if (!box) return;
  const photo = (S.myCustomerDoc && S.myCustomerDoc.photoURL) || '';
  if (photo) {
    box.classList.add('has-photo');
    box.innerHTML = '<img src="'+String(photo).replace(/"/g,'&quot;')+'" alt="Foto profil">';
  } else {
    box.classList.remove('has-photo');
    const safe = cleanInput($('#profileName').textContent) || 'Pelanggan';
    box.textContent = safe.charAt(0).toUpperCase();
  }
}

/* Kompres gambar: max 200x200, JPEG 0.7 → data URL (jauh di bawah 1MB). */
function compressPhotoFile(file){
  return new Promise((resolve, reject) => {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return reject(new Error('Pilih file gambar'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(url);
        const MAX = 200;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak bisa dibaca')); };
    img.src = url;
  });
}

/* Pasang handler upload foto (sekali saja). */
let photoUploadWired = false;
function initPhotoUpload(){
  if (photoUploadWired) return;
  const btn = $('#changePhotoBtn'), input = $('#photoFileInput');
  if (!btn || !input) return;
  photoUploadWired = true;
  btn.onclick = () => input.click();
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    btn.disabled = true;
    btn.textContent = 'Mengompres…';
    compressPhotoFile(file).then(dataUrl => {
      if (dataUrl.length > 900000) throw new Error('Foto masih terlalu besar, pilih yang lebih kecil');
      btn.textContent = 'Menyimpan…';
      return storePromise('saveCustomerDoc', { photoURL: dataUrl }).then(() => dataUrl);
    }).then(dataUrl => {
      if (S.myCustomerDoc) S.myCustomerDoc.photoURL = dataUrl;
      renderProfilePhoto();
      renderPhotoPreview();
      toast('Foto profil disimpan');
    }).catch(err => {
      toast(err && err.message ? err.message : 'Gagal simpan foto');
    }).finally(() => {
      btn.disabled = false;
      btn.textContent = 'Ganti foto';
    });
  });
}

/* Preview foto di pengaturan (atau huruf awal bila belum ada). */
function renderPhotoPreview(){
  const prev = $('#photoPreview');
  if (!prev) return;
  const photo = (S.myCustomerDoc && S.myCustomerDoc.photoURL) || '';
  if (photo) {
    prev.classList.add('has-photo');
    prev.innerHTML = '<img src="'+String(photo).replace(/"/g,'&quot;')+'" alt="Foto profil">';
  } else {
    prev.classList.remove('has-photo');
    const safe = cleanInput($('#profileName').textContent) || 'P';
    prev.textContent = safe.charAt(0).toUpperCase();
  }
}
