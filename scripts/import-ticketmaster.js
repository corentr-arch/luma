// scripts/import-ticketmaster.js
const SUPABASE_URL = 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmpudGx4YWxiZHVmZ2J1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU3MDU5NSwiZXhwIjoyMDk2MTQ2NTk1fQ.rcdErLkXRN77VMu1aW8yqieduV-t9r-huYpp5AFZRUA';
const TICKETMASTER_KEY = 'gC6tAZ3sD2Cmbng3WNj0wNGQ1IdUmO4x';

// Bounding box Île-de-France
const IDF = { latMin: 48.12, latMax: 49.24, lonMin: 1.44, lonMax: 3.56 };

function mappingCategorie(segment, genre) {
  const s = (segment || '').toLowerCase();
  const g = (genre || '').toLowerCase();
  if (s.includes('music') || g.includes('rock') || g.includes('pop') || g.includes('jazz') || g.includes('classical') || g.includes('hip-hop') || g.includes('electronic')) return 'Musique';
  if (s.includes('sport') || g.includes('football') || g.includes('basketball') || g.includes('tennis')) return 'Sport';
  if (s.includes('arts') || s.includes('theatre') || g.includes('dance') || g.includes('ballet') || g.includes('opera') || g.includes('comedy')) return 'Art';
  if (g.includes('family') || g.includes('circus')) return 'Famille';
  return 'Culture';
}

async function fetchEvenements(page) {
  const params = new URLSearchParams({
    apikey: TICKETMASTER_KEY,
    countryCode: 'FR',
    size: '200',
    page: String(page),
    sort: 'date,asc',
  });
  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return {
    events: json._embedded?.events || [],
    totalPages: json.page?.totalPages || 1,
    total: json.page?.totalElements || 0,
  };
}

async function supprimerAnciens() {
  await fetch(`${SUPABASE_URL}/rest/v1/evenements_officiels?source=eq.ticketmaster`, {
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

function transformerEvenement(ev) {
  try {
    const venue = ev._embedded?.venues?.[0];
    const lat = parseFloat(venue?.location?.latitude);
    const lon = parseFloat(venue?.location?.longitude);

    if (!lat || !lon || isNaN(lat) || isNaN(lon)) return null;

    // Filtre géographique IDF côté code
    if (lat < IDF.latMin || lat > IDF.latMax || lon < IDF.lonMin || lon > IDF.lonMax) return null;

    const classification = ev.classifications?.[0];
    const categorie = mappingCategorie(
      classification?.segment?.name,
      classification?.genre?.name
    );

    let dateDebut = null;
    if (ev.dates?.start?.dateTime) {
      dateDebut = new Date(ev.dates.start.dateTime);
    } else if (ev.dates?.start?.localDate) {
      dateDebut = new Date(ev.dates.start.localDate + 'T20:00:00');
    }

    if (dateDebut && dateDebut < new Date()) return null;

    const prix = ev.priceRanges?.[0];
    const image = ev.images?.find(i => i.ratio === '16_9' && i.width > 500)?.url
      || ev.images?.find(i => i.ratio === '16_9')?.url
      || ev.images?.[0]?.url;

    return {
      titre: String(ev.name || 'Événement').slice(0, 200),
      description: ev.info || ev.pleaseNote || null,
      categorie,
      lieu: venue?.name ? String(venue.name).slice(0, 200) : null,
      adresse: [venue?.address?.line1, venue?.postalCode, venue?.city?.name]
        .filter(Boolean).join(', ').slice(0, 300),
      latitude: lat,
      longitude: lon,
      date_debut: dateDebut?.toISOString() || null,
      date_fin: null,
      url: ev.url || null,
      image_url: image || null,
      organisateur: ev.promoter?.name || venue?.name || null,
      source: 'ticketmaster',
      source_id: String(ev.id),
      gratuit: false,
      prix_min: prix?.min || null,
      prix_max: prix?.max || null,
      ville: venue?.city?.name || 'Paris',
      salle: venue?.name || null,
      actif: true,
    };
  } catch { return null; }
}

async function main() {
  console.log('🚀 Import Ticketmaster France → filtre IDF');
  console.log('==========================================');

  if (SUPABASE_SERVICE_KEY === 'COLLE_TA_SERVICE_ROLE_KEY_ICI') {
    console.error('❌ Remplace SUPABASE_SERVICE_KEY'); process.exit(1);
  }
  if (TICKETMASTER_KEY === 'COLLE_TA_CLE_TICKETMASTER_ICI') {
    console.error('❌ Remplace TICKETMASTER_KEY'); process.exit(1);
  }

  console.log('🗑️  Suppression anciens...');
  await supprimerAnciens();

  const ids = new Set();
  const tousLesEvenements = [];

  console.log('\n📅 Récupération tous les événements France...');
  try {
    const premiere = await fetchEvenements(0);
    console.log(`   ${premiere.total} événements disponibles en France`);
    const nbPages = Math.min(premiere.totalPages, 5);

    for (let page = 0; page < nbPages; page++) {
      const { events } = page === 0 ? premiere : await fetchEvenements(page);
      let pageValides = 0;
      for (const ev of events) {
        const e = transformerEvenement(ev);
        if (e && !ids.has(e.source_id)) {
          ids.add(e.source_id);
          tousLesEvenements.push(e);
          pageValides++;
        }
      }
      console.log(`   Page ${page + 1}/${nbPages} : ${events.length} récupérés, ${pageValides} dans IDF`);
      if (page > 0) await new Promise(r => setTimeout(r, 300));
    }
  } catch (e) {
    console.error('❌ Erreur:', e.message);
  }

  console.log(`\n   Total IDF valides : ${tousLesEvenements.length}`);

  if (tousLesEvenements.length === 0) {
    console.log('⚠️  Aucun événement IDF trouvé');
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
  tousLesEvenements.forEach(e => { if (e.salle) salles[e.salle] = (salles[e.salle] || 0) + 1; });
  console.log('\n🎭 Top salles :');
  Object.entries(salles).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([salle, nb]) => console.log(`   ${salle.slice(0, 35).padEnd(37)} ${nb}`));
}

main().catch(console.error);