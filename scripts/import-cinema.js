require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables manquantes dans .env.local');
  process.exit(1);
}

const CODES_ALLOCINE = {
  'MK2 Bibliothèque':         'C2954',
  'MK2 Bastille':             'C0140',
  'MK2 Beaubourg':            'C0050',
  'MK2 Gambetta':             'C0192',
  'MK2 Nation':               'C0144',
  'MK2 Parnasse':             'C0099',
  'MK2 Odéon':                'C0092',
  'MK2 Quai de Seine':        'C0003',
  'MK2 Quai de Loire':        'C1621',
  'Mk2 Grand Palais':         'W7508',
  'Pathé La Villette':        'W7520',
  'Pathé Boulogne':           'B0247',
  'Pathé Convention':         'C0161',
  'Pathé Wepler':             'C0179',
  'Pathé Alésia':             'C0037',
  'Pathé Beaugrenelle':       'W7502',
  'Pathé Opéra Premier':      'C0060',
  'Pathé Île Seguin':         'W7503',
  'Gaumont Parnasse':         'C0158',
  'Gaumont Aquaboulevard':    'C0116',
  'UGC Ciné Cité Les Halles': 'C0159',
  'UGC Ciné Cité Bercy':      'C0026',
  'UGC Odéon':                'C0104',
  'UGC Montparnasse':         'C0103',
  'UGC Danton':               'C0102',
  'UGC Maillot':              'C0175',
  'UGC Gobelins':             'C0150',
  'UGC Rotonde':              'C0105',
  'Studio 28':                'C0061',
  'Le Balzac':                'C0009',
  'Cinémathèque Française':   'C1559',
  'Le Grand Rex':             'C0065',
  'Le Louxor':                'W7510',
  'Cinéma Le Champo':         'C0073',
  'Luminor Hôtel de Ville':   'C0013',
  'Forum des Images':         'C0119',
  'Le Brady':                 'C0023',
  'Cinéma Landowski':         'B0227',
};

function getParisDSTOffset(date) {
  const year = date.getUTCFullYear();
  const marchFin = new Date(Date.UTC(year, 2, 31));
  marchFin.setUTCDate(31 - marchFin.getUTCDay());
  const octobreFin = new Date(Date.UTC(year, 9, 31));
  octobreFin.setUTCDate(31 - octobreFin.getUTCDay());
  if (date >= marchFin && date < octobreFin) return 120;
  return 60;
}

function parseVersion(s, typeKey) {
  const tags = s.tags || [];
  const projection = s.projection || [];
  if (tags.includes('IMAX') || projection.includes('IMAX')) return 'IMAX';
  if (tags.includes('4DX')) return '4DX';
  if (tags.includes('DOLBY_ATMOS')) return 'Dolby Atmos';
  if (s.languages?.includes('FRENCH')) {
    if (tags.includes('SUBTITLED') || typeKey.includes('st')) return 'VF sous-titrée';
    return 'VF';
  }
  if (s.languages?.length > 0) {
    if (tags.includes('SUBTITLED') || typeKey.includes('st')) return 'VOST';
    return 'VO';
  }
  if (typeKey.startsWith('dubbed')) return 'VF';
  if (typeKey.startsWith('original')) return 'VOST';
  return 'VF';
}

function parseDureeMinutes(runtime) {
  if (!runtime) return null;
  const matchH = runtime.match(/(\d+)h/);
  const matchM = runtime.match(/(\d+)min/);
  const h = matchH ? parseInt(matchH[1]) : 0;
  const m = matchM ? parseInt(matchM[1]) : 0;
  const total = h * 60 + m;
  return total > 0 ? total : null;
}

async function fetchSeances(code, date) {
  const url = `https://www.allocine.fr/_/showtimes/theater-${code}/d-${date}/`;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
        'Referer': 'https://www.allocine.fr',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });
    if (!r.ok) return [];
    const json = await r.json();
    return json.results || [];
  } catch { return []; }
}

async function scraperCinema(nomCinema, code) {
  const seances = [];
  const maintenant = new Date();

  for (let j = 0; j < 7; j++) {
    const date = new Date();
    date.setDate(date.getDate() + j);
    const dateStr = date.toISOString().split('T')[0];
    const resultats = await fetchSeances(code, dateStr);

    for (const item of resultats) {
      const film = item.movie;
      if (!film) continue;

      const titre = film.title || film.originalTitle || 'Film inconnu';
      const affiche = film.poster?.url || null;
      const synopsis = film.synopsis ? String(film.synopsis).slice(0, 500) : null;
      const dureeMinutes = parseDureeMinutes(film.runtime);
      const genre = film.genres?.map(g => g.translate || g.tag).join(', ') || null;
      const note = film.stats?.userRating?.score || null;
      const annee = film.data?.productionYear || null;
      const realisateur = film.credits?.find(c => c.position?.name === 'DIRECTOR')?.person?.name || null;

      const showtimesObj = item.showtimes || {};
      const tousTypes = ['dubbed', 'original', 'local', 'multiple', 'original_st', 'multiple_st', 'dubbed_st', 'local_st'];

      for (const typeKey of tousTypes) {
        for (const s of showtimesObj[typeKey] || []) {
          if (!s.startsAt) continue;
          const raw = s.startsAt;
          let dateSeance;
          if (raw.endsWith('Z') || /T.*[-+]\d{2}:\d{2}$/.test(raw)) {
            dateSeance = new Date(raw);
          } else {
            const tempDate = new Date(raw + 'Z');
            const offset = getParisDSTOffset(tempDate);
            dateSeance = new Date(tempDate.getTime() - offset * 60 * 1000);
          }
          if (dateSeance < maintenant) continue;

          seances.push({
            cinema_nom: nomCinema,
            cinema_code: code,
            film_titre: titre.slice(0, 200),
            film_affiche: affiche,
            film_synopsis: synopsis,
            film_duree: dureeMinutes,
            film_genre: genre,
            film_realisateur: realisateur,
            film_note: note,
            film_annee: annee,
            date_seance: dateSeance.toISOString(),
            version: parseVersion(s, typeKey),
            salle: s.screen?.name || null,
            url_reservation: `https://www.allocine.fr/seance/salle_gen_csalle=${code}.html`,
            source: 'allocine',
            actif: true,
          });
        }
      }
    }
    await new Promise(r => setTimeout(r, 150));
  }
  return seances;
}

async function supprimerAnciennesSeances() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/seances_cinema?id=gt.0`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  console.log(`🗑️  Reset complet : HTTP ${res.status}`);
}

async function insererLots(seances) {
  const TAILLE_LOT = 100;
  let inseres = 0;
  for (let i = 0; i < seances.length; i += TAILLE_LOT) {
    const lot = seances.slice(i, i + TAILLE_LOT);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/seances_cinema`, {
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
    else console.error(`❌ Lot ${i}:`, (await res.text()).slice(0, 250));
    await new Promise(r => setTimeout(r, 80));
  }
  return inseres;
}

async function main() {
  console.log('🎬 Import programmation cinémas — hebdomadaire');
  console.log('================================================');
  await supprimerAnciennesSeances();

  let toutesLesSeances = [];
  const entries = Object.entries(CODES_ALLOCINE);

  for (let i = 0; i < entries.length; i++) {
    const [nom, code] = entries[i];
    process.stdout.write(`[${i + 1}/${entries.length}] ${nom.padEnd(30)}`);
    const seances = await scraperCinema(nom, code);
    toutesLesSeances.push(...seances);
    console.log(` → ${seances.length} séances`);
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n📊 Total : ${toutesLesSeances.length} séances`);
  if (toutesLesSeances.length === 0) { console.log('⚠️  Aucune séance'); return; }

  const inseres = await insererLots(toutesLesSeances);
  console.log(`✅ ${inseres} séances insérées`);

  const parCinema = {};
  toutesLesSeances.forEach(s => { parCinema[s.cinema_nom] = (parCinema[s.cinema_nom] || 0) + 1; });
  console.log('\n📊 Par cinéma :');
  Object.entries(parCinema).sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`   ${c.padEnd(30)} ${n}`));
}

main().catch(console.error);