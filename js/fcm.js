/* KasirQuh — Firebase Cloud Messaging (Push Notification)
 *
 * PENTING: VAPID_KEY harus diisi dari Firebase Console
 * (Project Settings → Cloud Messaging → Web Push certificates).
 * Tanpa VAPID key, getToken() akan gagal.
 */
const FCM_VAPID_KEY = ''; // TODO: isi dari Firebase Console

const FCM = {
  messaging: null,
  token: null,
  initialized: false,

  /* Inisialisasi FCM (dipanggil setelah Firebase ready & user login) */
  async init() {
    if (this.initialized) return true;
    try {
      if (!('Notification' in window)) {
        console.log('[FCM] Browser tidak mendukung notifikasi');
        return false;
      }
      if (!firebase.messaging.isSupported()) {
        console.log('[FCM] Messaging tidak didukung browser ini');
        return false;
      }
      this.messaging = firebase.messaging();
      this.initialized = true;

      // Foreground message handler
      this.messaging.onMessage((payload) => {
        const title = (payload.notification && payload.notification.title) || 'Warunge Mimi';
        const body = (payload.notification && payload.notification.body) || 'Ada kabar baru';
        // Tampilkan sebagai toast + notifikasi browser jika diizinkan
        if (typeof toast === 'function') toast(title + ': ' + body);
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/assets/img/img-005.png' });
        }
      });

      return true;
    } catch (e) {
      console.log('[FCM] Init gagal:', e.message);
      return false;
    }
  },

  /* Minta izin notifikasi ke user */
  async requestPermission() {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      return false;
    }
  },

  /* Ambil token FCM dan simpan ke Firestore */
  async registerToken() {
    if (!this.initialized) await this.init();
    if (!this.messaging) return null;
    if (!FCM_VAPID_KEY) {
      console.log('[FCM] VAPID_KEY belum diisi — token tidak bisa diambil');
      return null;
    }
    try {
      const granted = await this.requestPermission();
      if (!granted) {
        console.log('[FCM] Izin notifikasi ditolak user');
        return null;
      }
      const token = await this.messaging.getToken({ vapidKey: FCM_VAPID_KEY });
      if (!token) return null;
      this.token = token;

      // Simpan token ke Firestore (per user/device)
      const uid = (window.S && (S.activeCustomerId || S.activeAdminId)) || 'anon';
      const db = firebase.firestore();
      await db.collection('fcm_tokens').doc(uid + '_' + token.slice(-12)).set({
        uid: uid,
        token: token,
        platform: 'web',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      console.log('[FCM] Token terdaftar');
      return token;
    } catch (e) {
      console.log('[FCM] Register gagal:', e.message);
      return null;
    }
  },

  /* Hapus token saat logout */
  async unregisterToken() {
    if (!this.messaging || !this.token) return;
    try {
      await this.messaging.deleteToken();
      this.token = null;
    } catch (e) {}
  },
};

window.FCM = FCM;
