/* Login sidik jari via WebAuthn + ekstensi PRF.
 *
 * Pola (mirip Native): sidik jari → kunci enkripsi → buka password
 * tersimpan → login Firebase otomatis.
 *
 * - Opt-in eksplisit per akun (tidak aktif diam-diam).
 * - Password dienkripsi AES-GCM dengan kunci dari PRF authenticator;
 *   tanpa sidik jari, blob di IndexedDB tidak bisa dibuka.
 * - Fallback: login manual email+password seperti biasa.
 * - Butuh: HTTPS, browser dukung WebAuthn+PRF (Chrome Android, Edge,
 *   Samsung Internet, Safari 18+). Firefox Android & WebView tidak.
 */
(function () {
  'use strict';

  var DB_NAME = 'kasirquh-bio';
  var STORE = 'keys';
  var RECORD_ID = 'fingerprint-login';

  function bufToB64(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64ToBuf(b64) {
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var s = atob(b64), bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  /* Penyimpanan multi-akun: { enrollments: { email: record } } */
  function dbGetAll() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(RECORD_ID);
        req.onsuccess = function () { resolve(req.result || { enrollments: {} }); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }
  function dbPut(email, record) {
    return dbGetAll().then(function (all) {
      all.enrollments = all.enrollments || {};
      all.enrollments[email] = record;
      return openDb().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(all, RECORD_ID);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(tx.error); };
        });
      });
    });
  }
  function dbDelete(email) {
    return dbGetAll().then(function (all) {
      if (all.enrollments) delete all.enrollments[email];
      return openDb().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(all, RECORD_ID);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(tx.error); };
        });
      });
    });
  }
  /* Migrasi: ubah record lama (single) menjadi format multi-akun */
  function migrateIfNeeded(all) {
    if (all && all.credentialId && all.email && !(all.enrollments)) {
      return { enrollments: (function(){ var o={}; o[all.email]=all; return o; })() };
    }
    return all;
  }

  function prfOutputFrom(res) {
    try {
      var ext = res.getClientExtensionResults && res.getClientExtensionResults();
      return (ext && ext.prf && ext.prf.results && ext.prf.results.first) || null;
    } catch (e) { return null; }
  }

  var Bio = {
    /* Apakah perangkat+ browser mendukung login sidik jari. */
    isSupported: function () {
      if (!window.isSecureContext) return Promise.resolve(false);
      if (!window.PublicKeyCredential) return Promise.resolve(false);
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function')
        return Promise.resolve(false);
      return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function (ok) {
        if (!ok) return false;
        if (typeof PublicKeyCredential.getClientCapabilities === 'function') {
          return PublicKeyCredential.getClientCapabilities().then(function (caps) {
            // prf: true = didukung, undefined = belum tahu (coba saat daftar)
            return caps.prf !== false;
          }).catch(function () { return true; });
        }
        return true;
      }).catch(function () { return false; });
    },

    /* Apakah ada sidik jari terdaftar untuk role ini. */
    isEnrolled: function (role) {
      return dbGetAll().then(function (all) {
        all = migrateIfNeeded(all);
        var ens = (all && all.enrollments) || {};
        if (!role) return Object.keys(ens).length > 0;
        return Object.keys(ens).some(function (em) { return ens[em].role === role; });
      });
    },
    enrolledEmail: function (role) {
      return dbGetAll().then(function (all) {
        all = migrateIfNeeded(all);
        var ens = (all && all.enrollments) || {};
        var keys = Object.keys(ens);
        if (role) keys = keys.filter(function (em) { return ens[em].role === role; });
        return keys.length ? keys[0] : null;
      });
    },

    /* Daftarkan sidik jari: buat kredensial WebAuthn + simpan password terenkripsi.
     * Dipanggil setelah login manual berhasil + user setuju (opt-in).
     *
     * Catatan kompatibilitas: Chrome <147 tidak mengevaluasi PRF saat
     * create(), hanya saat get(). Maka jika create() tidak mengembalikan
     * PRF, langsung lakukan get() sebagai fallback. */
    register: function (email, password, role) {
      var salt = crypto.getRandomValues(new Uint8Array(32));
      var rpId = location.hostname;
      var createdCred = null;
      function getPrfViaGet() {
        return navigator.credentials.get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            allowCredentials: [{ id: createdCred.rawId, type: 'public-key' }],
            userVerification: 'required',
            timeout: 60000,
            extensions: { prf: { eval: { first: salt } } },
          },
        }).then(function (assert) {
          var out = prfOutputFrom(assert);
          if (out) return out;
          // Coba terakhir: evalByCredential (format: {credIdB64: {first: salt}})
          var ebc = {};
          ebc[bufToB64(createdCred.rawId)] = { first: salt };
          return navigator.credentials.get({
            publicKey: {
              challenge: crypto.getRandomValues(new Uint8Array(32)),
              allowCredentials: [{ id: createdCred.rawId, type: 'public-key' }],
              userVerification: 'required',
              timeout: 60000,
              extensions: { prf: { evalByCredential: ebc } },
            },
          }).then(function (assert2) {
            var out2 = prfOutputFrom(assert2);
            if (out2) return out2;
            return Bio.diagnose().then(function (d) {
              var info = 'platform=' + d.platformAuth + ', prf=' +
                ((d.capabilities && d.capabilities.prf !== undefined) ? d.capabilities.prf : '?');
              throw new Error('Perangkat tidak mengembalikan kunci sidik jari (PRF). [' + info + '] Pastikan Chrome terbaru & sidik jari terdaftar di HP.');
            });
          });
        });
      }
      return navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'Warunge Mimi', id: rpId },
          user: {
            id: new TextEncoder().encode(email.slice(0, 64)),
            name: email,
            displayName: email,
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
          authenticatorSelection: {
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          extensions: { prf: { eval: { first: salt } } },
        },
      }).then(function (cred) {
        createdCred = cred;
        var prfOut = prfOutputFrom(cred);
        if (prfOut) return prfOut;
        // Jeda 800ms sebelum fallback (beri waktu credential tersimpan)
        return new Promise(function (res) { setTimeout(res, 800); }).then(getPrfViaGet);
      }).then(function (prfOut) {
        return crypto.subtle.importKey('raw', prfOut, 'AES-GCM', false, ['encrypt'])
          .then(function (key) {
            var iv = crypto.getRandomValues(new Uint8Array(12));
            return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(password))
              .then(function (enc) {
                return dbPut(email, {
                  email: email,
                  role: role || 'customer',
                  credentialId: bufToB64(createdCred.rawId),
                  salt: bufToB64(salt),
                  iv: bufToB64(iv),
                  data: bufToB64(enc),
                  createdAt: Date.now(),
                });
              });
          });
      });
    },

    /* Login dengan sidik jari: verifikasi → dekripsi → {email, password, role}. */
    authenticate: function (role) {
      return dbGetAll().then(function (all) {
        all = migrateIfNeeded(all);
        var ens = (all && all.enrollments) || {};
        var keys = Object.keys(ens);
        if (role) keys = keys.filter(function (em) { return ens[em].role === role; });
        if (!keys.length) throw new Error('Belum ada sidik jari terdaftar di perangkat ini.');
        var stored = ens[keys[0]];
        return navigator.credentials.get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            allowCredentials: [{ id: b64ToBuf(stored.credentialId), type: 'public-key' }],
            userVerification: 'required',
            timeout: 60000,
            extensions: { prf: { eval: { first: b64ToBuf(stored.salt) } } },
          },
        }).then(function (assert) {
          var prfOut = prfOutputFrom(assert);
          if (!prfOut) throw new Error('Gagal membaca sidik jari.');
          return crypto.subtle.importKey('raw', prfOut, 'AES-GCM', false, ['decrypt'])
            .then(function (key) {
              return crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(stored.iv)) },
                key, b64ToBuf(stored.data));
            })
            .then(function (dec) {
              return { email: stored.email, password: new TextDecoder().decode(dec), role: stored.role || 'customer' };
            });
        });
      });
    },

    /* Hapus pendaftaran sidik jari di perangkat ini (semua jika tanpa argumen). */
    remove: function (email) {
      if (email) return dbDelete(email);
      return dbGetAll().then(function (all) {
        all = migrateIfNeeded(all);
        var ens = (all && all.enrollments) || {};
        var ps = Object.keys(ens).map(function (em) { return dbDelete(em); });
        return Promise.all(ps);
      });
    },

    /* Diagnostik: kembalikan detail dukungan per fitur. */
    diagnose: function () {
      var out = {
        secureContext: !!window.isSecureContext,
        webAuthn: !!window.PublicKeyCredential,
        userAgent: navigator.userAgent || '',
      };
      if (!out.webAuthn) return Promise.resolve(out);
      var p1 = typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
        ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function(){return 'error'})
        : Promise.resolve('n/a');
      var p2 = typeof PublicKeyCredential.getClientCapabilities === 'function'
        ? PublicKeyCredential.getClientCapabilities().catch(function(){return 'error'})
        : Promise.resolve('n/a');
      return Promise.all([p1, p2]).then(function (r) {
        out.platformAuth = r[0];
        out.capabilities = r[1];
        return out;
      });
    },
  };

  window.KasirquhBio = Bio;
})();
