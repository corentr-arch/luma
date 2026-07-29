require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FOOTBALL_TOKEN = process.env.FOOTBALL_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables manquantes dans .env.local');
  process.exit(1);
}

// Équipes françaises avec leurs stades et coordonnées
const EQUIPES_FR = {
  524:  { nom: 'Paris Saint-Germain', stade: 'Parc des Princes',   lat: 48.8414, lon: 2.2530,  lieu_nom: 'Parc des Princes' },
  516:  { nom: 'Olympique de Marseille', stade: 'Vélodrome',       lat: 43.2697, lon: 5.3959,  lieu_nom: 'Stade Vélodrome' },
  523:  { nom: 'Olympique Lyonnais',  stade: 'Groupama Stadium',   lat: 45.7654, lon: 4.9822,  lieu_nom: 'Groupama Stadium' },
  512:  { nom: 'Stade de Reims',      stade: 'Stade Auguste-Delaune', lat: 49.2476, lon: 4.0264, lieu_nom: 'Stade Auguste-Delaune' },
  511:  { nom: 'Stade Rennais',       stade: 'Roazhon Park',       lat: 48.1073, lon: -1.7122, lieu_nom: 'Roazhon Park' },
  548:  { nom: 'AS Monaco',           stade: 'Stade Louis II',     lat: 43.7272, lon: 7.4155,  lieu_nom: 'Stade Louis II' },
};

// Compétitions à suivre
const COMPETITIONS = [
  { id: 'FL1',  nom: 'Ligue 1',         emoji: '🇫🇷' },
  { id: 'CL',   nom: 'Champions League', emoji: '⭐' },
  { id: 'EL',   nom: 'Europa League',    emoji: '🌍' },
  { id: 'FAC',  nom: 'Coupe de France',  emoji: '🏆' },
];

async function fetchMatchs(competitionId) {
  const maintenant = new Date();
  const dans30jours = new Date(maintenant.getTime() + 30 * 24 * 3600 * 1000);
  const url = `https://api.football-data.org/v4/competitions/${competitionId}/matches?status=SCHEDULED&dateFrom=${maintenant.toISOString().split('T')[0]}&dateTo=${dans30jours.toISOString().split('T')[0]}`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': FOOTBALL_TOKEN },
  });
  if (!res.ok) {
    if (res.status === 429) { await new Promise(r => setTimeout(r, 60000)); return []; }
    return [];
  }
  const json = await res.json();
  return json.matches || [];
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
      body: JSON.stringify({ lat, lng: lon, rayon_metres: 500 }),
    });
    const data = await res.json();
    return data?.[0]?.id || null;
  } catch { return null; }
}

async function supprimerAnciens() {
  await fetch(`${SUPABASE_URL}/rest/v1/evenements_officiels?source=eq.football`, {
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
    else console.error(`❌ Lot:`, (await res.text()).slice(0, 200));
    await new Promise(r => setTimeout(r, 200));
  }
  return inseres;
}

async function main() {
  console.log('⚽ Import Football Paris');
  console.log('========================');

  if (FOOTBALL_TOKEN.includes('COLLE')) { console.error('❌ Remplace FOOTBALL_TOKEN'); process.exit(1); }

  await supprimerAnciens();
  console.log('🗑️  Anciens supprimés');

  const tousLesMatchs = [];

  for (const comp of COMPETITIONS) {
    try {
      const matchs = await fetchMatchs(comp.id);
      console.log(`   ${comp.emoji} ${comp.nom} : ${matchs.length} matchs`);

      for (const match of matchs) {
        try {
          const domicile = match.homeTeam;
          const exterieur = match.awayTeam;
          const equipeInfo = EQUIPES_FR[domicile.id];

          // On n'ajoute que les matchs à domicile d'équipes françaises
          if (!equipeInfo) continue;

          const dateMatch = new Date(match.utcDate);
          if (dateMatch < new Date()) continue;

          const lieuId = await trouverLieuProche(equipeInfo.lat, equipeInfo.lon);

          const score = match.score?.fullTime;
          const description = `${comp.nom} — ${domicile.name} reçoit ${exterieur.name} au ${equipeInfo.stade}.`;

          tousLesMatchs.push({
            titre: `${domicile.shortName || domicile.name} vs ${exterieur.shortName || exterieur.name}`,
            description,
            categorie: 'Sport',
            lieu: equipeInfo.stade,
            adresse: equipeInfo.stade,
            latitude: equipeInfo.lat,
            longitude: equipeInfo.lon,
            date_debut: dateMatch.toISOString(),
            date_fin: new Date(dateMatch.getTime() + 2 * 3600 * 1000).toISOString(),
            url: `https://www.football-data.org/matches/${match.id}`,
            image_url: domicile.crest || null,
            organisateur: equipeInfo.nom,
            source: 'football',
            source_id: String(match.id),
            gratuit: false,
            prix_min: null,
            ville: 'Paris',
            salle: equipeInfo.stade,
            lieu_id: lieuId,
            actif: true,
          });
        } catch { continue; }
      }

      await new Promise(r => setTimeout(r, 6000)); // Rate limit 10 req/min
    } catch (e) {
      console.error(`❌ ${comp.nom}:`, e.message);
    }
  }

  console.log(`\n📊 ${tousLesMatchs.length} matchs valides`);
  if (tousLesMatchs.length === 0) { console.log('⚠️  Aucun match'); return; }

  const inseres = await insererLots(tousLesMatchs);
  console.log(`✅ ${inseres} matchs insérés`);
}

main().catch(console.error);