const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmpudGx4YWxiZHVmZ2J1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU3MDU5NSwiZXhwIjoyMDk2MTQ2NTk1fQ.rcdErLkXRN77VMu1aW8yqieduV-t9r-huYpp5AFZRUA';
const TM_KEY = process.env.TICKETMASTER_KEY || 'gC6tAZ3sD2Cmbng3WNj0wNGQ1IdUmO4x';

function mappingCategorie(segment, genre, subGenre) {
  const tout = [segment, genre, subGenre].join(' ').toLowerCase();
  if (tout.match(/music|concert|festival|rock|pop|jazz|classical|hip.hop|electronic|rap|metal|folk/)) return 'Musique';
  if (tout.match(/sport|football|soccer|basketball|tennis|rugby|athletics|hockey/)) return 'Sport';
  if (tout.match(/theatre|theater|comedy|dance|opera|circus|magic/)) return 'Théâtre';
  if (tout.match(/film|cinema|movie/)) return 'Cinéma';
  if (tout.match(/family|kids|children/)) return 'Famille';
  if (tout.match(/gaming|esport|game/)) return 'Gaming';
  if (tout.match(/art|exhibition|expo/)) return 'Art';
  return 'Art';
}

async function fetchEvenements(page = 0) {
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_KEY}&city=Paris&countryCode=FR&size=200&page=${page}&sort=date,asc&startDateTime=${new Date().toISOString().split('.')[0]}Z`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return {
    events: json._embedded?.events || [],
    totalPages: json.page?.totalPages || 1,
    totalElements: json.page?.totalElements || 0,
  };
}

async function trouverLieuProche(lat, lon) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/trouver_lieu_proche`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ lat, lng: lon, rayon_metres: 300 }),
      }
    );
    const data = await res.json();
    return data?.[0]?.id || null;
  } catch { return null; }
}

async function supprimerAnciens() {
  await fetch(`${SUPABASE_URL}/rest/v1/evenements_officiels?source=eq.ticketmaster`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
}

async function insererLots(evenements) {
  const TAILLE = 50;
  let inseres = 0;
  for (let i = 0; i < evenements.length; i += TAILLE) {
    const lot = evenements.slice(i, i + TAILLE);
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
    else console.error(`❌ Lot ${i}:`, (await res.text()).slice(0, 200));
    await new Promise(r => setTimeout(r, 200));
  }
  return inseres;
}

async function main() {
  console.log('🎟️  Import Ticketmaster Paris');
  console.log('==============================');

  if (TM_KEY.includes('COLLE')) { console.error('❌ Remplace TICKETMASTER_KEY'); process.exit(1); }

  // Test clé
  const test = await fetchEvenements(0);
  console.log(`✅ ${test.totalElements} événements disponibles`);

  await supprimerAnciens();
  console.log('🗑️  Anciens supprimés');

  const tousLesEvenements = [...test.events];
  const nbPages = Math.min(test.totalPages, 5); // max 1000 événements

  for (let page = 1; page < nbPages; page++) {
    try {
      const { events } = await fetchEvenements(page);
      tousLesEvenements.push(...events);
      process.stdout.write(`   Page ${page + 1}/${nbPages} : ${tousLesEvenements.length}\r`);
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`\n❌ Page ${page + 1}:`, e.message);
      break;
    }
  }

  console.log(`\n📋 ${tousLesEvenements.length} événements récupérés`);

  const evenements = [];
  for (const ev of tousLesEvenements) {
    try {
      const venue = ev._embedded?.venues?.[0];
      if (!venue?.location?.latitude || !venue?.location?.longitude) continue;

      const lat = parseFloat(venue.location.latitude);
      const lon = parseFloat(venue.location.longitude);

      // Vérifie que c'est bien en IDF
      if (lat < 48.6 || lat > 49.1 || lon < 1.9 || lon > 2.9) continue;

      const dateStr = ev.dates?.start?.dateTime || ev.dates?.start?.localDate;
      if (!dateStr) continue;
      const date = new Date(dateStr);
      if (date < new Date()) continue;

      const segment = ev.classifications?.[0]?.segment?.name || '';
      const genre = ev.classifications?.[0]?.genre?.name || '';
      const subGenre = ev.classifications?.[0]?.subGenre?.name || '';
      const categorie = mappingCategorie(segment, genre, subGenre);

      // Cherche un lieu officiel proche
      const lieuId = await trouverLieuProche(lat, lon);

      const image = ev.images?.find(i => i.ratio === '16_9' && i.width > 500)?.url
        || ev.images?.[0]?.url || null;

      const prixMin = ev.priceRanges?.[0]?.min || null;
      const prixMax = ev.priceRanges?.[0]?.max || null;

      evenements.push({
        titre: String(ev.name || 'Événement').slice(0, 200),
        description: ev.info ? String(ev.info).slice(0, 500) : null,
        categorie,
        lieu: venue.name ? String(venue.name).slice(0, 200) : null,
        adresse: [venue.address?.line1, venue.postalCode, venue.city?.name].filter(Boolean).join(', ').slice(0, 300),
        latitude: lat,
        longitude: lon,
        date_debut: date.toISOString(),
        date_fin: null,
        url: ev.url || null,
        image_url: image,
        organisateur: ev.promoter?.name || venue.name || null,
        source: 'ticketmaster',
        source_id: String(ev.id),
        gratuit: false,
        prix_min: prixMin,
        prix_max: prixMax,
        ville: venue.city?.name || 'Paris',
        salle: venue.name || null,
        lieu_id: lieuId,
        actif: true,
      });

      await new Promise(r => setTimeout(r, 50));
    } catch { continue; }
  }

  console.log(`✅ ${evenements.length} événements valides`);
  const inseres = await insererLots(evenements);
  console.log(`✅ ${inseres} insérés`);

  const stats = {};
  evenements.forEach(e => { stats[e.categorie] = (stats[e.categorie] || 0) + 1; });
  console.log('\n📊 Par catégorie :');
  Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`   ${c.padEnd(22)} ${n}`));

  const salles = {};
  evenements.filter(e => e.salle).forEach(e => { salles[e.salle] = (salles[e.salle] || 0) + 1; });
  const top = Object.entries(salles).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('\n🎭 Top salles :');
  top.forEach(([s, n]) => console.log(`   ${s.slice(0, 35).padEnd(37)} ${n}`));
}

main().catch(console.error);