/* KasirQuh Web — js/shared/recipe-form.js
 * Form bahan resep (tambah/hitung ringkasan).
 * Diekstrak verbatim dari js/app.js (Tahap 2 modularisasi). */


// --- dari js/app.js baris 322 (pindah verbatim, tanpa ubah logika) ---
function addIngredientRow(containerId,item){const container=$('#'+containerId),row=document.createElement('div');row.className='ingredient-row';row.innerHTML=`<select aria-label="Pilih produk">${productOptions(item&&item.productId)}</select><input type="text" inputmode="numeric" value="${groupedNumber(item&&item.qty||1)}" aria-label="Jumlah bahan"><button type="button" aria-label="Hapus bahan"><svg class="icon"><use href="#trash"/></svg></button>`;row.querySelector('button').onclick=()=>{if(container.children.length===1)return toast('Minimal satu bahan');row.remove();updateIngredientSummary(containerId)};row.querySelectorAll('select,input').forEach(field=>field.oninput=()=>updateIngredientSummary(containerId));container.append(row);updateIngredientSummary(containerId)}

// --- dari js/app.js baris 323 (pindah verbatim, tanpa ubah logika) ---
function ingredientItems(containerId){return [...$('#'+containerId).children].map(row=>({productId:row.querySelector('select').value,qty:Math.max(1,Number(row.querySelector('input').value)||1)}))}

// --- dari js/app.js baris 324 (pindah verbatim, tanpa ubah logika) ---
function updateIngredientSummary(containerId){const items=ingredientItems(containerId),total=items.reduce((sum,item)=>{const product=S.products.find(p=>p.id===item.productId);return sum+(product?product.price*item.qty:0)},0),target=containerId==='adminRecipeIngredients'?'#adminRecipeSummary':'#myRecipeSummary';$(target).textContent=items.length+' bahan · perkiraan total '+money(total)}
