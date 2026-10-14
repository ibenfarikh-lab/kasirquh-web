/* KasirQuh Web — js/features/admin/products.js
 * Diekstrak verbatim dari js/app.js (Tahap 4 modularisasi). */

// --- state modul, dari js/app.js baris 437-446 ---
const CSV_HEADER_ALIASES = {
  barcode: ['kode', 'barcode', 'kode barang', 'kode produk', 'sku', 'plu'],
  name: ['nama', 'nama produk', 'nama barang', 'produk'],
  cat: ['kategori', 'category', 'kat'],
  unit: ['satuan', 'unit'],
  stock: ['stok', 'stock', 'jumlah', 'qty'],
  cost: ['modal', 'harga modal', 'cost', 'harga beli', 'harga kulak'],
  price: ['harga', 'harga jual', 'price'],
  photo: ['foto', 'photo', 'gambar', 'image', 'photourl', 'foto url'],
};
// --- dari js/app.js baris 42 (pindah verbatim, tanpa ubah logika) ---
function updateProductMarginPreview(){const cost=numericValue($('#productCostInput').value),price=numericValue($('#productPriceInput').value),margin=Math.max(0,price-cost),percent=price?Math.round(margin/price*100):0;$('#productMarginPreview').textContent='Untung '+money(margin)+' / '+percent+'% dari harga jual'}
// --- dari js/app.js baris 549 (pindah verbatim, tanpa ubah logika) ---
function setProductPhoto(src,label){S.pendingProductImage=src;$('#productImagePreview').src=src;$('#productImagePreview').alt='Pratinjau '+(label||'foto produk');$$('.photo-result').forEach(button=>button.classList.toggle('selected',button.dataset.photoSrc===src))}
// --- dari js/app.js baris 550 (pindah verbatim, tanpa ubah logika) ---
function resizeProductPhoto(file){if(!file.type.startsWith('image/'))return toast('Pilih file gambar dari HP');if(file.size>5*1024*1024){$('#productImageInput').value='';return toast('Foto maksimal 5 MB')}const image=new Image(),objectUrl=URL.createObjectURL(file);image.onload=()=>{const maxSide=300,scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,canvas.width,canvas.height);setProductPhoto(canvas.toDataURL('image/png'),file.name);URL.revokeObjectURL(objectUrl);toast('Foto produk PNG siap · '+canvas.width+' × '+canvas.height+' px')};image.onerror=()=>{URL.revokeObjectURL(objectUrl);$('#productImageInput').value='';toast('Foto tidak dapat dibaca')};image.src=objectUrl}
// --- dari js/app.js baris 447 (pindah verbatim, tanpa ubah logika) ---
function mapCsvRows(rows) {
  const out = { items: [], skipped: [] };
  if (!rows.length) return out;
  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  const colIndex = {};
  Object.keys(CSV_HEADER_ALIASES).forEach(key => {
    colIndex[key] = header.findIndex(h => CSV_HEADER_ALIASES[key].indexOf(h) >= 0);
  });
  if (colIndex.name < 0) { out.skipped.push({ row: 1, reason: 'kolom Nama tidak ditemukan di baris judul' }); return out; }
  const seen = {};
  rows.slice(1).forEach((cells, i) => {
    const lineNo = i + 2;
    const get = key => colIndex[key] >= 0 ? String(cells[colIndex[key]] == null ? '' : cells[colIndex[key]]).trim() : '';
    const name = get('name');
    if (!name) { out.skipped.push({ row: lineNo, reason: 'tanpa nama' }); return; }
    const barcode = get('barcode');
    const dedupeKey = barcode ? 'kode:' + barcode : 'baris:' + lineNo;
    seen[dedupeKey] = {
      barcode: barcode, name: name, photo: get('photo'),
      cat: get('cat') || 'Lainnya',
      unit: get('unit') || 'pcs',
      stock: parseCsvNumber(get('stock')),
      cost: parseCsvNumber(get('cost')),
      price: parseCsvNumber(get('price')),
    };
  });
  out.items = Object.values(seen);
  return out;
}
// --- dari js/app.js baris 429 (pindah verbatim, tanpa ubah logika) ---
function parseCsvNumber(value) {
  let s = String(value == null ? '' : value).trim().replace(/\s+/g, '');
  if (!s) return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
// --- dari js/app.js baris 407 (pindah verbatim, tanpa ubah logika) ---
function parseCsvText(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { if (row.some(c => String(c).trim() !== '')) rows.push(row); row = []; };
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') pushField();
    else if (ch === '\r') { /* ikut \n */ }
    else if (ch === '\n') { pushField(); pushRow(); }
    else field += ch;
  }
  pushField(); pushRow();
  return rows;
}
// --- dari js/app.js baris 486 (pindah verbatim, tanpa ubah logika) ---
function previewCsvImport(items, skipped) {
  const byBarcode = {};
  (S.products || []).forEach(p => {
    const code = String(p.barcode || '').trim();
    if (code && !byBarcode[code]) byBarcode[code] = true;
  });
  let willCreate = 0, willUpdate = 0;
  items.forEach(it => { if (it.barcode && byBarcode[it.barcode]) willUpdate++; else willCreate++; });
  const sample = items.slice(0, 5).map(it =>
    '<li>' + escapeHtml(it.name) + ' · ' + money(it.price) +
    (it.barcode && byBarcode[it.barcode] ? ' (perbarui)' : ' (baru)') + '</li>'
  ).join('');
  const skipList = skipped.slice(0, 5).map(s =>
    '<li class="csv-skip">Baris ' + s.row + ': ' + escapeHtml(s.reason) + '</li>'
  ).join('');
  const box = $('#csvPreview');
  box.innerHTML = '<b>' + items.length + ' produk siap diimpor</b><br>' +
    willCreate + ' baru · ' + willUpdate + ' akan diperbarui' +
    (skipped.length ? ' · ' + skipped.length + ' dilewati' : '') +
    '<ul>' + sample + skipList + '</ul>';
  box.hidden = false;
  $('#doCsvImport').disabled = !items.length;
}
// --- dari js/app.js baris 476 (pindah verbatim, tanpa ubah logika) ---
function resetCsvImport() {
  S.csvImport = null;
  $('#csvFileInput').value = '';
  $('#csvPreview').hidden = true;
  $('#csvPreview').innerHTML = '';
  const st = $('#csvImportStatus');
  st.hidden = true; st.textContent = ''; st.classList.remove('error');
  const btn = $('#doCsvImport');
  btn.disabled = true; btn.textContent = 'Impor sekarang';
}
