/* KasirQuh Web — js/features/admin/rutin.js
 * Diekstrak verbatim dari js/app.js (Tahap 4 modularisasi). */

// --- state modul, dari js/app.js baris 591-591 ---
let rutinEditingId=null, rutinItems=[];
// --- dari js/app.js baris 613 (pindah verbatim, tanpa ubah logika) ---
function initRutinAdmin(){
  const sel=$('#rutinProductSelect');
  if(sel)sel.innerHTML=(S.products||[]).filter(p=>p.stock>0).sort((a,b)=>a.name.localeCompare(b.name,'id')).map(p=>`<option value="${p.id}">${escapeHtml(p.name)} · ${money(p.price)}</option>`).join('');
  const addBtn=$('#rutinAddItem');
  if(addBtn)addBtn.onclick=()=>{
    const pid=$('#rutinProductSelect').value, qty=Math.max(1,Math.round(Number($('#rutinProductQty').value)||1));
    if(!pid)return; if(rutinItems.some(it=>it.productId===pid))return toast('Produk sudah ada di paket');
    rutinItems.push({productId:pid,qty});renderRutinItemList();
  };
  const saveBtn=$('#saveRutinPackage');
  if(saveBtn)saveBtn.onclick=()=>{
    const name=$('#rutinNameInput').value.trim();
    if(!name)return toast('Isi nama paket');
    if(!rutinItems.length)return toast('Tambahkan minimal 1 produk');
    const data={name,description:$('#rutinDescInput').value.trim(),items:rutinItems};
    saveBtn.disabled=true;
    storePromise('saveRutinPackage',data,rutinEditingId||null).then(()=>{
      saveBtn.disabled=false;rutinEditingId=null;rutinItems=[];
      $('#rutinNameInput').value='';$('#rutinDescInput').value='';renderRutinItemList();
      toast('Paket tersimpan');
    }).catch(e=>{saveBtn.disabled=false;toast('Gagal simpan')});
  };
}
// --- dari js/app.js baris 598 (pindah verbatim, tanpa ubah logika) ---
function renderRutinAdminList(){
  const box=$('#rutinAdminList');if(!box)return;
  const list=S.rutinPackages||[];
  box.innerHTML=list.length?list.map(p=>`<article class="note-card"><header><h3>${escapeHtml(p.name)}</h3></header><p>${escapeHtml(p.description||'')} · ${(p.items||[]).length} produk</p><div class="card-actions"><button class="ghost" data-rutin-edit="${p.id}">Ubah</button><button class="ghost" data-rutin-del-pkg="${p.id}">Hapus</button></div></article>`).join(''):'<div class="empty-note">Belum ada paket. Buat di atas.</div>';
  box.querySelectorAll('[data-rutin-edit]').forEach(b=>b.onclick=()=>{
    const p=(S.rutinPackages||[]).find(x=>x.id===b.dataset.rutinEdit);if(!p)return;
    rutinEditingId=p.id;$('#rutinNameInput').value=p.name||'';$('#rutinDescInput').value=p.description||'';
    rutinItems=(p.items||[]).map(it=>({productId:it.productId,qty:it.qty}));renderRutinItemList();
    toast('Edit paket: '+p.name);
  });
  box.querySelectorAll('[data-rutin-del-pkg]').forEach(b=>b.onclick=()=>{
    if(!confirm('Hapus paket ini?'))return;
    storePromise('deleteRutinPackage',b.dataset.rutinDelPkg).then(()=>toast('Paket dihapus')).catch(e=>toast('Gagal hapus'));
  });
}
// --- dari js/app.js baris 592 (pindah verbatim, tanpa ubah logika) ---
function renderRutinItemList(){
  const box=$('#rutinItemList');if(!box)return;
  box.innerHTML=rutinItems.length?rutinItems.map((it,i)=>{const p=S.products.find(x=>x.id===it.productId);return `<div class="service-row"><div><h3>${escapeHtml(p?p.name:'?')}</h3><p>Qty: ${it.qty}</p></div><button data-rutin-del="${i}">Hapus</button></div>`}).join(''):'<div class="empty-note">Belum ada produk. Tambahkan di bawah.</div>';
  const c=$('#rutinItemCount');if(c)c.textContent=`(${rutinItems.length} produk)`;
  box.querySelectorAll('[data-rutin-del]').forEach(b=>b.onclick=()=>{rutinItems.splice(Number(b.dataset.rutinDel),1);renderRutinItemList()});
}
