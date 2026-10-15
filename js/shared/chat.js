/* KasirQuh Web — js/shared/chat.js
 * Rumpi Warga & chat langsung (direct thread).
 * Diekstrak verbatim dari js/app.js (Tahap 2 modularisasi). */


// --- dari js/app.js baris 201 (pindah verbatim, tanpa ubah logika) ---
function makeRumpiRow(message,viewer){const row=document.createElement('article'),own=viewer==='admin'?message.admin:(!message.admin&&message.name===($('#profileName').textContent.trim()||'Mimi'));row.className='rumpi-message'+(own?' admin-message':'')+(viewer==='customer'&&own?' customer-rumpi-own':'');const avatar=document.createElement('div');avatar.className='rumpi-avatar';avatar.textContent=message.initial;const bubble=document.createElement('div');bubble.className='rumpi-bubble';const head=document.createElement('header'),name=document.createElement('b'),copy=document.createElement('p');name.textContent=message.name;copy.textContent=message.text;head.append(name);if(message.admin){const badge=document.createElement('span');badge.className='rumpi-admin-badge';badge.textContent='Admin';head.append(badge)}bubble.append(head);if(message.photo){const photo=document.createElement('img');photo.className='rumpi-recipe-photo';photo.src=message.photo;photo.alt=message.photoAlt||'Foto resep yang dibagikan';bubble.append(photo)}bubble.append(copy);const tm=document.createElement('span');tm.className='rumpi-time';tm.textContent=message.time;bubble.append(tm);const like=document.createElement('button');like.className='rumpi-like';like.dataset.likeRumpi=message.id;like.setAttribute('aria-label','Suka postingan');like.innerHTML='<span aria-hidden="true">♥</span> <b>'+(message.likeCount||0)+'</b>';bubble.append(like);if(own)row.append(bubble,avatar);else{row.append(avatar,bubble);if(viewer==='admin'&&!message.admin){const remove=document.createElement('button');remove.className='moderate-delete';remove.textContent='Hapus';remove.setAttribute('aria-label','Hapus pesan dari '+message.name);remove.onclick=()=>{Store.deleteRumpi(message.id).then(()=>toast('Pesan dihapus dari Rumpi Warga')).catch(error=>{if(!error||error.code!=='OFFLINE')toast(error&&error.message?error.message:'Hapus gagal')})};row.append(remove)}}return row}

// --- dari js/app.js baris 202 (pindah verbatim, tanpa ubah logika) ---
function renderRumpiFeed(feedId,viewer){const feed=$('#'+feedId);feed.innerHTML='';if(!S.rumpiMessages.length){const empty=document.createElement('div');empty.className='empty-note';empty.textContent='Belum ada obrolan di Rumpi Warga.';feed.append(empty)}else [...S.rumpiMessages].reverse().forEach(message=>feed.append(makeRumpiRow(message,viewer)));$$('#'+feedId+' [data-like-rumpi]').forEach(b=>b.onclick=()=>Store.likeRumpi(b.dataset.likeRumpi).catch(e=>toast(e.message||'Gagal')));requestAnimationFrame(()=>feed.scrollTop=feed.scrollHeight)}

// --- dari js/app.js baris 203 (pindah verbatim, tanpa ubah logika) ---
function getRumpiSeen(){try{return new Set(JSON.parse(localStorage.getItem('rumpiSeenIds')||'[]'))}catch(e){return new Set()}}

// --- dari js/app.js baris 204 (pindah verbatim, tanpa ubah logika) ---
function markRumpiSeen(){try{const ids=(S.rumpiMessages||[]).filter(m=>!m.seed).map(m=>m.id);localStorage.setItem('rumpiSeenIds',JSON.stringify(ids))}catch(e){}}

// --- dari js/app.js baris 205 (pindah verbatim, tanpa ubah logika) ---
function renderAllRumpi(){renderRumpiFeed('adminRumpiFeedTab','admin');renderRumpiFeed('customerRumpiFeed','customer');renderAdminChatList();if($('#customerRumpiModal')&&$('#customerRumpiModal').classList.contains('open'))markRumpiSeen();const seen=getRumpiSeen(),unread=S.rumpiMessages.filter(message=>!message.seed&&!seen.has(message.id)).length,badge=$('#customerRumpiCount');badge.textContent=unread;badge.hidden=unread===0}

// --- dari js/app.js baris 198 (pindah verbatim, tanpa ubah logika) ---
function renderDirectThread(){const thread=S.directThreads[S.activeDirectThread];if(!thread)return;const feed=$('#directChatFeed');feed.innerHTML='';if(!thread.messages.length){const empty=document.createElement('div');empty.className='empty-note';empty.innerHTML=`<span class="empty-state-icon">${iconSvg('chat')}</span><b>Belum ada percakapan</b><p>Pesan yang dikirim dalam sesi ini akan tampil di sini.</p>`;feed.append(empty)}else thread.messages.forEach(message=>{const own=(S.directChatRole==='admin'&&message.side==='admin')||(S.directChatRole==='customer'&&message.side==='customer');const row=document.createElement('article');row.className='thread-message'+(own?' own':'');const meta=document.createElement('small');meta.textContent=(message.side==='admin'?'Warunge Mimi':thread.name)+' · '+message.time;const bubble=document.createElement('div');bubble.className='thread-bubble';bubble.textContent=message.text;row.append(meta,bubble);feed.append(row)});requestAnimationFrame(()=>feed.scrollTop=feed.scrollHeight);if(S.activeDirectThread==='toko')renderCustomerChatSummary()}

// --- dari js/app.js baris 196 (pindah verbatim, tanpa ubah logika) ---
function renderAdminChatList(){const list=$('#adminChatList');if(!list)return;const rows=Object.entries(S.directThreads).map(([id,thread])=>{const latest=thread.messages[thread.messages.length-1];return `<button class="order-row chat-row admin-chat-entry" data-admin-chat="${id}"><span class="avatar">${thread.initial}</span><span><b>${thread.name}</b><br><small class="chat-preview">${latest?escapeHtml(latest.text):'Belum ada percakapan'}</small></span>${thread.unread?`<span class="chat-unread">${thread.unread}</span>`:latest?`<small class="chat-time">${escapeHtml(latest.time)}</small>`:''}</button>`}).join('');list.innerHTML=rows||'<div class="empty-note">Belum ada percakapan</div>';$$('[data-admin-chat]').forEach(button=>button.onclick=()=>openDirectChat(button.dataset.adminChat,'admin'))}

// --- dari js/app.js baris 197 (pindah verbatim, tanpa ubah logika) ---
function renderCustomerChatSummary(){const thread=S.directThreads.toko,latest=thread&&thread.messages[thread.messages.length-1],badge=$('#customerStoreUnread'),time=$('#customerChatTime');$('#customerChatPreview').textContent=latest?latest.text:'Belum ada percakapan dengan toko.';time.textContent=latest?latest.time:'';time.hidden=!latest;const unread=thread?Number(thread.customerUnread||0):0;badge.textContent=unread;badge.hidden=unread===0}

// --- dari js/app.js baris 200 (pindah verbatim, tanpa ubah logika) ---
function sendDirectMessage(){const input=$('#directChatInput'),text=input.value.trim();if(!text)return toast('Tulis pesan dulu');const role=S.directChatRole;input.value='';$('#directTyping').hidden=true;
/* Tampilkan langsung di UI sebelum kirim (optimistic) */
const tKey=S.activeDirectThread||'toko';
try{
  if(!S.directThreads[tKey])S.directThreads[tKey]={name:role==='admin'?'Pelanggan':'Warunge Mimi',initial:'?',messages:[],unread:0,customerUnread:0};
  S.directThreads[tKey].messages=S.directThreads[tKey].messages||[];
  S.directThreads[tKey].messages.push({id:'tmp-'+Date.now(),side:role,time:'Baru saja',text:text});
  S.directThreads[tKey].lastMessage=text;
  renderDirectThread();
}catch(e){}
Store.sendChatMessage(text).then(()=>{renderDirectThread();renderAdminChatList();toast(role==='admin'?'Balasan terkirim ke pelanggan':'Pesan terkirim ke warung')}).catch(error=>{if(!error||error.code!=='OFFLINE')toast(error&&error.message?error.message:'Pesan gagal dikirim')})}

// --- dari js/app.js baris 206 (pindah verbatim, tanpa ubah logika) ---
function sendAdminRumpi(){const input=$('#adminRumpiInputTab'),text=input.value.trim(),photo=S.pendingAdminRumpiPhoto||'';if(!text&&!photo)return toast('Tulis balasan atau tambah foto dulu');input.value='';Store.sendRumpi(text,photo).then(()=>{setRumpiPhoto('admin','');toast('Postingan tampil di Rumpi pelanggan')}).catch(error=>{if(!error||error.code!=='OFFLINE')toast(error&&error.message?error.message:'Gagal mengirim')})}

// --- dari js/app.js baris 208 (pindah verbatim, tanpa ubah logika) ---
function sendCustomerRumpi(){const input=$('#customerRumpiPost'),text=input.value.trim(),photo=S.pendingCustomerRumpiPhoto||'';if(!text&&!photo)return toast('Tulis kabar atau tambah foto dulu');input.value='';Store.sendRumpi(text,photo).then(()=>{setRumpiPhoto('customer','');toast('Postingan tampil di Rumpi Warga')}).catch(error=>{if(!error||error.code!=='OFFLINE')toast(error&&error.message?error.message:'Gagal mengirim')})}

// --- dari js/app.js baris 207 (pindah verbatim, tanpa ubah logika) ---
function setAdminChatTab(name){$$('[data-admin-chat-tab]').forEach(b=>{const active=b.dataset.adminChatTab===name;b.classList.toggle('active',active);b.setAttribute('aria-selected',active?'true':'false')});const rumpi=name==='rumpi';$('#adminRumpiPanel').hidden=!rumpi;$('#adminTokoPanel').hidden=rumpi;if(rumpi)renderRumpiFeed('adminRumpiFeedTab','admin')}
