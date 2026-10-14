/* KasirQuh Web — js/features/admin/hajatan.js
 * Diekstrak verbatim dari js/app.js (Tahap 4 modularisasi). */

// --- state modul, dari js/app.js baris 637-637 ---
let hajatanEditingId=null, hajatanItems=[];
// --- dari js/app.js baris 659 (pindah verbatim, tanpa ubah logika) ---
function initHajatanAdmin(){
  const sel=$('#hajatanProductSelect');
  if(sel)sel.innerHTML=(S.products||[]).filter(p=>p.stock>0).sort((a,b)=>a.name.localeCompare(b.name,'id')).map(p=>`<option value="${p.id}">${escapeHtml(p.name)} · ${money(p.price)}</option>`).join('');
  const addBtn=$('#hajatanAddItem');
  if(addBtn)addBtn.onclick=()=>{
    const pid=$('#hajatanProductSelect').value, qty=Math.max(1,Math.round(Number($('#hajatanProductQty').value)||1));
    if(!pid)return; if(hajatanItems.some(it=>it.productId===pid))return toast('Produk sudah ada di paket');
    hajatanItems.push({productId:pid,qty});renderHajatanItemList();
  };
  const saveBtn=$('#saveHajatanPackage');
  if(saveBtn)saveBtn.onclick=()=>{
    const name=$('#hajatanNameInput').value.trim();
    if(!name)return toast('Isi nama paket');
    if(!hajatanItems.length)return toast('Tambahkan minimal 1 produk');
    const data={name,description:$('#hajatanDescInput').value.trim(),items:hajatanItems};
    saveBtn.disabled=true;
    storePromise('saveHajatanPackage',data,hajatanEditingId||null).then(()=>{
      saveBtn.disabled=false;hajatanEditingId=null;hajatanItems=[];
      $('#hajatanNameInput').value='';$('#hajatanDescInput').value='';renderHajatanItemList();
      toast('Paket tersimpan');
    }).catch(e=>{saveBtn.disabled=false;toast('Gagal simpan')});
  };
}
// --- dari js/app.js baris 644 (pindah verbatim, tanpa ubah logika) ---
function renderHajatanAdminList(){
  const box=$('#hajatanAdminList');if(!box)return;
  const list=S.hajatanPackages||[];
  box.innerHTML=list.length?list.map(p=>`<article class="note-card"><header><h3>${escapeHtml(p.name)}</h3></header><p>${escapeHtml(p.description||'')} · ${(p.items||[]).length} produk</p><div class="card-actions"><button class="ghost" data-hajatan-edit="${p.id}">Ubah</button><button class="ghost" data-hajatan-del-pkg="${p.id}">Hapus</button></div></article>`).join(''):'<div class="empty-note">Belum ada paket. Buat di atas.</div>';
  box.querySelectorAll('[data-hajatan-edit]').forEach(b=>b.onclick=()=>{
    const p=(S.hajatanPackages||[]).find(x=>x.id===b.dataset.hajatanEdit);if(!p)return;
    hajatanEditingId=p.id;$('#hajatanNameInput').value=p.name||'';$('#hajatanDescInput').value=p.description||'';
    hajatanItems=(p.items||[]).map(it=>({productId:it.productId,qty:it.qty}));renderHajatanItemList();
    toast('Edit paket: '+p.name);
  });
  box.querySelectorAll('[data-hajatan-del-pkg]').forEach(b=>b.onclick=()=>{
    if(!confirm('Hapus paket ini?'))return;
    storePromise('deleteHajatanPackage',b.dataset.hajatanDelPkg).then(()=>toast('Paket dihapus')).catch(e=>toast('Gagal hapus'));
  });
}
// --- dari js/app.js baris 638 (pindah verbatim, tanpa ubah logika) ---
function renderHajatanItemList(){
  const box=$('#hajatanItemList');if(!box)return;
  box.innerHTML=hajatanItems.length?hajatanItems.map((it,i)=>{const p=S.products.find(x=>x.id===it.productId);return `<div class="service-row"><div><h3>${escapeHtml(p?p.name:'?')}</h3><p>Qty: ${it.qty}</p></div><button data-hajatan-del="${i}">Hapus</button></div>`}).join(''):'<div class="empty-note">Belum ada produk. Tambahkan di bawah.</div>';
  const c=$('#hajatanItemCount');if(c)c.textContent=`(${hajatanItems.length} produk)`;
  box.querySelectorAll('[data-hajatan-del]').forEach(b=>b.onclick=()=>{hajatanItems.splice(Number(b.dataset.hajatanDel),1);renderHajatanItemList()});
}
