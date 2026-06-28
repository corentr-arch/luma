async function main() {
  const cinemas = [
    { nom: 'MK2 Bibliothèque',   url: 'https://www.allocine.fr/seances/salle_gen_csalle=P0013.html' },
    { nom: 'Pathé Wepler',        url: 'https://www.allocine.fr/cinema/seances/cinema-109340/' },
    { nom: 'UGC Bercy',           url: 'https://www.allocine.fr/seances/salle_gen_csalle=C0118.html' },
  ];

  // En fait testons directement les pages de recherche Allociné
  const recherches = [
    'mk2+bibliotheque+paris',
    'pathe+wepler+paris',
    'ugc+bercy+paris',
    'ugc+odeon+paris',
    'gaumont+aquaboulevard+paris',
    'mk2+gambetta+paris',
    'grand+rex+paris',
    'louxor+paris',
  ];

  for (const q of recherches) {
    const url = `https://www.allocine.fr/recherche/?q=${q}`;
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        }
      });
      const html = await r.text();
      // Cherche les codes cinéma dans le HTML
      const codes = [...html.matchAll(/theater-([A-Z][0-9]+)/g)].map(m => m[1]);
      const unique = [...new Set(codes)];
      console.log(`${q}: ${unique.length > 0 ? unique.slice(0,3).join(', ') : 'rien'}`);
    } catch (e) {
      console.log(`${q}: erreur`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(console.error);