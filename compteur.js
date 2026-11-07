// ALKAMO — compteur de visites et d'installations (sans adresse IP enregistrée)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, push, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const LANG = new URL(import.meta.url).searchParams.get('lang') || 'fr';
const cfg = {
  apiKey: "AIzaSyANUNvycyeX7gKEHEzPuZkxsiBaEJ360ps",
  authDomain: "alkamo-3c76e.firebaseapp.com",
  databaseURL: "https://alkamo-3c76e-default-rtdb.firebaseio.com",
  projectId: "alkamo-3c76e",
  storageBucket: "alkamo-3c76e.firebasestorage.app",
  messagingSenderId: "101034335840",
  appId: "1:101034335840:web:f433830959af109193ad05"
};

function lire(k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } }
function ecrire(k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} }

(async function () {
  try {
    // Ne pas compter l'administrateur (posé par la page admin)
    if (lire('alk_no_count') === '1') return;

    const enApp = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) ||
                  navigator.standalone === true ||
                  String(document.referrer).indexOf('android-app://') === 0;
    const db = getDatabase(initializeApp(cfg, 'compteur'));

    // Pays / ville (l'adresse IP n'est jamais enregistrée)
    let pays = '?', ville = '?';
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 4000);
      const r = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: c.signal });
      clearTimeout(t);
      const g = await r.json();
      pays = g.country || '?'; ville = g.city || g.region || '?';
    } catch (e) {}

    const base = { ts: serverTimestamp(), lang: LANG, pays: pays, ville: ville,
                   appareil: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'ordinateur' };

    // 1 visite par session
    if (!lire('alk_v', true)) {
      ecrire('alk_v', '1', true);
      await push(ref(db, 'visites'), Object.assign({ mode: enApp ? 'app' : 'web' }, base));
    }
    // Installation : 1 fois par appareil (première ouverture en application)
    if (enApp && !lire('alk_inst')) {
      ecrire('alk_inst', '1');
      await push(ref(db, 'installations'), Object.assign({ source: 'ouverture-app' }, base));
    }
    // Installation signalée par le navigateur
    window.addEventListener('appinstalled', function () {
      if (lire('alk_inst')) return;
      ecrire('alk_inst', '1');
      push(ref(db, 'installations'), Object.assign({ source: 'navigateur' }, base)).catch(function () {});
    });
  } catch (e) { /* le compteur ne doit jamais gêner le jeu */ }
})();
