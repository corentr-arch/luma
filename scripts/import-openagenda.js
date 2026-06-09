const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmpudGx4YWxiZHVmZ2J1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU3MDU5NSwiZXhwIjoyMDk2MTQ2NTk1fQ.rcdErLkXRN77VMu1aW8yqieduV-t9r-huYpp5AFZRUA';
const OA_PUBLIC_KEY = process.env.OA_PUBLIC_KEY || 'oa_pk_UqPCeyydAMgGPfQQXEPXjmwybioKjmseIZfKnkfdyTurTUZYjaLslHlRexoTVuPS';

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
  { uid: 76126842,  nom: 'Cité des Sciences',        categorie: 'Culture' },
];

// Recherches par mots-clés pour compléter
const RECHERCHES = [
  { q: 'concert paris',        categorie: 'Musique' },
  { q: 'festival paris',       categorie: 'Musique' },
  { q: 'exposition paris',     categorie: 'Art' },
  { q: 'theatre paris',        categorie: 'Art' },
  { q: 'spectacle paris',      categorie: 'Art' },
  { q: 'comedie paris',        categorie: 'Art' },
  { q: 'danse paris',          categorie: 'Art' },
  { q: 'cinema paris',         categorie: 'Art' },
  { q: 'jazz paris',           categorie: 'Musique' },
  { q: 'rock paris',           categorie: 'Musique' },
  { q: 'opera paris',          categorie: 'Musique' },
  { q: 'musique classique paris', categorie: 'Musique' },
  { q: 'sport competition paris', categorie: 'Sport' },
  { q: 'esport gaming paris',  categorie: 'Musique' },
];

// Bounding box stricte Paris + petite couronne
const IDF = { latMin: 48.75, latMax: 48.96, lonMin: 2.20, lonMax: 2.55 };

function estDansIDF(lat, lon) {
  const la = parseFloat(lat), lo = parseFloat(lon);
  return la >= IDF.latMin && la <= IDF.latMax && lo >= IDF.lonMin && lo <= IDF.lonMax;
}

function mappingCategorie(keywords, titre, lieu) {
  const tout = ([
    ...(Array.isArray(keywords) ? keywords.map(k => typeof k === 'string' ? k : k?.fr || '') : [String(keywords || '')]),
    titre || '', lieu || ''
  ]).join(' ').toLowerCase();

  if (tout.includes('gaming') || tout.includes('esport') || tout.includes('jeux video') || tout.includes('game')) return 'Musique';
  if (tout.includes('concert') || tout.includes('musique') || tout.includes('jazz') || tout.includes('rock') || tout.includes('metal') || tout.includes('electro') || tout.includes('rap') || tout.includes('hip') || tout.includes('classique') || tout.includes('festival')) return 'Musique';
  if (tout.includes('sport') || tout.includes('match') || tout.includes('tournoi') || tout.includes('competition') || tout.includes('marathon')) return 'Sport';
  if (tout.includes('march') || tout.includes('brocante') || tout.includes('salon')) return 'Marché';
  if (tout.includes('famille') || tout.includes('enfant') || tout.includes('kids')) return 'Famille';
  if (tout.includes('nature') || tout.includes('jardin') || tout.includes('yoga') || tout.includes('meditation')) return 'Nature & Bien-être';
  if (tout.includes('atelier') || tout.includes('cours') || tout.includes('formation') || tout.includes('conference')) return 'Cours';
  if (tout.includes('solidarite') || tout.includes('benevol') || tout.includes('entraide')) return 'Entraide';
  if (tout.includes('cinema') || tout.includes('film') || tout.includes('expo') || tout.includes('exposition') || tout.includes('art') || tout.includes('theatre') || tout.includes('danse') || tout.includes('spectacle') || tout.includes('opera')) return 'Art';
  return 'Culture';
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
  for (const recherche of RECHERCHES) {
    const agendas = await rechercherAgendas(recherche.q);
    for (const agenda of agendas.slice(0, 3)) {
      if (!agenda.uid) continue;
      const events = await fetchEvenementsAgenda(agenda.uid, recherche.categorie, agenda.title);
      let ajouts = 0;
      for (const ev of events) {
        const e = extraireEvenement(ev, recherche.categorie, agenda.title);
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