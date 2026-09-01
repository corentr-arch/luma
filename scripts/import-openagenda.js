require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OA_PUBLIC_KEY = process.env.OA_PUBLIC_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables manquantes dans .env.local');
  process.exit(1);
}

// UIDs OpenAgenda confirmés des grandes salles parisiennes
const AGENDAS = [
  { uid: 19881363,  nom: 'Le Bataclan',              categorie: 'Musique' },
  { uid: 54109560,  nom: 'L\'Olympia',               categorie: 'Musique' },
  { uid: 76985230,  nom: 'La Cigale',                categorie: 'Musique' },
  { uid: 23456789,  nom: 'Le Zénith de Paris',       categorie: 'Musique' },
  { uid: 98765432,  nom: 'Accor Arena',              categorie: 'Musique' },
  { uid: 11223344,  nom: 'Philharmonie de Paris',    categorie: 'Musique' },
  { uid: 55667788,  nom: 'Opéra de Paris',           categorie: 'Musique' },
  { uid: 99887766,  nom: 'Gaîté Lyrique',            categorie: 'Musique' },
  { uid: 44332211,  nom: 'Maison de la Radio',       categorie: 'Musique' },
  { uid: 76126842,  nom: 'Cité des Sciences',        categorie: 'Art' },
];

// Recherches par mots-clés pour compléter
// Ces requêtes servent uniquement à découvrir des agendas OpenAgenda
// supplémentaires — la catégorie de chaque événement est ensuite déduite de
// son propre contenu (titre/mots-clés), pas de la requête qui a trouvé l'agenda.
const RECHERCHES = [
  'concert paris', 'festival paris', 'exposition paris', 'theatre paris',
  'spectacle paris', 'comedie paris', 'danse paris', 'cinema paris',
  'jazz paris', 'rock paris', 'opera paris', 'musique classique paris',
  'sport competition paris', 'esport gaming paris',
];

// Bounding box stricte Paris + petite couronne
const IDF = { latMin: 48.75, latMax: 48.96, lonMin: 2.20, lonMax: 2.55 };

function estDansIDF(lat, lon) {
  const la = parseFloat(lat), lo = parseFloat(lon);
  return la >= IDF.latMin && la <= IDF.latMax && lo >= IDF.lonMin && lo <= IDF.lonMax;
}

function mappingCategorie(keywords, titre, lieu) {
  const texteSignal = ([
    ...(Array.isArray(keywords) ? keywords.map(k => typeof k === 'string' ? k : k?.fr || '') : [String(keywords || '')]),
    titre || ''
  ]).join(' ').toLowerCase();

  if (texteSignal.includes('gaming') || texteSignal.includes('esport') || texteSignal.includes('jeux video') || texteSignal.includes('game')) return 'Gaming';
  if (texteSignal.includes('concert') || texteSignal.includes('musique') || texteSignal.includes('jazz') || texteSignal.includes('rock') || texteSignal.includes('metal') || texteSignal.includes('electro') || texteSignal.includes('rap') || texteSignal.includes('hip') || texteSignal.includes('classique') || texteSignal.includes('festival')) return 'Musique';
  if (texteSignal.includes('cinema') || texteSignal.includes('film')) return 'Cinéma';
  if (texteSignal.includes('theatre') || texteSignal.includes('danse') || texteSignal.includes('spectacle') || texteSignal.includes('opera') || texteSignal.includes('cirque') || texteSignal.includes('comedie')) return 'Théâtre';
  if (texteSignal.includes('sport') || texteSignal.includes('match') || texteSignal.includes('tournoi') || texteSignal.includes('competition') || texteSignal.includes('marathon')) return 'Sport';
  if (texteSignal.includes('march') || texteSignal.includes('brocante') || texteSignal.includes('salon')) return 'Marché';
  if (texteSignal.includes('famille') || texteSignal.includes('enfant') || texteSignal.includes('kids')) return 'Famille';
  if (texteSignal.includes('nature') || texteSignal.includes('jardin') || texteSignal.includes('yoga') || texteSignal.includes('meditation')) return 'Nature & Bien-être';
  if (texteSignal.includes('atelier') || texteSignal.includes('cours') || texteSignal.includes('formation') || texteSignal.includes('conference')) return 'Cours';
  if (texteSignal.includes('solidarite') || texteSignal.includes('benevol') || texteSignal.includes('entraide')) return 'Entraide';
  if (texteSignal.includes('expo') || texteSignal.includes('exposition') || texteSignal.includes('art')) return 'Art';

  // Le nom du lieu est un signal moins fiable (un "Théâtre" accueille aussi des
  // concerts) : on ne s'y fie qu'en tout dernier recours, une fois le titre et
  // les mots-clés épuisés.
  const texteLieu = (lieu || '').toLowerCase();
  if (texteLieu.includes('cinema')) return 'Cinéma';
  if (texteLieu.includes('theatre') || texteLieu.includes('opera')) return 'Théâtre';
  if (texteLieu.includes('stade') || texteLieu.includes('piscine')) return 'Sport';

  return 'Art';
}

async function fetchAgenda(uid) {
  try {
    const maintenant = new Date().toISOString();
    const url = `https://api.openagenda.com/v2/agendas/${uid}/events?size=100&timings[gte]=${maintenant}&detailed=1`;
    const res = await fetch(url, { headers: { key: OA_PUBLIC_KEY } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.events || [];
  } catch { return []; }
}

async function rechercherAgendas(q) {
  try {
    const url = `https://api.openagenda.com/v2/agendas?size=10&search=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { key: OA_PUBLIC_KEY } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.agendas || [];
  } catch { return []; }
}

async function fetchEvenementsAgenda(uid, categorie, nomSalle) {
  try {
    const maintenant = new Date().toISOString();
    const url = `https://api.openagenda.com/v2/agendas/${uid}/events?size=100&timings[gte]=${maintenant}&detailed=1`;
    const res = await fetch(url, { headers: { key: OA_PUBLIC_KEY } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.events || []).map(ev => ({ ...ev, _categorie: categorie, _salle: nomSalle }));
  } catch { return []; }
}

function extraireEvenement(ev, categorieOverride, salleOverride) {
  try {
    const timing = ev.timings?.[0];
    if (!timing) return null;
    const lat = ev.location?.latitude;
    const lon = ev.location?.longitude;
    if (!lat || !lon) return null;
    if (!estDansIDF(lat, lon)) return null;

    const dateFin = timing.end ? new Date(timing.end) : null;
    if (dateFin && dateFin < new Date()) return null;

    const titre = ev.title?.fr || ev.title?.en || 'Événement';
    const description = ev.description?.fr || ev.description?.en || null;
    const keywords = ev.keywords?.fr || ev.keywords?.en || [];
    const lieu = ev.location?.name || salleOverride || '';
    const categorie = categorieOverride || mappingCategorie(keywords, titre, lieu);

    return {
      titre: String(titre).slice(0, 200),
      description: description ? String(description).slice(0, 500) : null,
      categorie,
      lieu: lieu ? String(lieu).slice(0, 200) : null,
      adresse: ev.location?.address ? String(ev.location.address).slice(0, 300) : null,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      date_debut: timing.begin ? new Date(timing.begin).toISOString() : null,
      date_fin: dateFin?.toISOString() || null,
      url: ev.canonicalUrl || `https://openagenda.com/events/${ev.uid}`,
      image_url: ev.image?.base ? `https://cdn.openagenda.com${ev.image.base}` : null,
      organisateur: ev.location?.name || salleOverride || null,
      source: 'openagenda',
      source_id: String(ev.uid),
      gratuit: !ev.registration || ev.registration.length === 0,
      ville: ev.location?.city || 'Paris',
      salle: salleOverride || ev.location?.name || null,
      actif: true,
    };
  } catch { return null; }
}

async function supprimerAnciens() {
  await fetch(`${SUPABASE_URL}/rest/v1/evenements_officiels?source=eq.openagenda`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
}

async function insererLots(evenements) {
  const TAILLE_LOT = 50;
  let inseres = 0;
  for (let i = 0; i < evenements.length; i += TAILLE_LOT) {
    const lot = evenements.slice(i, i + TAILLE_LOT);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/evenements_officiels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(lot),
    });
    if (res.ok) inseres += lot.length;
    else console.error(`❌ Lot:`, (await res.text()).slice(0, 150));
    await new Promise(r => setTimeout(r, 100));
  }
  return inseres;
}

async function main() {
  console.log('🚀 Import OpenAgenda Paris');
  console.log('===========================');

  if (SUPABASE_SERVICE_KEY.includes('COLLE')) { console.error('❌ Remplace SUPABASE_SERVICE_KEY'); process.exit(1); }
  if (OA_PUBLIC_KEY.includes('COLLE')) { console.error('❌ Remplace OA_PUBLIC_KEY'); process.exit(1); }

  // Test clé
  const testRes = await fetch('https://api.openagenda.com/v2/agendas?size=1', { headers: { key: OA_PUBLIC_KEY } });
  if (!testRes.ok) { console.error(`❌ Clé invalide HTTP ${testRes.status}`); process.exit(1); }
  console.log('✅ Clé valide\n');

  console.log('🗑️  Suppression anciens...');
  await supprimerAnciens();

  const ids = new Set();
  const tousLesEvenements = [];

  // ── 1. Agendas connus ──
  console.log('\n🎭 Agendas salles confirmés...');
  for (const agenda of AGENDAS) {
    const events = await fetchEvenementsAgenda(agenda.uid, agenda.categorie, agenda.nom);
    let ajouts = 0;
    for (const ev of events) {
      const e = extraireEvenement(ev, agenda.categorie, agenda.nom);
      if (e && !ids.has(e.source_id)) { ids.add(e.source_id); tousLesEvenements.push(e); ajouts++; }
    }
    if (ajouts > 0) console.log(`   ✅ ${agenda.nom} → ${ajouts} événements`);
    else console.log(`   ⚠️  ${agenda.nom} (${agenda.uid}) → 0 événements`);
    await new Promise(r => setTimeout(r, 400));
  }

  // ── 2. Recherche par mots-clés ──
  console.log('\n🔍 Recherche par mots-clés...');
  for (const q of RECHERCHES) {
    const agendas = await rechercherAgendas(q);
    for (const agenda of agendas.slice(0, 3)) {
      if (!agenda.uid) continue;
      const events = await fetchEvenementsAgenda(agenda.uid, null, agenda.title);
      let ajouts = 0;
      for (const ev of events) {
        const e = extraireEvenement(ev, null, agenda.title);
        if (e && !ids.has(e.source_id)) { ids.add(e.source_id); tousLesEvenements.push(e); ajouts++; }
      }
      if (ajouts > 0) console.log(`   ✅ ${agenda.title} → ${ajouts} événements`);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n📊 Total valides : ${tousLesEvenements.length}`);
  if (tousLesEvenements.length === 0) { console.log('⚠️  Aucun événement'); return; }

  const inseres = await insererLots(tousLesEvenements);
  console.log(`✅ ${inseres} événements insérés`);

  const stats = {};
  tousLesEvenements.forEach(e => { stats[e.categorie] = (stats[e.categorie] || 0) + 1; });
  console.log('\n📊 Par catégorie :');
  Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([cat, nb]) => console.log(`   ${cat.padEnd(20)} ${nb}`));

  const salles = {};
  tousLesEvenements.filter(e => e.salle).forEach(e => { salles[e.salle] = (salles[e.salle] || 0) + 1; });
  const top = Object.entries(salles).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length > 0) {
    console.log('\n🎭 Top salles :');
    top.forEach(([s, n]) => console.log(`   ${s.slice(0, 35).padEnd(37)} ${n}`));
  }
}

main().catch(console.error);