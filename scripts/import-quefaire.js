require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables manquantes dans .env.local');
  process.exit(1);
}

const MAX_EVENEMENTS = 3000;

function corrigerDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return d.toISOString();
    const mois = d.getUTCMonth();
    const estEte = mois >= 2 && mois <= 9;
    const offsetMinutes = estEte ? 120 : 60;
    const corrige = new Date(d.getTime() - offsetMinutes * 60 * 1000);
    return corrige.toISOString();
  } catch { return null; }
}

const REGLES_CATEGORIE = [
  ['Gaming', /\b(esport|gaming|jeux.video|nintendo|playstation|xbox|twitch)\b/],
  ['Cinéma', /\b(cinema|ugc|mk2|pathe|gaumont|louxor|film|projection|seance|cine)\b/],
  ['Musique', /\b(concert|festival|jazz|blues|rock|metal|pop|electro|rap|rnb|hip.hop|classique|orchestre|symphonie|recital|chanson|musique|live)\b/],
  ['Théâtre', /\b(theatre|comedie.francaise|odeon|piece.de.theatre|mise.en.scene|danse|ballet|opera|cirque|humour|stand.up|comedie)\b/],
  ['Sport', /\b(sport|fitness|yoga|pilates|running|marathon|match|tournoi|natation|tennis|foot|rugby|basket|gym|zumba)\b/],
  ['Nature & Bien-être', /\b(nature|jardin|jardinage|meditation|sophrologie|bien.etre|balade|foret|ecologie)\b/],
  ['Famille', /\b(enfant|famille|kids|jeunesse|bebe|conte|animation.enfant|scolaire)\b/],
  ['Marché', /\b(marche|brocante|vide.grenier|salon|foire|braderie|puces)\b/],
  ['Entraide', /\b(solidarite|benevol|entraide|humanitaire|don|collecte|association)\b/],
  ['Cours', /\b(conference|debat|atelier|workshop|masterclass|formation|cours|visite.guidee|lecture|livre|patrimoine)\b/],
  ['Art', /\b(exposition|expo|galerie|vernissage|art|peinture|sculpture|photo|musee)\b/],
];

function normaliserTexte(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function mappingCategorie(tags, titre, description, lieu) {
  const texteSignal = normaliserTexte([...(Array.isArray(tags) ? tags : [String(tags || '')]), titre || ''].join(' '));
  for (const [cat, regex] of REGLES_CATEGORIE) if (regex.test(texteSignal)) return cat;

  const texteDesc = normaliserTexte(description || '');
  for (const [cat, regex] of REGLES_CATEGORIE) if (regex.test(texteDesc)) return cat;

  const texteLieu = normaliserTexte(lieu || '');
  for (const [cat, regex] of REGLES_CATEGORIE) if (regex.test(texteLieu)) return cat;

  return 'Art';
}

function estReligieux(r) {
  const tout = [r.title || '', r.lead_text || '', r.address_name || '', (r.tags || []).join(' ')]
    .join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return tout.match(/\b(diocese|paroisse|eglise|cathedrale|messe|catholique|paroissial|chapelle|synagogue|mosquee)\b/);
}

async function fetchPage(offset) {
  const maintenant = new Date().toISOString();
  const url = `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records?limit=100&offset=${offset}&order_by=date_start+asc&where=date_end>='${maintenant}'`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return { results: json.results || [], total: json.total_count || 0 };
}

async function supprimerAnciens() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/evenements_officiels?source=eq.que_faire_paris`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  console.log(`🗑️  Suppression anciens : HTTP ${res.status}`);
}

async function insererLots(evenements) {
  const TAILLE_LOT = 100;
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
    else console.error(`❌ Lot ${i}:`, (await res.text()).slice(0, 200));
    await new Promise(r => setTimeout(r, 80));
  }
  return inseres;
}

async function main() {
  console.log('🚀 Import Que faire à Paris — ordre chronologique');
  console.log('==================================================');

  const premiere = await fetchPage(0);
  const totalDisponible = premiere.total;
  const totalImport = Math.min(totalDisponible, MAX_EVENEMENTS);
  console.log(`📅 ${totalDisponible} événements disponibles — import des ${totalImport} premiers`);

  await supprimerAnciens();

  let tousLesRecords = [...premiere.results];
  const nbPages = Math.ceil(totalImport / 100);

  for (let page = 1; page < nbPages; page++) {
    try {
      const { results } = await fetchPage(page * 100);
      if (results.length === 0) break;
      tousLesRecords.push(...results);
      process.stdout.write(`   Page ${page + 1}/${nbPages} — ${tousLesRecords.length} récupérés\r`);
      await new Promise(r => setTimeout(r, 120));
    } catch (e) {
      console.error(`\n❌ Page ${page + 1}:`, e.message);
      break;
    }
  }

  console.log(`\n   Total récupéré : ${tousLesRecords.length}`);

  const maintenant = new Date();
  const limite = new Date(maintenant.getTime() - 2 * 3600 * 1000);

  const evenements = tousLesRecords
    .filter(r => !estReligieux(r))
    .map(r => {
      try {
        const lat = r.lat_lon?.lat || r.geo_point_2d?.lat;
        const lon = r.lat_lon?.lon || r.geo_point_2d?.lon;
        if (!lat || !lon) return null;
        // Rejette les erreurs de géocodage évidentes (ex. coordonnées au Canada
        // pour un événement censé être à Paris) : large marge autour de l'Île-de-France
        if (lat < 47.5 || lat > 49.8 || lon < 0.5 || lon > 4.5) return null;

        const dateDebutCorrigee = corrigerDate(r.date_start);
        const dateFinCorrigee = corrigerDate(r.date_end);
        const dateRef = dateFinCorrigee ? new Date(dateFinCorrigee) : dateDebutCorrigee ? new Date(dateDebutCorrigee) : null;
        if (dateRef && dateRef < limite) return null;

        const categorie = mappingCategorie(r.tags || [], r.title || '', r.lead_text || r.description || '', r.address_name || '');

        return {
          titre: String(r.title || 'Événement').slice(0, 200),
          description: r.lead_text ? String(r.lead_text).slice(0, 500) : null,
          categorie,
          lieu: r.address_name ? String(r.address_name).slice(0, 200) : null,
          adresse: [r.address_street, r.address_zipcode, r.address_city].filter(Boolean).join(', ').slice(0, 300),
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
          date_debut: dateDebutCorrigee,
          date_fin: dateFinCorrigee,
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
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a.date_debut) return 1;
      if (!b.date_debut) return -1;
      return new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime();
    });

  console.log(`   Valides (sans religieux) : ${evenements.length}`);
  if (evenements.length === 0) { console.log('⚠️  Aucun événement valide'); return; }

  const inseres = await insererLots(evenements);
  console.log(`\n✅ ${inseres} événements insérés`);

  const stats = {};
  evenements.forEach(e => { stats[e.categorie] = (stats[e.categorie] || 0) + 1; });
  console.log('\n📊 Par catégorie :');
  Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([cat, nb]) => console.log(`   ${cat.padEnd(22)} ${nb}`));
}

main().catch(console.error);