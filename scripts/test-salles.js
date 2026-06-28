const SALLES = [
  { nom: 'Bataclan',           url: 'https://www.bataclan.fr/programmation/' },
  { nom: 'La Cigale',          url: 'https://www.lacigale.fr/programmation/' },
  { nom: 'Olympia',            url: 'https://www.olympiahall.com/agenda/' },
  { nom: 'Zénith',             url: 'https://www.zenith-paris.com/agenda/' },
  { nom: 'Élysée Montmartre',  url: 'https://www.elyseemontmartre.com/programmation/' },
  { nom: 'Trabendo',           url: 'https://www.trabendo.fr/programmation/' },
  { nom: 'Maison de la Radio', url: 'https://www.maisondelaradio.fr/agenda' },
  { nom: 'Opéra Bastille',     url: 'https://www.operadeparis.fr/saison/agenda' },
  { nom: 'Théâtre de la Ville',url: 'https://www.theatredelaville-paris.com/fr/saison' },
  { nom: 'Nouveau Casino',     url: 'https://www.nouveaucasino.net/programmation/' },
  { nom: 'Maroquinerie',       url: 'https://www.lamaroquinerie.fr/programmation/' },
  { nom: 'Le Trianon',         url: 'https://www.letrianon.fr/programmation/' },
  { nom: 'Glazart',            url: 'https://www.glazart.com/agenda/' },
  { nom: 'Petit Bain',         url: 'https://www.petitbain.org/programme/' },
];

async function main() {
  for (const salle of SALLES) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const r = await fetch(salle.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
        signal: controller.signal,
      });
      const html = await r.text();
      // Cherche des noms d'artistes ou titres dans le HTML
      const hasContent = html.length > 5000;
      const hasJson = html.includes('application/ld+json') || html.includes('"@type"');
      const hasEvent = html.toLowerCase().includes('concert') || html.toLowerCase().includes('spectacle') || html.toLowerCase().includes('event');
      console.log(`${r.ok && hasContent ? '✅' : '❌'} ${salle.nom.padEnd(22)} HTTP:${r.status} taille:${Math.round(html.length/1000)}kb json:${hasJson} event:${hasEvent}`);
    } catch (e) {
      console.log(`❌ ${salle.nom.padEnd(22)} ${e.message?.slice(0,30)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
}
main().catch(console.error);