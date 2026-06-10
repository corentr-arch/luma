const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmpudGx4YWxiZHVmZ2J1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU3MDU5NSwiZXhwIjoyMDk2MTQ2NTk1fQ.rcdErLkXRN77VMu1aW8yqieduV-t9r-huYpp5AFZRUA';
const TM_KEY = process.env.TICKETMASTER_KEY || 'gC6tAZ3sD2Cmbng3WNj0wNGQ1IdUmO4x';

// Coordonnées des salles parisiennes connues
const SALLES_COORDS = {
  // Par nom de venue Ticketmaster → coordonnées
  'Accor Arena':                    { lat: 48.8383, lon: 2.3785 },
  'Accor Hotel Arena':              { lat: 48.8383, lon: 2.3785 },
  'Bercy Arena':                    { lat: 48.8383, lon: 2.3785 },
  'Paris La Défense Arena':         { lat: 48.8975, lon: 2.2295 },
  'Stade de France':                { lat: 48.9244, lon: 2.3601 },
  'Le Zénith de Paris':             { lat: 48.8878, lon: 2.3930 },
  'Zenith Paris':                   { lat: 48.8878, lon: 2.3930 },
  'Zénith Paris - La Villette':     { lat: 48.8878, lon: 2.3930 },
  'L\'Olympia':                     { lat: 48.8710, lon: 2.3311 },
  'Olympia':                        { lat: 48.8710, lon: 2.3311 },
  'Bruno Coquatrix':                { lat: 48.8710, lon: 2.3311 },
  'Le Bataclan':                    { lat: 48.8631, lon: 2.3708 },
  'Bataclan':                       { lat: 48.8631, lon: 2.3708 },
  'La Cigale':                      { lat: 48.8844, lon: 2.3390 },
  'La Boule Noire':                 { lat: 48.8843, lon: 2.3391 },
  'Elysée Montmartre':              { lat: 48.8832, lon: 2.3447 },
  'Élysée Montmartre':              { lat: 48.8832, lon: 2.3447 },
  'Le Trianon':                     { lat: 48.8836, lon: 2.3432 },
  'Trabendo':                       { lat: 48.8937, lon: 2.3940 },
  'La Flèche d\'Or':                { lat: 48.8576, lon: 2.4042 },
  'Café de la Danse':               { lat: 48.8555, lon: 2.3785 },
  'Gaîté Lyrique':                  { lat: 48.8655, lon: 2.3528 },
  'Philharmonie de Paris':          { lat: 48.8916, lon: 2.3941 },
  'Salle Pleyel':                   { lat: 48.8790, lon: 2.3048 },
  'Maison de la Radio':             { lat: 48.8583, lon: 2.2747 },
  'Opéra Garnier':                  { lat: 48.8719, lon: 2.3316 },
  'Opéra Bastille':                 { lat: 48.8532, lon: 2.3693 },
  'Théâtre du Châtelet':            { lat: 48.8585, lon: 2.3469 },
  'Comédie Française':              { lat: 48.8635, lon: 2.3370 },
  'Théâtre de la Ville':            { lat: 48.8583, lon: 2.3471 },
  'Odéon':                          { lat: 48.8508, lon: 2.3394 },
  'Parc des Princes':               { lat: 48.8414, lon: 2.2530 },
  'Roland Garros':                  { lat: 48.8476, lon: 2.2494 },
  'Palais Omnisports de Paris-Bercy': { lat: 48.8383, lon: 2.3784 },
  // Nanterre
  'Paris La Defense Arena':         { lat: 48.8975, lon: 2.2295 },
  'U Arena':                        { lat: 48.8975, lon: 2.2295 },
};

// Coordonnées par ville pour les salles inconnues
const VILLES_COORDS = {
  'Paris':       { lat: 48.8566, lon: 2.3522 },
  'Saint Denis': { lat: 48.9244, lon: 2.3601 }, // Stade de France
  'Nanterre':    { lat: 48.8975, lon: 2.2295 }, // Paris La Défense Arena
  'Versailles':  { lat: 48.8044, lon: 2.1232 },
  'Boulogne':    { lat: 48.8353, lon: 2.2450 },
  'Vincennes':   { lat: 48.8479, lon: 2.4391 },
};

// IDF élargi incluant Saint-Denis et Nanterre
function estEnIDF(lat, lon) {
  return lat >= 48.5 && lat <= 49.2 && lon >= 1.8 && lon <= 3.1;
}

function trouverCoords(venueName, cityName) {
  // Cherche d'abord par nom exact
  if (SALLES_COORDS[venueName]) return SALLES_COORDS[venueName];

  // Cherche par correspondance partielle
  const nomLower = (venueName || '').toLowerCase();
  for (const [nom, coords] of Object.entries(SALLES_COORDS)) {
    if (nomLower.includes(nom.toLowerCase()) || nom.toLowerCase().includes(nomLower)) {
      return coords;
    }
  }

  // Fallback sur la ville
  if (cityName && VILLES_COORDS[cityName]) return VILLES_COORDS[cityName];

  return null;
}

function mappingCategorie(segment, genre, subGenre) {
  const tout = [segment, genre, subGenre].join(' ').toLowerCase();
  if (tout.match(/music|concert|festival|rock|pop|jazz|classical|hip.hop|electronic|rap|metal|folk/)) return 'Musique';
  if (tout.match(/sport|football|soccer|basketball|tennis|rugby|athletics|hockey/)) return 'Sport';
  if (tout.match(/theatre|theater|comedy|dance|opera|circus|magic/)) return 'Théâtre';
  if (tout.match(/film|cinema|movie/)) return 'Cinéma';
  if (tout.match(/family|kids|children/)) return 'Famille';
  if (tout.match(/gaming|esport|game/)) return 'Gaming';
  if (tout.match(/art|exhibition|expo/)) return 'Art';
  return 'Musique'; // Ticketmaster = principalement concerts
}

async function fetchEvenements(page = 0) {
  const maintenant = new Date().toISOString().split('.')[0] + 'Z';
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_KEY}&countryCode=FR&size=200&page=${page}&sort=date,asc&startDateTime=${maintenant}`;
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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/trouver_lieu_proche`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ lat, lng: lon, rayon_metres: 300 }),
    });
    const data = await res.json();
    return data?.[0]?.id || null;
  } catch { return null; }
}

async function supprimerAnciens() {
  await fetch(`${SUPABASE_URL}/rest/v1/evenements_officiels?source=eq.ticketmaster`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
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
    else console.error(`❌ Lot ${i}:`, (await res.text()).slice(0, 300));
    await new Promise(r => setTimeout(r, 200));
  }
  return inseres;
}

async function main() {
  console.log('🎟️  Import Ticketmaster IDF');
  console.log('============================');

  if (TM_KEY === 'COLLE_TA_CLE_ICI') {
    console.error('❌ Remplace TICKETMASTER_KEY'); process.exit(1);
  }

  const test = await fetchEvenements(0);
  console.log(`✅ ${test.totalElements} événements disponibles en France`);

  await supprimerAnciens();
  console.log('🗑️  Anciens supprimés');

  const tousLesEvenements = [...test.events];
  const nbPages = Math.min(test.totalPages, 10);

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
  let sansCoords = 0;
  let horsIDF = 0;

  for (const ev of tousLesEvenements) {
    try {
      const venue = ev._embedded?.venues?.[0];
      if (!venue) continue;

      const venueName = venue.name || '';
      const cityName = venue.city?.name || '';

      // Cherche les coordonnées — API ou table manuelle
      let lat = parseFloat(venue.location?.latitude || '0');
      let lon = parseFloat(venue.location?.longitude || '0');

      // Si coordonnées nulles ou invalides → cherche dans notre table
      if (!lat || !lon || (lat === 0 && lon === 0)) {
        const coords = trouverCoords(venueName, cityName);
        if (coords) {
          lat = coords.lat;
          lon = coords.lon;
        } else {
          sansCoords++;
          continue;
        }
      }

      if (!estEnIDF(lat, lon)) { horsIDF++; continue; }

      const dateStr = ev.dates?.start?.dateTime || ev.dates?.start?.localDate;
      if (!dateStr) continue;
      const date = new Date(dateStr);
      if (date < new Date()) continue;

      const segment = ev.classifications?.[0]?.segment?.name || '';
      const genre = ev.classifications?.[0]?.genre?.name || '';
      const subGenre = ev.classifications?.[0]?.subGenre?.name || '';
      const categorie = mappingCategorie(segment, genre, subGenre);

      const lieuId = await trouverLieuProche(lat, lon);

      const image = ev.images?.find(i => i.ratio === '16_9' && i.width > 500)?.url
        || ev.images?.[0]?.url || null;

      evenements.push({
        titre: String(ev.name).slice(0, 200),
        description: ev.info ? String(ev.info).slice(0, 500) : null,
        categorie,
        lieu: venueName.slice(0, 200),
        adresse: [venue.address?.line1, venue.postalCode, cityName].filter(Boolean).join(', ').slice(0, 300),
        latitude: lat,
        longitude: lon,
        date_debut: date.toISOString(),
        date_fin: null,
        url: ev.url || null,
        image_url: image,
        organisateur: ev.promoter?.name || venueName || null,
        source: 'ticketmaster',
        source_id: String(ev.id),
        gratuit: false,
        prix_min: ev.priceRanges?.[0]?.min || null,
        prix_max: ev.priceRanges?.[0]?.max || null,
        ville: cityName || 'Paris',
        salle: venueName || null,
        lieu_id: lieuId,
        actif: true,
      });

      await new Promise(r => setTimeout(r, 30));
    } catch { continue; }
  }

  console.log(`   Sans coordonnées : ${sansCoords}`);
  console.log(`   Hors IDF : ${horsIDF}`);
  console.log(`✅ ${evenements.length} événements IDF valides`);

  if (evenements.length === 0) {
    console.log('⚠️  Aucun événement — vérifie la clé API');
    return;
  }

  const inseres = await insererLots(evenements);
  console.log(`✅ ${inseres} insérés`);

  const stats = {};
  evenements.forEach(e => { stats[e.categorie] = (stats[e.categorie] || 0) + 1; });
  console.log('\n📊 Par catégorie :');
  Object.entries(stats).sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`   ${c.padEnd(22)} ${n}`));

  console.log('\n🎭 Salles :');
  const salles = {};
  evenements.forEach(e => { if (e.salle) salles[e.salle] = (salles[e.salle] || 0) + 1; });
  Object.entries(salles).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([s, n]) => console.log(`   ${s.slice(0, 35).padEnd(37)} ${n}`));
}

main().catch(console.error);