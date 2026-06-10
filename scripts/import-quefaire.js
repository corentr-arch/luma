const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jsvnuvjntlxalbdufgbu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmpudGx4YWxiZHVmZ2J1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU3MDU5NSwiZXhwIjoyMDk2MTQ2NTk1fQ.rcdErLkXRN77VMu1aW8yqieduV-t9r-huYpp5AFZRUA';

// QFP encode l'heure locale Paris comme UTC — on corrige au moment de l'import
function corrigerDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    // Si l'heure est 00:00 UTC → pas d'heure définie, on garde tel quel
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
      return d.toISOString();
    }

    // QFP envoie l'heure locale Paris encodée comme UTC
    // Heure d'été (mars-octobre) : offset = +2h → on soustrait 2h
    // Heure d'hiver (novembre-février) : offset = +1h → on soustrait 1h
    const mois = d.getUTCMonth(); // 0=jan, 11=dec
    const estEte = mois >= 2 && mois <= 9;
    const offsetMinutes = estEte ? 120 : 60;

    const corrige = new Date(d.getTime() - offsetMinutes * 60 * 1000);
    return corrige.toISOString();
  } catch { return null; }
}

function mappingCategorie(tags, titre, description, lieu) {
  const tout = [
    ...(Array.isArray(tags) ? tags : [String(tags || '')]),
    titre || '', description || '', lieu || '',
  ].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (tout.match(/\b(esport|gaming|jeux.video|nintendo|playstation|xbox|twitch)\b/)) return 'Gaming';
  if (tout.match(/\b(cinema|ugc|mk2|pathe|gaumont|louxor|film|projection|seance|cine)\b/)) return 'Cinéma';
  if (tout.match(/\b(theatre|comedie.francaise|odeon|piece.de.theatre|mise.en.scene|danse|ballet|opera|cirque|humour|stand.up|comedie)\b/)) return 'Théâtre';
  if (tout.match(/\b(concert|festival|jazz|blues|rock|metal|pop|electro|rap|rnb|hip.hop|classique|orchestre|symphonie|chanson|musique|live)\b/)) return 'Musique';
  if (tout.match(/\b(sport|fitness|yoga|pilates|running|marathon|match|tournoi|natation|tennis|foot|rugby|basket|gym|zumba)\b/)) return 'Sport';
  if (tout.match(/\b(nature|jardin|jardinage|meditation|sophrologie|bien.etre|balade|foret|ecologie)\b/)) return 'Nature & Bien-être';
  if (tout.match(/\b(enfant|famille|kids|jeunesse|bebe|conte|animation.enfant|scolaire)\b/)) return 'Famille';
  if (tout.match(/\b(marche|brocante|vide.grenier|salon|foire|braderie|puces)\b/)) return 'Marché';
  if (tout.match(/\b(solidarite|benevol|entraide|humanitaire|don|collecte|association)\b/)) return 'Entraide';
  if (tout.match(/\b(conference|debat|atelier|workshop|masterclass|formation|cours|visite.guidee|lecture|livre|patrimoine)\b/)) return 'Cours';
  if (tout.match(/\b(exposition|expo|galerie|vernissage|art|peinture|sculpture|photo|musee)\b/)) return 'Art';
  return 'Art';
}

async function fetchPage(offset) {
  const url = `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records?limit=100&offset=${offset}&order_by=date_start+desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return { results: json.results || [], total: json.total_count || 0 };
}

async function supprimerAnciens() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/evenements_officiels?source=eq.que_faire_paris`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  console.log(`🗑️  Suppression anciens : HTTP ${res.status}`);
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
    else console.error(`❌ Lot ${i}:`, (await res.text()).slice(0, 200));
    await new Promise(r => setTimeout(r, 100));
  }
  return inseres;
}

async function main() {
  console.log('🚀 Import Que faire à Paris');
  console.log('============================');

  if (SUPABASE_SERVICE_KEY.includes('COLLE')) {
    console.error('❌ Remplace SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  await supprimerAnciens();

  const premiere = await fetchPage(0);
  const total = Math.min(premiere.total, 700);
  console.log(`📅 ${premiere.total} événements disponibles — import des ${total} plus récents`);

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
      console.error(`\n❌ Page ${page + 1}:`, e.message);
      break;
    }
  }

  console.log(`\n   Total récupéré : ${tousLesRecords.length}`);

  const maintenant = new Date();
  const limite = new Date(maintenant.getTime() - 2 * 3600 * 1000);

  const evenements = tousLesRecords.map(r => {
    try {
      const lat = r.lat_lon?.lat || r.geo_point_2d?.lat;
      const lon = r.lat_lon?.lon || r.geo_point_2d?.lon;
      if (!lat || !lon) return null;

      // Corrige les dates avant de filtrer
      const dateDebutCorrigee = corrigerDate(r.date_start);
      const dateFinCorrigee = corrigerDate(r.date_end);

      const dateDebut = dateDebutCorrigee ? new Date(dateDebutCorrigee) : null;
      const dateFin = dateFinCorrigee ? new Date(dateFinCorrigee) : null;

      // Filtre strict — événements passés exclus
      const dateRef = dateFin || dateDebut;
      if (dateRef && dateRef < limite) return null;

      const categorie = mappingCategorie(
        r.tags || [],
        r.title || '',
        r.lead_text || r.description || '',
        r.address_name || ''
      );

      return {
        titre: String(r.title || 'Événement').slice(0, 200),
        description: r.lead_text ? String(r.lead_text).slice(0, 500) : null,
        categorie,
        lieu: r.address_name ? String(r.address_name).slice(0, 200) : null,
        adresse: [r.address_street, r.address_zipcode, r.address_city]
          .filter(Boolean).join(', ').slice(0, 300),
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
  }).filter(Boolean);

  console.log(`   Valides après correction timezone : ${evenements.length}`);

  if (evenements.length === 0) {
    console.log('⚠️  Aucun événement valide');
    return;
  }

  const inseres = await insererLots(evenements);
  console.log(`\n✅ ${inseres} événements insérés`);

  // Stats par catégorie
  const stats = {};
  evenements.forEach(e => { stats[e.categorie] = (stats[e.categorie] || 0) + 1; });
  console.log('\n📊 Par catégorie :');
  Object.entries(stats).sort((a, b) => b[1] - a[1])
    .forEach(([cat, nb]) => console.log(`   ${cat.padEnd(22)} ${nb}`));

  // Vérification timezone sur quelques exemples
  console.log('\n🕐 Vérification heures (5 exemples) :');
  evenements.filter(e => e.date_debut).slice(0, 5).forEach(e => {
    const d = new Date(e.date_debut);
    const heureParis = d.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
    });
    console.log(`   ${e.titre.slice(0, 40).padEnd(42)} ${heureParis}`);
  });
}

main().catch(console.error);