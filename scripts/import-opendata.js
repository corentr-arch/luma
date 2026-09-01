// scripts/import-opendata.js
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables manquantes dans .env.local');
  process.exit(1);
}

// Convertit coordonnées Lambert 93 (EPSG:2154) en WGS84
function lambertToWGS84(x, y) {
  if (!x || !y) return { lat: null, lon: null };
  // Constantes Lambert 93
  const n = 0.7256077650;
  const c = 11754255.426;
  const Xs = 700000.0;
  const Ys = 12655612.050;
  const e = 0.0818191910435;
  const lambda0 = 0.05235987756;

  const R = Math.sqrt((x - Xs) ** 2 + (y - Ys) ** 2);
  const gamma = Math.atan((x - Xs) / (Ys - y));
  const lambda = lambda0 + gamma / n;
  const latIso = -1 / n * Math.log(Math.abs(R / c));

  let lat = 2 * Math.atan(Math.exp(latIso)) - Math.PI / 2;
  for (let i = 0; i < 10; i++) {
    lat = 2 * Math.atan(
      Math.exp(latIso) * ((1 + e * Math.sin(lat)) / (1 - e * Math.sin(lat))) ** (e / 2)
    ) - Math.PI / 2;
  }

  return {
    lat: lat * 180 / Math.PI,
    lon: lambda * 180 / Math.PI,
  };
}

const SOURCES = [
  {
    label: 'Défibrillateurs',
    categorie: 'Santé',
    sous_categorie: 'Défibrillateur',
    pages: 15,
    url: (offset) =>
      `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/defibrillateurs/records?limit=100&offset=${offset}`,
    extraire: (r) => ({
      nom: r.nom_du_site || r.lib_type || 'Défibrillateur',
      adresse: r.adresse || '',
      latitude: r.geo_point_2d?.lat,
      longitude: r.geo_point_2d?.lon,
      horaires: r.acc_lib || null,
    }),
  },
  {
    label: 'Fontaines à boire',
    categorie: 'Eau potable',
    sous_categorie: 'Fontaine',
    pages: 15,
    url: (offset) =>
      `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/fontaines-a-boire/records?limit=100&offset=${offset}`,
    extraire: (r) => ({
      nom: r.type_objet || 'Fontaine à boire',
      adresse: [r.voie, r.commune].filter(Boolean).join(', '),
      latitude: r.geo_point_2d?.lat,
      longitude: r.geo_point_2d?.lon,
    }),
  },
  {
    label: 'Toilettes publiques',
    categorie: 'Toilettes',
    sous_categorie: 'Sanisette',
    pages: 10,
    url: (offset) =>
      `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/sanisettesparis2011/records?limit=100&offset=${offset}`,
    extraire: (r) => ({
      nom: r.type || 'Toilettes publiques',
      adresse: r.adresse || '',
      latitude: r.geo_point_2d?.lat,
      longitude: r.geo_point_2d?.lon,
      horaires: r.horaire || null,
      description: r.acces_pmr === 'Oui' ? 'Accessible PMR' : null,
    }),
  },
  {
    label: 'Équipements ville (piscines, biblis, musées, parcs)',
    categorie: 'multiple',
    sous_categorie: null,
    pages: 30,
    url: (offset) =>
      `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/ilots-de-fraicheur-equipements-activites/records?limit=100&offset=${offset}`,
    extraire: (r) => {
      let categorie = 'Services publics';
      let sous_categorie = r.type || 'Équipement';
      const type = (r.type || '').toLowerCase();
      if (type.includes('piscine')) { categorie = 'Sport'; sous_categorie = 'Piscine'; }
      else if (type.includes('gymnase') || type.includes('stade') || type.includes('sport')) { categorie = 'Sport'; sous_categorie = 'Équipement sportif'; }
      else if (type.includes('biblioth')) { categorie = 'Culture'; sous_categorie = 'Bibliothèque'; }
      else if (type.includes('mus')) { categorie = 'Culture'; sous_categorie = 'Musée'; }
      else if (type.includes('parc') || type.includes('jardin') || type.includes('bois')) { categorie = 'Nature'; sous_categorie = 'Parc'; }
      else if (type.includes('march')) { categorie = 'Marché'; sous_categorie = 'Marché'; }
      else if (type.includes('cin')) { categorie = 'Culture'; sous_categorie = 'Cinéma'; }
      else if (type.includes('spectacle') || type.includes('theatre') || type.includes('théâtre')) { categorie = 'Culture'; sous_categorie = 'Salle de spectacle'; }
      return {
        nom: r.nom || r.name || sous_categorie,
        adresse: r.adresse || r.address || '',
        latitude: r.coordonnees?.lat || r.geo_point_2d?.lat,
        longitude: r.coordonnees?.lon || r.geo_point_2d?.lon,
        horaires: r.horaires || r.opening_time || null,
        description: r.detail || null,
        _categorie_override: categorie,
        sous_categorie,
      };
    },
  },
  {
    label: 'Jardins et espaces verts',
    categorie: 'Nature',
    sous_categorie: 'Espace vert',
    pages: 10,
    debug: true,
    url: (offset) =>
      `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/espaces_verts/records?limit=100&offset=${offset}`,
    extraire: (r) => ({
      nom: r.nom_ev || 'Espace vert',
      adresse: r.adresse_ev || r.arrondissement || '',
      // Essaie tous les champs géo possibles
      latitude: r.geo_point_2d?.lat
        || r.geom_x_y?.lat
        || r.coordonnees?.lat
        || r.centroid?.lat
        || r.geo_shape?.geometry?.coordinates?.[1],
      longitude: r.geo_point_2d?.lon
        || r.geom_x_y?.lon
        || r.coordonnees?.lon
        || r.centroid?.lon
        || r.geo_shape?.geometry?.coordinates?.[0],
      description: r.type_ev || null,
      sous_categorie: r.type_ev || 'Espace vert',
    }),
  },
  {
    label: 'Équipements sportifs de proximité',
    categorie: 'Sport',
    sous_categorie: 'Équipement sportif',
    pages: 20,
    url: (offset) =>
      `https://equipements.sports.gouv.fr/api/explore/v2.1/catalog/datasets/data-es/records?limit=100&offset=${offset}&refine=dep_code%3A%2275%22`,
    extraire: (r) => {
      // Les coordonnées sont en Lambert 93 (equip_x, equip_y) — on convertit
      const coords = lambertToWGS84(
        parseFloat(r.equip_x),
        parseFloat(r.equip_y)
      );
      // Vérifie que les coordonnées sont dans Paris
      const lat = coords.lat;
      const lon = coords.lon;
      const dansParis = lat > 48.8 && lat < 48.92 && lon > 2.22 && lon < 2.47;
      return {
        nom: r.inst_nom || r.equip_nom || 'Équipement sportif',
        adresse: [r.inst_adresse, r.inst_cp, r.new_name].filter(Boolean).join(', '),
        latitude: dansParis ? lat : null,
        longitude: dansParis ? lon : null,
        sous_categorie: r.equip_type_name || r.equip_type_famille || 'Équipement sportif',
      };
    },
  },
  {
    label: 'Marchés parisiens',
    categorie: 'Marché',
    sous_categorie: 'Marché',
    pages: 3,
    url: (offset) =>
      `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/marches-decouverts/records?limit=100&offset=${offset}`,
    extraire: (r) => ({
      nom: r.nom_long || r.nom_court || 'Marché',
      adresse: r.localisation || '',
      latitude: r.geo_point_2d?.lat,
      longitude: r.geo_point_2d?.lon,
      horaires: r.jours_horaires || null,
    }),
  },
  {
    label: 'Mairies d\'arrondissement',
    categorie: 'Services publics',
    sous_categorie: 'Mairie',
    pages: 1,
    url: (offset) =>
      `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/arrondissements/records?limit=100&offset=${offset}`,
    extraire: (r) => ({
      nom: `Mairie du ${r.l_ar || r.c_ar || 'arrondissement'}`,
      adresse: r.l_aroff || '',
      latitude: r.geom_x_y?.lat,
      longitude: r.geom_x_y?.lon,
    }),
  },
  {
    label: 'Vélib (stations)',
    categorie: 'Mobilité',
    sous_categorie: 'Station Vélib',
    pages: 20,
    url: (offset) =>
      `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?limit=100&offset=${offset}`,
    extraire: (r) => ({
      nom: r.name || 'Station Vélib',
      adresse: r.name || '',
      latitude: r.coordonnees_geo?.lat,
      longitude: r.coordonnees_geo?.lon,
      description: r.capacity ? `${r.capacity} places` : null,
    }),
  },
  {
    label: 'Festivals Île-de-France',
    categorie: 'Musique',
    sous_categorie: 'Festival',
    pages: 10,
    debug: true,
    // Sans refine pour récupérer tous les festivals puis filtrer IDF
    url: (offset) =>
      `https://data.culture.gouv.fr/api/explore/v2.1/catalog/datasets/festivals-global-festivals-_-pl/records?limit=100&offset=${offset}&where=region_principale%20like%20%22%25Ile%25%22`,
    extraire: (r) => ({
      nom: r.nom_du_festival || 'Festival',
      adresse: [r.adresse_postale, r.code_postal_de_la_commune, r.commune_principale].filter(Boolean).join(', '),
      latitude: r.geo_point?.lat
        || r.geocodage_xy?.lat
        || r.geolocalisation?.lat
        || r.coordonnees_insee?.lat
        || r.latitude,
      longitude: r.geo_point?.lon
        || r.geocodage_xy?.lon
        || r.geolocalisation?.lon
        || r.coordonnees_insee?.lon
        || r.longitude,
      horaires: r.periode_principale_de_deroulement_du_festival || null,
      description: r.discipline_dominante || null,
    }),
  },
  {
    label: 'Cinémas Paris',
    categorie: 'Culture',
    sous_categorie: 'Cinéma',
    pages: 2,
    url: (offset) =>
      `https://data.culture.gouv.fr/api/explore/v2.1/catalog/datasets/etablissements-cinematographiques/records?limit=100&offset=${offset}&refine=dep%3A75`,
    extraire: (r) => ({
      nom: r.nom || r.nom_etablissement || 'Cinéma',
      adresse: [r.adresse, r.cp, r.commune].filter(Boolean).join(', '),
      // D'après le debug : champs latitude et longitude directs + geolocalisation
      latitude: r.latitude
        || r.geolocalisation?.lat
        || r.geo_point_2d?.lat,
      longitude: r.longitude
        || r.geolocalisation?.lon
        || r.geo_point_2d?.lon,
    }),
  },
];

async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.results || [];
}

async function supprimerCategorie(categorie) {
  if (categorie === 'multiple') return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/lieux_officiels?categorie=eq.${encodeURIComponent(categorie)}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
}

async function insererLots(lieux) {
  const TAILLE_LOT = 50;
  let inseres = 0;
  for (let i = 0; i < lieux.length; i += TAILLE_LOT) {
    const lot = lieux.slice(i, i + TAILLE_LOT);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/lieux_officiels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(lot),
    });
    if (res.ok) inseres += lot.length;
    else {
      const err = await res.text();
      console.error(`   ❌ Lot ${Math.floor(i / TAILLE_LOT) + 1}:`, err.slice(0, 150));
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return inseres;
}

async function importerSource(source) {
  console.log(`\n📥 ${source.label} (${source.categorie})`);
  const tousLesRecords = [];

  for (let page = 0; page < source.pages; page++) {
    const offset = page * 100;
    try {
      const records = await fetchPage(source.url(offset));
      if (records.length === 0) break;

      if (page === 0 && source.debug && records[0]) {
        console.log(`   🔍 Champs : ${Object.keys(records[0]).slice(0, 20).join(', ')}...`);
        console.log(`   🔍 Premier : ${JSON.stringify(records[0]).slice(0, 300)}`);
      }

      tousLesRecords.push(...records);
      process.stdout.write(`   Page ${page + 1} : ${records.length}\n`);
      if (records.length < 100) break;
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`   ❌ Page ${page + 1}:`, e.message);
      break;
    }
  }

  console.log(`   Total brut : ${tousLesRecords.length}`);

  const lieux = tousLesRecords
    .map(r => {
      try { return source.extraire(r); } catch { return null; }
    })
    .filter(l => l
      && l.latitude && l.longitude
      && !isNaN(parseFloat(l.latitude))
      && !isNaN(parseFloat(l.longitude))
      && parseFloat(l.latitude) !== 0
      && parseFloat(l.longitude) !== 0
    )
    .map(l => ({
      nom: String(l.nom || 'Lieu').slice(0, 200),
      categorie: l._categorie_override || source.categorie,
      sous_categorie: l.sous_categorie || source.sous_categorie || null,
      adresse: String(l.adresse || '').slice(0, 300),
      latitude: parseFloat(l.latitude),
      longitude: parseFloat(l.longitude),
      telephone: l.telephone ? String(l.telephone).slice(0, 50) : null,
      horaires: l.horaires ? String(l.horaires).slice(0, 300) : null,
      description: l.description ? String(l.description).slice(0, 300) : null,
      source: 'opendata_paris',
      actif: true,
    }));

  console.log(`   Valides : ${lieux.length}`);
  if (lieux.length === 0) { console.log(`   ⚠️  Aucun lieu valide`); return 0; }

  await supprimerCategorie(source.categorie);
  const inseres = await insererLots(lieux);
  console.log(`   ✅ ${inseres} insérés`);
  return inseres;
}

async function afficherStats() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/lieux_officiels?select=categorie`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const data = await res.json();
  const stats = {};
  data.forEach(l => { stats[l.categorie] = (stats[l.categorie] || 0) + 1; });
  console.log('\n📊 Résumé final :');
  Object.entries(stats).sort((a, b) => b[1] - a[1])
    .forEach(([cat, nb]) => console.log(`   ${cat.padEnd(25)} ${nb}`));
  console.log(`   ${'TOTAL'.padEnd(25)} ${data.length}`);
}

async function main() {
  console.log('🚀 Import Open Data → Supabase Luma');
  console.log('=====================================');

  if (SUPABASE_SERVICE_KEY === 'COLLE_TA_SERVICE_ROLE_KEY_ICI') {
    console.error('\n❌ Remplace SUPABASE_SERVICE_KEY par ta vraie clé');
    process.exit(1);
  }

  let total = 0;
  const erreurs = [];

  for (const source of SOURCES) {
    try {
      total += await importerSource(source);
    } catch (e) {
      console.error(`\n❌ Erreur fatale ${source.label}:`, e.message);
      erreurs.push(source.label);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  await afficherStats();
  console.log(`\n✅ Import terminé — ${total} lieux insérés`);
  if (erreurs.length > 0) console.log(`⚠️  Erreurs : ${erreurs.join(', ')}`);
}

main().catch(console.error);