const CODES_TROUVES = [
  'P0036','P0037','P0038','P0039','P0042','P0045','P0046','P0047',
  'P0050','P0053','P0054','P0056','P0057','P0058','P0062','P0063',
  'P0064','P0068','P0069','P0070','P0071','P0072','P0073','P0076',
  'P0079','P0086','P0087','P0088','P0090','P0091','P0093','P0096',
  'P0098','P0099','P0101','P0103','P0108','P0111','P0116','P0120',
  'P0121','P0126','P0127','P0128','P0134','P0137','P0142','P0144',
  'P0146','P0149','P0151','P0153','P0155','P0156','P0160','P0161',
];

const today = new Date().toISOString().split('T')[0];

async function fetchAvecTimeout(url, ms = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
        'Referer': 'https://www.allocine.fr',
      }
    });
    clearTimeout(timer);
    return await r.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function main() {
  console.log('🔍 Identification cinémas parisiens\n');

  for (const code of CODES_TROUVES) {
    process.stdout.write(`Test ${code}... `);
    const url = `https://www.allocine.fr/_/showtimes/theater-${code}/d-${today}/`;
    const d = await fetchAvecTimeout(url, 3000);
    
    if (!d || !d.results?.length) {
      console.log('vide');
      continue;
    }

    const raw = JSON.stringify(d);
    const cityMatch = raw.match(/"city":"([^"]+)"/);
    const city = cityMatch ? cityMatch[1] : '?';
    const latMatch = raw.match(/"latitude":([\d.]+)/);
    const lonMatch = raw.match(/"longitude":([\d.]+)/);
    const lat = latMatch ? parseFloat(latMatch[1]) : null;
    const lon = lonMatch ? parseFloat(lonMatch[1]) : null;

    const isParis = city.includes('Paris') || city.includes('Boulogne') ||
                    city.includes('Neuilly') || city.includes('Vincennes') ||
                    city.includes('Nanterre') || city.includes('Montrouge') ||
                    (lat && lat >= 48.75 && lat <= 49.0 && lon && lon >= 2.2 && lon <= 2.55);

    if (isParis) {
      console.log(`✅ PARIS | ville: ${city} | ${d.results.length} films | ex: ${d.results[0]?.movie?.title || '?'}`);
    } else {
      console.log(`ville: ${city}`);
    }

    await new Promise(r => setTimeout(r, 300));
  }
  console.log('\nTerminé !');
}

main().catch(console.error);