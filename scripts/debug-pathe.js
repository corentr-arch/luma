// scripts/debug-pathe.js
async function main() {
  const today = new Date().toISOString().split('T')[0];
  const r = await fetch(`https://www.allocine.fr/_/showtimes/theater-P0089/d-${today}/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'application/json',
      'Referer': 'https://www.allocine.fr',
    }
  });
  const d = await r.json();
  console.log('Nb films:', d.results?.length);
  if (d.results?.[0]) {
    console.log('Clés showtimes:', Object.keys(d.results[0].showtimes || {}));
    console.log('Nb séances film 1:', JSON.stringify(d.results[0].showtimes).slice(0, 300));
  }
}
main().catch(console.error);