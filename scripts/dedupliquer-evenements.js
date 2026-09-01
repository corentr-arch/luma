require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Variables manquantes dans .env.local');
  process.exit(1);
}

// Même événement importé par plusieurs sources (ex. un concert présent à la
// fois dans Que Faire à Paris et OpenAgenda) : on désactive les doublons en
// gardant celui de la source la plus fiable/riche.
const PRIORITE_SOURCE = { ticketmaster: 3, openagenda: 2, que_faire_paris: 1, football: 1 };

const DISTANCE_MAX_METRES = 150;
const SIMILARITE_MIN = 0.6;

// Pas de regex ici (pour éviter tout souci d'échappement) : on filtre
// caractère par caractère.
function normaliserTitre(s) {
  const sansAccents = (s || '').toLowerCase().normalize('NFD');
  let out = '';
  for (const ch of sansAccents) {
    const code = ch.codePointAt(0);
    if (code >= 0x0300 && code <= 0x036f) continue; // diacritiques combinants
    const estAlphaNum = (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
    out += estAlphaNum ? ch : ' ';
  }
  return out.split(' ').filter(Boolean).join(' ');
}

function similariteMots(titreA, titreB) {
  const motsA = new Set(normaliserTitre(titreA).split(' ').filter(m => m.length > 2));
  const motsB = new Set(normaliserTitre(titreB).split(' ').filter(m => m.length > 2));
  if (motsA.size === 0 || motsB.size === 0) return 0;
  let communs = 0;
  for (const m of motsA) if (motsB.has(m)) communs++;
  return communs / Math.min(motsA.size, motsB.size);
}

function distanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function chargerEvenementsActifs() {
  const PAGE = 1000;
  let tous = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${SUPABASE_URL}/rest/v1/evenements_officiels?actif=eq.true&select=id,titre,date_debut,latitude,longitude,source,created_at&order=date_debut.asc,id.asc&offset=${offset}&limit=${PAGE}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    if (!res.ok) throw new Error(`Chargement échoué: HTTP ${res.status}`);
    const page = await res.json();
    tous = tous.concat(page);
    if (page.length < PAGE) break;
  }
  return tous;
}

async function desactiver(ids) {
  if (ids.length === 0) return;
  const TAILLE_LOT = 100;
  for (let i = 0; i < ids.length; i += TAILLE_LOT) {
    const lot = ids.slice(i, i + TAILLE_LOT);
    const filtre = lot.join(',');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/evenements_officiels?id=in.(${filtre})`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ actif: false }),
    });
    if (!res.ok) console.error(`Échec désactivation lot ${i}:`, await res.text());
  }
}

function choisirAGarder(a, b) {
  const prioA = PRIORITE_SOURCE[a.source] || 0;
  const prioB = PRIORITE_SOURCE[b.source] || 0;
  if (prioA !== prioB) return prioA > prioB ? a : b;
  return new Date(a.created_at) <= new Date(b.created_at) ? a : b;
}

async function main() {
  console.log('Déduplication des événements officiels');
  console.log('=======================================');

  const evenements = await chargerEvenementsActifs();
  console.log(`${evenements.length} événements actifs chargés`);

  // Regroupe par jour de date_debut pour limiter les comparaisons (O(n²) par jour, pas sur tout le dataset)
  const parJour = new Map();
  for (const e of evenements) {
    if (!e.date_debut || e.latitude == null || e.longitude == null) continue;
    const jour = e.date_debut.slice(0, 10);
    if (!parJour.has(jour)) parJour.set(jour, []);
    parJour.get(jour).push(e);
  }

  const aDesactiver = new Set();
  const paires = [];

  for (const [, groupe] of parJour) {
    for (let i = 0; i < groupe.length; i++) {
      for (let j = i + 1; j < groupe.length; j++) {
        const a = groupe[i];
        const b = groupe[j];
        if (a.source === b.source) continue; // dédup géré en amont par les scripts d'import eux-mêmes
        if (aDesactiver.has(a.id) || aDesactiver.has(b.id)) continue;

        const dist = distanceMetres(
          parseFloat(a.latitude), parseFloat(a.longitude),
          parseFloat(b.latitude), parseFloat(b.longitude)
        );
        if (dist > DISTANCE_MAX_METRES) continue;

        const sim = similariteMots(a.titre, b.titre);
        if (sim < SIMILARITE_MIN) continue;

        const garde = choisirAGarder(a, b);
        const retire = garde === a ? b : a;
        aDesactiver.add(retire.id);
        paires.push({ garde: garde.titre, retire: retire.titre, source: retire.source, similarite: sim.toFixed(2), distance: Math.round(dist) });
      }
    }
  }

  console.log(`\n${aDesactiver.size} doublon(s) trouvé(s)`);
  paires.slice(0, 30).forEach(p => {
    console.log(`  garde "${p.garde}"  ×  retire "${p.retire}" [${p.source}] (sim=${p.similarite}, ${p.distance}m)`);
  });

  if (aDesactiver.size > 0) {
    await desactiver([...aDesactiver]);
    console.log(`\n✅ ${aDesactiver.size} doublon(s) désactivé(s)`);
  } else {
    console.log('\n✅ Aucun doublon à désactiver');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
