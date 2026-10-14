/* KasirQuh Web — js/features/customer/recipes.js
 * Ide Masak sisi pelanggan (pure helpers).
 * Diekstrak verbatim dari js/app.js (Tahap 3 modularisasi). */

// --- dari js/app.js baris 253 (pindah verbatim, tanpa ubah logika) ---
function recipeIngredientsText(recipe){return recipe.items.map(item=>{const product=S.products.find(p=>p.id===item.productId);return product?(product.name+' ×'+item.qty):''}).filter(Boolean).join(', ')}


// --- dari js/app.js baris 255 (pindah verbatim, tanpa ubah logika) ---
function findRecipe(id,owner){return (owner==='mine'?S.myRecipes:(S.recipes||[])).find(recipe=>recipe.id===id)}

