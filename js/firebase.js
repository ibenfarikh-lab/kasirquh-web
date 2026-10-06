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
  var authPersistenceReady = Promise.resolve();
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
    showBanner('KasirQuh Web belum tersambung ke server: ' + message
      + ' Data tidak akan tersimpan.');
  }

  function showBanner(message) {
    try {
      if (document.getElementById('firebaseInitBanner')) return;
      var banner = document.createElement('div');
      banner.id = 'firebaseInitBanner';
      banner.setAttribute('role', 'alert');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;'
        + 'background:#8f2f23;color:#fff;font:600 13px/1.5 system-ui,sans-serif;'
        + 'padding:10px 14px;text-align:center;';
      banner.textContent = message;
      if (document.body) document.body.prepend(banner);
      else document.addEventListener('DOMContentLoaded', function () {
        document.body.prepend(banner);
      });
    } catch (e) { /* jangan pernah mematikan boot karena banner */ }
  }

  /* Diagnostik penyimpanan sesi (SOP 2026-10-07): Firebase Auth web
   * memakai IndexedDB (LOCAL) agar login bertahan antar tab. Kalau
   * browser/HP memblokirnya, SDK diam-diam jatuh ke memori → login
   * hilang tiap tab ditutup. Probe ini mengubah kegagalan diam
   * menjadi pesan jujur di layar. */
  function probeSessionStorage() {
    var blocked = function () {
      showBanner('Browser memblokir penyimpanan di HP ini — login tidak bisa'
        + ' tersimpan, tiap tutup tab harus login lagi. Coba: matikan mode'
        + ' incognito/private, cek Setelan Chrome → Privasi dan keamanan,'
        + ' atau nonaktifkan aplikasi pembersih.');
    };
    try {
      if (typeof indexedDB === 'undefined') { blocked(); return; }
      var req = indexedDB.open('__kasirquh_probe');
      req.onerror = blocked;
      req.onsuccess = function () {
        try { indexedDB.deleteDatabase('__kasirquh_probe'); } catch (e) {}
      };
    } catch (e) { blocked(); }
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

    /* Persistensi login dikunci di satu tempat: Firebase Auth LOCAL.
     * Ini bukan penyimpanan password/token di localStorage. Firebase yang
     * mengelola kredensial sesi melalui storage resminya (IndexedDB).
     * Hasil promise diekspos agar lapisan Store tidak balapan dengan boot. */
    authPersistenceReady = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(function (error) {
        var message = (error && error.message) || String(error);
        showBanner('Penyimpanan login gagal diaktifkan — login tidak akan dijaga tetap masuk. ' + message);
        if (typeof console !== 'undefined' && console.error) {
          console.error('[KasirQuh] Firebase Auth LOCAL persistence gagal:', error);
        }
        throw error;
      });

    FieldValue = firebase.firestore.FieldValue;
    probeSessionStorage();
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
    authPersistenceReady: authPersistenceReady,
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
