/* KasirQuh Web — js/shared/format.js
 * Fungsi format & parsing (uang, angka, stok, tanggal).
 * Diekstrak verbatim dari js/app.js (Tahap 1 modularisasi). */

// --- dari js/app.js baris 4 (pindah verbatim, tanpa ubah logika) ---
const money=n=>'Rp'+Number(n||0).toLocaleString('id-ID');
// --- dari js/app.js baris 5 (pindah verbatim, tanpa ubah logika) ---
const numericValue=value=>Number(String(value||'').replace(/\D/g,''))||0;
// --- dari js/app.js baris 6 (pindah verbatim, tanpa ubah logika) ---
const groupedNumber=value=>{const digits=String(value??'').replace(/\D/g,'');return digits?Number(digits).toLocaleString('id-ID'):''};
// --- dari js/app.js baris 7 (pindah verbatim, tanpa ubah logika) ---
const DECIMAL_STOCK_UNITS=['kg','kilogram','liter','l','ltr'];
// --- dari js/app.js baris 8 (pindah verbatim, tanpa ubah logika) ---
const isDecimalUnit=unit=>DECIMAL_STOCK_UNITS.includes(String(unit||'pcs').toLowerCase());
// --- dari js/app.js baris 9 (pindah verbatim, tanpa ubah logika) ---
function stockText(product){const stock=Number(product.stock)||0;return isDecimalUnit(product.unit)?stock.toLocaleString('id-ID',{maximumFractionDigits:2}):String(Math.round(stock))}
// --- dari js/app.js baris 10 (pindah verbatim, tanpa ubah logika) ---
function parseDecimalInput(value){let s=String(value??'').trim();if(!s)return 0;s=s.replace(/\./g,'').replace(',','.');const n=Number(s.replace(/[^0-9.\-]/g,''));return Number.isFinite(n)?n:0}
// --- dari js/app.js baris 11 (pindah verbatim, tanpa ubah logika) ---
function formatNumericInput(input){if(!input||!input.matches('input[inputmode="numeric"]'))return;if(input.dataset.decimal==='1')return;const formatted=groupedNumber(input.value);if(input.value!==formatted)input.value=formatted}
// --- dari js/app.js baris 12 (pindah verbatim, tanpa ubah logika) ---
function formatNumericInputs(root){(root||document).querySelectorAll('input[inputmode="numeric"]').forEach(formatNumericInput)}
// --- dari js/app.js baris 268 (pindah verbatim, tanpa ubah logika) ---
function formatPurchaseDate(key){const date=new Date(key+'T12:00:00');return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date)}
// --- dari js/app.js baris 312 (pindah verbatim, tanpa ubah logika) ---
function isWeightUnit(u){return ['kg','ons','gram'].indexOf(u)>=0;}
// --- dari js/app.js baris 339 (pindah verbatim, tanpa ubah logika) ---
function productOptions(selected){return S.products.map(product=>`<option value="${product.id}"${product.id===selected?' selected':''}>${escapeHtml(product.name)}</option>`).join('')}
// --- dari js/app.js baris 368 (pindah verbatim, tanpa ubah logika) ---
function normalizedEmail(value){return String(value||'').trim().toLocaleLowerCase('id-ID')}
