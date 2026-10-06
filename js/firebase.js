/* KasirQuh Web — js/firebase.js
 *
 * Inisialisasi Firebase (compat SDK v10.12.2) + objek global `FB`
 * yang dipakai lapisan data (js/store.js) dan situs tulis di js/app.js.
 *
 *   FB = {
 *     db, auth,            // firebase.firestore() / firebase.auth()
 *     FieldValue,          // firebase.firestore.FieldValue (increment, dsb.)
 *     serverTimestamp,      // firebase.firestore.FieldValue.serverTimestamp
 *     ready(),              // true bila config terisi & init sukses
 *     requireOnline(),      // melempar Error('Butuh koneksi internet')
 *                           // bila !navigator.onLine — pemanggil WAJIB
 *                           // menangkap dan menampilkan toast jujur
 *   }
 *
 * Bila inisialisasi gagal (config kosong / CDN terblokir), banner jujur
 * ditampilkan di UI — aplikasi tidak diam-diam berjalan tanpa backend.
 */

(function initKasirQuhFirebase() {
  var initError = null;
  var db = null;
  var auth = null;
  var FieldValue = null;

  function configFilled() {
    try {
      return typeof firebaseConfig === 'object' && firebaseConfig !== null
        && typeof firebaseConfig.apiKey === 'string'
        && firebaseConfig.apiKey
        && firebaseConfig.apiKey.indexOf('ISI_') !== 0
        && typeof firebaseConfig.projectId === 'string'
        && !!firebaseConfig.projectId;
    } catch (e) {
      return false;
    }
  }

  function showInitBanner(message) {
    try {
      if (document.getElementById('firebaseInitBanner')) return;
      var banner = document.createElement('div');
      banner.id = 'firebaseInitBanner';
      banner.setAttribute('role', 'alert');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;'
        + 'background:#8f2f23;color:#fff;font:600 13px/1.5 system-ui,sans-serif;'
        + 'padding:10px 14px;text-align:center;';
      banner.textContent = 'KasirQuh Web belum tersambung ke server: ' + message
        + ' Data tidak akan tersimpan.';
      if (document.body) document.body.prepend(banner);
      else document.addEventListener('DOMContentLoaded', function () {
        document.body.prepend(banner);
      });
    } catch (e) { /* jangan pernah mematikan boot karena banner */ }
  }

  try {
    if (typeof firebase === 'undefined') {
      throw new Error('SDK Firebase tidak termuat (periksa koneksi/CDN).');
    }
    if (!configFilled()) {
      throw new Error('konfigurasi Firebase di js/config.js belum diisi.');
    }
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
    FieldValue = firebase.firestore.FieldValue;
  } catch (error) {
    initError = (error && error.message) || String(error);
    showInitBanner(initError);
    if (typeof console !== 'undefined' && console.error) {
      console.error('[KasirQuh] Inisialisasi Firebase gagal:', initError);
    }
  }

  function offlineError() {
    var error = new Error('Butuh koneksi internet');
    error.code = 'OFFLINE';
    return error;
  }

  window.FB = {
    db: db,
    auth: auth,
    FieldValue: FieldValue,
    serverTimestamp: function () {
      return FieldValue ? FieldValue.serverTimestamp() : null;
    },
    ready: function () {
      return !initError && !!db && !!auth;
    },
    initError: function () {
      return initError;
    },
    requireOnline: function () {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw offlineError();
      }
    },
  };
})();
