const CODES = {
  'MK2 Bibliothèque':         'W7513',
  'MK2 Bastille':             'W7511',
  'MK2 Gambetta':             'W7520',
  'MK2 Parnasse':             'W7514',
  'MK2 Hautefeuille':         'W7506',
  'MK2 Quai de Seine':        'W7519',
  'Mk2 Grand Palais':         'W7508',
  'Pathé Wepler':             'P0057',
  'Pathé Alésia':             'P0086',
  'Pathé Beaugrenelle':       'P0091',
  'Pathé Opéra Premier':      'P0053',
  'Gaumont Aquaboulevard':    'P0090',
  'Gaumont Opéra Premier':    'P0069',
  'UGC Ciné Cité Bercy':      'P0072',
  'UGC Odéon':                'P0063',
  'UGC Montparnasse':         'P0068',
  'UGC Danton':               'P0070',
  'UGC Maillot':              'P0071',
  'UGC Gobelins':             'P0076',
  'Le Grand Rex':             'P0036',
  'Le Louxor':                'P0096',
  'Cinéma Le Champo':         'P0046',
  'Luminor Hôtel de Ville':   'P0047',
  'Forum des Images':         'P0029',
  'Le Brady':                 'P0037',
};

const today = new Date().toISOString().split('T')[0];

async function test(nom, code) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 4000);
    const r = await fetch(`https://www.allocine.fr/_/showtimes/theater-${code}/d-${today}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
        'Referer': 'https://www.allocine.fr',
      },
      signal: controller.signal,
    });
    const d = await r.json();
    return d.results?.length || 0;
  } catch { return -1; }
}

async function main() {
  console.log('🎬 Test des codes Allociné\n');
  for (const [nom, code] of Object.entries(CODES)) {
    const nb = await test(nom, code);
    const ok = nb > 0;
    console.log(`${ok ? '✅' : '❌'} ${nom.padEnd(32)} ${code} — ${ok ? nb + ' films' : nb === -1 ? 'timeout/erreur' : '0 films (mauvais code)'}`);
    await new Promise(r => setTimeout(r, 400));
  }
  console.log('\nTerminé !');
}

main().catch(console.error);