/* KasirQuh Web — js/features/admin/scanner.js
 * Diekstrak verbatim dari js/app.js (Tahap 4 modularisasi). */

// --- state modul, dari js/app.js baris 710-710 ---
let barcodeScanner=null,barcodeScanBusy=false,barcodeScanSession=0;
// --- dari js/app.js baris 711 (pindah verbatim, tanpa ubah logika) ---
function barcodeLibReady(){return typeof window!=='undefined'&&typeof window.Html5Qrcode==='function';}
// --- dari js/app.js baris 712 (pindah verbatim, tanpa ubah logika) ---
function setScannerHint(text){const hint=$('#scannerHint');if(hint)hint.textContent=text;}
// --- dari js/app.js baris 780 (pindah verbatim, tanpa ubah logika) ---
async function stopBarcodeScanner(){
  barcodeScanSession++;
  const scanner=barcodeScanner;barcodeScanner=null;barcodeScanBusy=false;
  if(scanner){try{await scanner.stop();}catch(e){}try{scanner.clear();}catch(e){}}
  const viewport=$('#scannerViewport');if(viewport)viewport.innerHTML='';
}
