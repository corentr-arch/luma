// scripts/import-quefaire.js
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmpudGx4YWxiZHVmZ2J1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU3MDU5NSwiZXhwIjoyMDk2MTQ2NTk1fQ.rcdErLkXRN77VMu1aW8yqieduV-t9r-huYpp5AFZRUA';

function mappingCategorie(tags) {
  if (!tags) return 'Culture';
  const t = Array.isArray(tags) ? tags.join(' ').toLowerCase() : String(tags).toLowerCase();
  if (t.includes('sport') || t.includes('fitness') || t.includes('yoga') || t.includes('running')) return 'Sport';
  if (t.includes('concert') || t.includes('musique') || t.includes('festival') || t.includes('jazz') || t.includes('rock')) return 'Musique';
  if (t.includes('march') || t.includes('brocante') || t.includes('vide-grenier')) return 'Marché';
  if (t.includes('famille') || t.includes('enfant') || t.includes('jeune')) return 'Famille';
  if (t.includes('nature') || t.includes('jardin') || t.includes('parc') || t.includes('environnement')) return 'Nature & Bien-être';
  if (t.includes('atelier') || t.includes('cours') || t.includes('formation') || t.includes('conférence')) return 'Cours';
  if (t.includes('solidarité') || t.includes('bénévolat') || t.includes('entraide') || t.includes('social')) return 'Entraide';
  if (t.includes('cinema') || t.includes('film') || t.includes('ciné')) return 'Art';
  if (t.includes('art') || t.includes('expo') || t.includes('théâtre') || t.includes('danse') || t.includes('culture')) return 'Art';
  return 'Culture';
}

async function fetchPage(offset) {
  const url = `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records?limit=100&offset=${offset}&order_by=date_start+desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return { results: json.results || [], total: json.total_count || 0 };
}

async function supprimerAnciens() {
  await fetch(`${SUPABASE_URL}/rest/v1/evenements_officiels?source=eq.que_faire_paris`, {
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
    else console.error(`   ❌ Lot ${Math.floor(i / TAILLE_LOT) + 1}:`, (await res.text()).slice(0, 200));
    await new Promise(r => setTimeout(r, 100));
  }
  return inseres;
}

async function main() {
  console.log('🚀 Import Que faire à Paris');
  console.log('============================');

  if (SUPABASE_SERVICE_KEY === 'COLLE_TA_SERVICE_ROLE_KEY_ICI') {
    console.error('❌ Remplace SUPABASE_SERVICE_KEY'); process.exit(1);
  }

  console.log('🗑️  Suppression anciens...');
  await supprimerAnciens();

  const premiere = await fetchPage(0);
  const total = Math.min(premiere.total, 5000);
  console.log(`📅 ${premiere.total} disponibles — import des ${total} plus récents`);

  let tousLesRecords = [...premiere.results];
  const nbPages = Math.ceil(total / 100);

  for (let page = 1; page < nbPages; page++) {
    try {
      const { results } = await fetchPage(page * 100);
      if (results.length === 0) break;
      tousLesRecords.push(...results);
      process.stdout.write(`   Page ${page + 1}/${nbPages} : ${tousLesRecords.length}\r`);
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.error(`\n   ❌ Page ${page + 1}:`, e.message);
      break;
    }
  }

  console.log(`\n   Total récupéré : ${tousLesRecords.length}`);

  const maintenant = new Date();
  const limite = new Date(maintenant.getTime() - 7 * 24 * 3600 * 1000);

  const evenements = tousLesRecords.map(r => {
    try {
      const lat = r.lat_lon?.lat || r.geo_point_2d?.lat || r.latitude;
      const lon = r.lat_lon?.lon || r.geo_point_2d?.lon || r.longitude;
      if (!lat || !lon) return null;
      const dateDebut = r.date_start ? new Date(r.date_start) : null;
      const dateFin = r.date_end ? new Date(r.date_end) : null;
      const dateRef = dateFin || dateDebut;
      if (dateRef && dateRef < limite) return null;
      return {
        titre: String(r.title || 'Événement').slice(0, 200),
        description: r.lead_text ? String(r.lead_text).slice(0, 500) : null,
        categorie: mappingCategorie(r.tags),
        lieu: r.address_name ? String(r.address_name).slice(0, 200) : null,
        adresse: [r.address_street, r.address_zipcode, r.address_city].filter(Boolean).join(', ').slice(0, 300),
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        date_debut: dateDebut?.toISOString() || null,
        date_fin: dateFin?.toISOString() || null,
        url: r.url || null,
        image_url: r.cover_url || null,
        organisateur: r.contact_name || r.address_name || null,
        source: 'que_faire_paris',
        source_id: String(r.id || Math.random()),
        gratuit: r.price_type === 'free' || !r.price_type,
        ville: 'Paris',
        actif: true,
      };
    } catch { return null; }
  }).filter(Boolean);

  console.log(`   Valides : ${evenements.length}`);
  const inseres = await insererLots(evenements);
  console.log(`\n✅ ${inseres} événements insérés`);

  const stats = {};
  evenements.forEach(e => { stats[e.categorie] = (stats[e.categorie] || 0) + 1; });
  console.log('\n📊 Par catégorie :');
  Object.entries(stats).sort((a, b) => b[1] - a[1])
    .forEach(([cat, nb]) => console.log(`   ${cat.padEnd(20)} ${nb}`));
}

main().catch(console.error);