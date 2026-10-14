/* KasirQuh Web — js/features/admin/scanner.js
 * Scanner simpel: getUserMedia langsung + BarcodeDetector bawaan browser.
 * Tanpa library eksternal. */

// --- state modul ---
let barcodeStream=null,barcodeDetectTimer=null,barcodeScanBusy=false,barcodeScanSession=0;

function barcodeLibReady(){return typeof window!=='undefined'&&'BarcodeDetector' in window;}

function setScannerHint(text){const hint=$('#scannerHint');if(hint)hint.textContent=text;}

async function stopBarcodeScanner(){
  barcodeScanSession++;
  barcodeScanBusy=false;
  if(barcodeDetectTimer){clearInterval(barcodeDetectTimer);barcodeDetectTimer=null;}
  if(barcodeStream){try{barcodeStream.getTracks().forEach(t=>t.stop());}catch(e){}barcodeStream=null;}
  const viewport=$('#scannerViewport');if(viewport)viewport.innerHTML='';
}
