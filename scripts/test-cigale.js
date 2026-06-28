async function main() {
  const r = await fetch('https://www.lacigale.fr/programmation/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    }
  });
  const html = await r.text();
  
  // Extrait les blocs JSON-LD
  const jsonMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (jsonMatches) {
    jsonMatches.forEach((block, i) => {
      const content = block.replace(/<script[^>]*>/, '').replace('</script>', '').trim();
      console.log('JSON-LD bloc', i, ':', content.slice(0, 500));
      console.log('---');
    });
  }

  // Cherche aussi des patterns d'événements dans le HTML
  const eventPatterns = html.match(/"name"\s*:\s*"([^"]{5,50})"/g);
  if (eventPatterns) {
    console.log('\nNoms trouvés:', [...new Set(eventPatterns)].slice(0, 20).join('\n'));
  }
}
main().catch(console.error);