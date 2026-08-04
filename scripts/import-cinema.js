require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables manquantes');
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
  'Pathé Île Seguin':         'G0GJC',
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

const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

const attendre = (ms) => new Promise(r => setTimeout(r, ms));
const userAgentAleatoire = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

function getParisDSTOffset(date) {
  const year = date.getUTCFullYear();
  const marchFin = new Date(Date.UTC(year, 2, 31));
  marchFin.setUTCDate(31 - marchFin.getUTCDay());
  const octobreFin = new Date(Date.UTC(year, 9, 31));
  octobreFin.setUTCDate(31 - octobreFin.getUTCDay());
  return (date >= marchFin && date < octobreFin) ? 120 : 60;
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

async function fetchAvecRetry(url, essai = 0) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': userAgentAleatoire(),
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.allocine.fr/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      },
    });

    if (r.status === 429 || r.status === 403) {
      if (essai < 4) {
        const delai = Math.pow(2, essai) * 15000; // 15s, 30s, 60s, 120s
        console.log(`   ⚠️  Rate limit (${r.status}) — attente ${delai/1000}s...`);
        await attendre(delai);
        return fetchAvecRetry(url, essai + 1);
      }
      console.log(`   ❌ Ban permanent après ${essai} essais`);
      return null;
    }

    if (r.status === 404) return null;
    if (!r.ok) {
      console.log(`   ⚠️  HTTP ${r.status}`);
      return null;
    }

    return await r.json();
  } catch (e) {
    if (essai < 2) {
      await attendre(5000);
      return fetchAvecRetry(url, essai + 1);
    }
    return null;
  }
}

async function scraperCinema(nomCinema, code) {
  const seances = [];
  const maintenant = new Date();
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);

  for (let j = 0; j < 7; j++) {
    const date = new Date(debut);
    date.setDate(date.getDate() + j);
    const dateStr = date.toISOString().split('T')[0];

    const url = `https://www.allocine.fr/_/showtimes/theater-${code}/d-${dateStr}/`;
    const json = await fetchAvecRetry(url);

    if (!json) {
      await attendre(2000);
      continue;
    }

    const resultats = json.results || [];

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

          if (j > 0 && dateSeance < maintenant) continue;

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

    // Délai plus long entre les jours sur GitHub Actions
    await attendre(1500 + Math.random() * 1000);
  }

  return seances;
}

async function supprimerAnciennesSeances() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/seances_cinema?actif=eq.true`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
    });
    console.log(`🗑️  Suppression anciennes séances : HTTP ${res.status}`);
  } catch (e) {
    console.error('❌ Erreur suppression:', e.message);
  }
}

async function insererLots(seances) {
  const TAILLE_LOT = 50; // Lots plus petits pour être sûr
  let inseres = 0;
  let erreurs = 0;

  for (let i = 0; i < seances.length; i += TAILLE_LOT) {
    const lot = seances.slice(i, i + TAILLE_LOT);
    try {
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
      if (res.ok) {
        inseres += lot.length;
      } else {
        erreurs += lot.length;
        const txt = await res.text();
        console.error(`❌ Lot ${i}: HTTP ${res.status} — ${txt.slice(0, 200)}`);
      }
    } catch (e) {
      erreurs += lot.length;
      console.error(`❌ Lot ${i}:`, e.message);
    }
    await attendre(100);
  }

  return { inseres, erreurs };
}

async function main() {
  console.log('🎬 Import programmation cinémas Paris');
  console.log('======================================');
  console.log(`📅 ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
  console.log(`🎭 ${Object.keys(CODES_ALLOCINE).length} cinémas à scraper\n`);

  await supprimerAnciennesSeances();
  console.log('');

  const toutesLesSeances = [];
  const entries = Object.entries(CODES_ALLOCINE);
  let succes = 0;
  let echecs = 0;

  for (let i = 0; i < entries.length; i++) {
    const [nom, code] = entries[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${entries.length}] ${nom.padEnd(32)}`);

    const seances = await scraperCinema(nom, code);

    if (seances.length > 0) {
      toutesLesSeances.push(...seances);
      console.log(`✅ ${seances.length} séances`);
      succes++;
    } else {
      console.log(`⚠️  0 séances (ban ou indispo)`);
      echecs++;
    }

    // Délai aléatoire entre cinémas — plus long sur serveur
    if (i < entries.length - 1) {
      const delai = 3000 + Math.random() * 3000; // 3-6 secondes
      await attendre(delai);
    }
  }

  console.log(`\n📊 Scraping : ${succes} OK, ${echecs} échecs`);
  console.log(`📊 Total séances : ${toutesLesSeances.length}`);

  if (toutesLesSeances.length === 0) {
    console.log('⚠️  Aucune séance récupérée — possible ban Allociné depuis cette IP');
    // Ne pas faire échouer le workflow si Allociné bloque
    process.exit(0);
  }

  console.log('\n📤 Insertion en base...');
  const { inseres, erreurs } = await insererLots(toutesLesSeances);
  console.log(`✅ ${inseres} séances insérées, ${erreurs} erreurs`);

  // Résumé par cinéma
  const parCinema = {};
  toutesLesSeances.forEach(s => { parCinema[s.cinema_nom] = (parCinema[s.cinema_nom] || 0) + 1; });
  console.log('\n📊 Par cinéma :');
  Object.entries(parCinema)
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`   ${c.padEnd(32)} ${n}`));

  console.log('\n✅ Import terminé !');
}

main().catch(e => {
  console.error('❌ Erreur fatale:', e);
  // Exit 0 pour ne pas faire échouer le workflow si Allociné bloque
  process.exit(0);
});