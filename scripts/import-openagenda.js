// scripts/import-openagenda.js
const SUPABASE_URL = 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmpudGx4YWxiZHVmZ2J1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU3MDU5NSwiZXhwIjoyMDk2MTQ2NTk1fQ.rcdErLkXRN77VMu1aW8yqieduV-t9r-huYpp5AFZRUA';
const OA_PUBLIC_KEY = 'oa_pk_UqPCeyydAMgGPfQQXEPXjmwybioKjmseIZfKnkfdyTurTUZYjaLslHlRexoTVuPS';

// UIDs confirmés via URLs openagenda.com/agendas/UID/events/...
const AGENDAS = [
  { uid: 19881363,  nom: 'Le Bataclan',              categorie: 'Musique' },
  // Les autres on les trouve via recherche par nom
];

// Mots-clés pour la recherche d'agendas Paris
const RECHERCHES_AGENDAS = [
  { q: 'philharmonie paris',     categorie: 'Musique' },
  { q: 'opera paris',            categorie: 'Musique' },
  { q: 'olympia paris',          categorie: 'Musique' },
  { q: 'zenith paris',           categorie: 'Musique' },
  { q: 'accor arena',            categorie: 'Musique' },
  { q: 'cigale paris',           categorie: 'Musique' },
  { q: 'salle pleyel',           categorie: 'Musique' },
  { q: 'maison radio paris',     categorie: 'Musique' },
  { q: 'gaite lyrique',          categorie: 'Musique' },
  { q: 'centre pompidou',        categorie: 'Art' },
  { q: 'palais tokyo paris',     categorie: 'Art' },
  { q: 'comedie francaise',      categorie: 'Art' },
  { q: 'theatre ville paris',    categorie: 'Art' },
  { q: 'chatelet paris',         categorie: 'Art' },
  { q: 'grand rex paris',        categorie: 'Art' },
  { q: 'musee orsay',            categorie: 'Art' },
  { q: 'musee louvre',           categorie: 'Art' },
  { q: 'cite sciences paris',    categorie: 'Culture' },
  { q: 'musee quai branly',      categorie: 'Art' },
  { q: 'fondation louis vuitton', categorie: 'Art' },
];

function mappingCategorie(keywords) {
  if (!keywords) return 'Culture';
  const k = Array.isArray(keywords)
    ? keywords.map(kw => typeof kw === 'string' ? kw : kw?.fr || kw?.en || '').join(' ').toLowerCase()
    : String(keywords).toLowerCase();
  if (k.includes('concert') || k.includes('musique') || k.includes('jazz') || k.includes('rock') || k.includes('festival') || k.includes('music')) return 'Musique';
  if (k.includes('sport') || k.includes('course') || k.includes('marathon') || k.includes('match')) return 'Sport';
  if (k.includes('march') || k.includes('brocante') || k.includes('salon')) return 'Marché';
  if (k.includes('famille') || k.includes('enfant') || k.includes('kids')) return 'Famille';
  if (k.includes('nature') || k.includes('jardin') || k.includes('yoga') || k.includes('bien')) return 'Nature & Bien-être';
  if (k.includes('atelier') || k.includes('cours') || k.includes('formation') || k.includes('conférence')) return 'Cours';
  if (k.includes('solidarité') || k.includes('bénévolat') || k.includes('entraide')) return 'Entraide';
  if (k.includes('exposition') || k.includes('art') || k.includes('théâtre') || k.includes('danse') || k.includes('spectacle') || k.includes('cinema') || k.includes('film')) return 'Art';
  return 'Culture';
}

async function rechercherAgendas(q) {
  try {
    const url = `https://api.openagenda.com/v2/agendas?size=3&search=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { key: OA_PUBLIC_KEY } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.agendas || [];
  } catch { return []; }
}

async function fetchEvenementsAgenda(uid, categorie, nom) {
  try {
    const maintenant = new Date().toISOString();
    const url = `https://api.openagenda.com/v2/agendas/${uid}/events?size=100&timings[gte]=${maintenant}&detailed=1`;
    const res = await fetch(url, { headers: { key: OA_PUBLIC_KEY } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.events || []).map(ev => ({ ...ev, _categorie: categorie, _salle: nom }));
  } catch { return []; }
}

async function fetchEvenementsGeo() {
  const maintenant = new Date().toISOString();
  const tousLesEvents = [];
  let after = null;

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      size: '100',
      'timings[gte]': maintenant,
      'geo[northEast][latitude]': '49.2',
      'geo[northEast][longitude]': '3.5',
      'geo[southWest][latitude]': '48.1',
      'geo[southWest][longitude]': '1.5',
      detailed: '1',
    });
    if (after) params.set('after', JSON.stringify(after));

    const res = await fetch(`https://api.openagenda.com/v2/events?${params}`, {
      headers: { key: OA_PUBLIC_KEY },
    });
    if (!res.ok) { console.log(`   ❌ Géo erreur: HTTP ${res.status}`); break; }
    const json = await res.json();
    const events = json.events || [];
    if (events.length === 0) break;
    tousLesEvents.push(...events);
    after = json.after;
    process.stdout.write(`   Page ${page + 1} : ${tousLesEvents.length} événements\r`);
    if (!after || events.length < 100) break;
    await new Promise(r => setTimeout(r, 250));
  }
  return tousLesEvents;
}

function extraireEvenement(ev, categorieOverride, salleOverride) {
  try {
    const timing = ev.timings?.[0];
    if (!timing) return null;
    const lat = ev.location?.latitude;
    const lon = ev.location?.longitude;
    if (!lat || !lon) return null;
    const dateFin = timing.end ? new Date(timing.end) : null;
    if (dateFin && dateFin < new Date()) return null;
    const titre = ev.title?.fr || ev.title?.en || 'Événement';
    const description = ev.description?.fr || ev.description?.en || null;
    const keywords = ev.keywords?.fr || ev.keywords?.en || [];
    const categorie = categorieOverride || mappingCategorie(keywords);
    return {
      titre: String(titre).slice(0, 200),
      description: description ? String(description).slice(0, 500) : null,
      categorie,
      lieu: ev.location?.name ? String(ev.location.name).slice(0, 200) : salleOverride || null,
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
    else console.error(`   ❌ Lot:`, (await res.text()).slice(0, 150));
    await new Promise(r => setTimeout(r, 100));
  }
  return inseres;
}

async function main() {
  console.log('🚀 Import OpenAgenda Paris/IDF');
  console.log('================================');

  if (SUPABASE_SERVICE_KEY === 'COLLE_TA_SERVICE_ROLE_KEY_ICI') {
    console.error('❌ Remplace SUPABASE_SERVICE_KEY'); process.exit(1);
  }
  if (OA_PUBLIC_KEY === 'COLLE_TA_CLE_OPENAGENDA_ICI') {
    console.error('❌ Remplace OA_PUBLIC_KEY'); process.exit(1);
  }

  // Test clé
  console.log('\n🔑 Test de la clé API...');
  const testRes = await fetch('https://api.openagenda.com/v2/agendas?size=1', {
    headers: { key: OA_PUBLIC_KEY },
  });
  if (!testRes.ok) {
    console.error(`❌ Clé invalide — HTTP ${testRes.status}: ${await testRes.text()}`);
    process.exit(1);
  }
  console.log('✅ Clé valide\n');

  console.log('🗑️  Suppression anciens...');
  await supprimerAnciens();

  const ids = new Set();
  const tousLesEvenements = [];

  // ── 1. Agendas connus ──
  console.log('\n🎭 Agendas confirmés...');
  for (const agenda of AGENDAS) {
    const events = await fetchEvenementsAgenda(agenda.uid, agenda.categorie, agenda.nom);
    let ajouts = 0;
    for (const ev of events) {
      const e = extraireEvenement(ev, agenda.categorie, agenda.nom);
      if (e && !ids.has(e.source_id)) { ids.add(e.source_id); tousLesEvenements.push(e); ajouts++; }
    }
    console.log(`   ${agenda.nom} (${agenda.uid}) → ${ajouts} événements`);
    await new Promise(r => setTimeout(r, 300));
  }

  // ── 2. Recherche d'agendas par nom ──
  console.log('\n🔍 Recherche des agendas par nom...');
  for (const recherche of RECHERCHES_AGENDAS) {
    const agendas = await rechercherAgendas(recherche.q);
    for (const agenda of agendas.slice(0, 2)) {
      if (!agenda.uid) continue;
      const events = await fetchEvenementsAgenda(agenda.uid, recherche.categorie, agenda.title);
      let ajouts = 0;
      for (const ev of events) {
        const e = extraireEvenement(ev, recherche.categorie, agenda.title);
        if (e && !ids.has(e.source_id)) { ids.add(e.source_id); tousLesEvenements.push(e); ajouts++; }
      }
      if (ajouts > 0) console.log(`   ✅ ${agenda.title} (${agenda.uid}) → ${ajouts} événements`);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  // ── 3. Recherche géographique IDF ──
  console.log('\n🗺️  Recherche géographique Paris/IDF...');
  try {
    const eventsGeo = await fetchEvenementsGeo();
    console.log(`\n   ${eventsGeo.length} événements récupérés`);
    let ajoutsGeo = 0;
    for (const ev of eventsGeo) {
      const e = extraireEvenement(ev, null, null);
      if (e && !ids.has(e.source_id)) { ids.add(e.source_id); tousLesEvenements.push(e); ajoutsGeo++; }
    }
    console.log(`   ${ajoutsGeo} nouveaux ajoutés`);
  } catch (e) {
    console.error('❌ Erreur géo:', e.message);
  }

  console.log(`\n📊 Total valides : ${tousLesEvenements.length}`);
  if (tousLesEvenements.length === 0) {
    console.log('⚠️  Aucun événement trouvé');
    return;
  }

  const inseres = await insererLots(tousLesEvenements);
  console.log(`\n✅ ${inseres} événements insérés`);

  const stats = {};
  tousLesEvenements.forEach(e => { stats[e.categorie] = (stats[e.categorie] || 0) + 1; });
  console.log('\n📊 Par catégorie :');
  Object.entries(stats).sort((a, b) => b[1] - a[1])
    .forEach(([cat, nb]) => console.log(`   ${cat.padEnd(20)} ${nb}`));

  const salles = {};
  tousLesEvenements.filter(e => e.salle).forEach(e => { salles[e.salle] = (salles[e.salle] || 0) + 1; });
  const top = Object.entries(salles).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length > 0) {
    console.log('\n🎭 Top salles :');
    top.forEach(([s, n]) => console.log(`   ${s.slice(0, 35).padEnd(37)} ${n}`));
  }
}

main().catch(console.error);