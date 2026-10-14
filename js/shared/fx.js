/* KasirQuh Web — js/shared/fx.js
 * Efek visual perayaan (confetti/koin).
 * Diekstrak verbatim dari js/app.js (Tahap 2 modularisasi). */


// --- dari js/app.js baris 291 (pindah verbatim, tanpa ubah logika) ---
function celebrate(kind){try{let layer=document.querySelector('.fx-layer');if(!layer){layer=document.createElement('div');layer.className='fx-layer';document.body.appendChild(layer)}const n=kind==='confetti'?24:12;for(let i=0;i<n;i++){const el=document.createElement('div');if(kind==='confetti'){el.className='fx-piece';const colors=['#f49436','#4d9b65','#e05252','#ffc24d','#7fb3e0'];el.style.background=colors[i%colors.length];el.style.setProperty('--x',(Math.random()*400-200)+'px');el.style.setProperty('--y',(Math.random()*300-150)+'px');el.style.setProperty('--r',(Math.random()*720-360)+'deg')}else{el.className='fx-coin';el.textContent='R';el.style.setProperty('--x',(Math.random()*240-120)+'px');el.style.setProperty('--y',(Math.random()*200-160)+'px')}layer.appendChild(el);setTimeout(()=>el.remove(),1000)}setTimeout(()=>{if(layer&&!layer.children.length)layer.remove()},1200)}catch(e){}}
