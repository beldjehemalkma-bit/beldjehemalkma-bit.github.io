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

function nettoyer(t, n) { return String(t || '').replace(/[<>]/g, '').trim().slice(0, n); }

// D'où vient le visiteur (site qui a donné le lien) — direct si aucun
function provenance() {
  try {
    if (String(document.referrer).indexOf('android-app://') === 0) return 'application';
    if (!document.referrer) return 'direct';
    const h = new URL(document.referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (!h || h === location.hostname.replace(/^www\./, '').toLowerCase()) return 'direct';
    if (/facebook|fb\.com|fb\.me/.test(h)) return 'facebook';
    if (/google/.test(h)) return 'google';
    if (/whatsapp|wa\.me/.test(h)) return 'whatsapp';
    if (/instagram/.test(h)) return 'instagram';
    if (/youtube|youtu\.be/.test(h)) return 'youtube';
    if (/itch\.io/.test(h)) return 'itch.io';
    if (/t\.co$|twitter|x\.com/.test(h)) return 'x';
    if (/bing|duckduckgo|yahoo|ecosia|qwant/.test(h)) return 'moteur de recherche';
    return nettoyer(h, 30);
  } catch (e) { return 'direct'; }
}

function lire(k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } }
function ecrire(k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} }

// Une visite n'est comptée qu'après un vrai geste du visiteur (toucher, clic, touche, défilement) :
// les robots et les analyseurs automatiques n'en font pas et ne sont donc pas comptés.
let _demarre = false;
function surGeste() {
  if (_demarre) return;
  _demarre = true;
  ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'].forEach(function (e) {
    window.removeEventListener(e, surGeste, true);
  });
  compter();
}
['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'].forEach(function (e) {
  window.addEventListener(e, surGeste, { capture: true, passive: true });
});

async function compter() {
  try {
    // Ne pas compter l'administrateur (posé par la page admin)
    if (lire('alk_no_count') === '1') return;

    const enApp = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) ||
                  navigator.standalone === true ||
                  String(document.referrer).indexOf('android-app://') === 0;
    const db = getDatabase(initializeApp(cfg, 'compteur'));

    // Pays / ville (l'adresse IP n'est jamais enregistrée)
    let pays = '?', ville = '?', region = '', operateur = '';
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 4000);
      const r = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: c.signal });
      clearTimeout(t);
      const g = await r.json();
      pays = g.country || '?'; ville = g.city || g.region || '?';
      region = nettoyer(g.region, 60);
      operateur = nettoyer(String(g.organization_name || g.organization || '').replace(/^AS\d+\s*/i, ''), 60);
    } catch (e) {}

    const base = { ts: serverTimestamp(), lang: LANG, pays: pays, ville: ville,
                   appareil: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'ordinateur' };
    if (region) base.region = region;
    if (operateur) base.operateur = operateur;

    // 1 visite par session
    if (!lire('alk_v', true)) {
      ecrire('alk_v', '1', true);
      await push(ref(db, 'visites'), Object.assign({ mode: enApp ? 'app' : 'web', source: provenance() }, base));
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
}
