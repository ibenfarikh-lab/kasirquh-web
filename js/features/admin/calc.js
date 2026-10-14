/* KasirQuh Web — js/features/admin/calc.js
 * Diekstrak verbatim dari js/app.js (Tahap 4 modularisasi). */

// --- dari js/app.js baris 388 (pindah verbatim, tanpa ubah logika) ---
function calcDisplayValue(){if(!S.calcExpression)return '0';return S.calcExpression.replace(/\d+(?:\.\d+)?/g,value=>Number(value).toLocaleString('id-ID',{maximumFractionDigits:2})).replace(/\*/g,' × ').replace(/\//g,' ÷ ').replace(/\+/g,' + ').replace(/-/g,' − ')}
// --- dari js/app.js baris 387 (pindah verbatim, tanpa ubah logika) ---
function calcResult(){const parts=S.calcExpression.match(/\d+(?:\.\d+)?|[+\-*/]/g)||[];if(!parts.length)return 0;let total=Number(parts[0])||0;for(let i=1;i<parts.length-1;i+=2){const op=parts[i],n=Number(parts[i+1]);if(!Number.isFinite(n))continue;if(op==='+')total+=n;else if(op==='-')total-=n;else if(op==='*')total*=n;else if(op==='/'&&n!==0)total/=n}return Math.round(total*100)/100}
