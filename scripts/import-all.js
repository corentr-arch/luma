// scripts/import-all.js
// Lance tous les imports dans l'ordre
// Usage : node scripts/import-all.js

const { execSync } = require('child_process');

const scripts = [
  'scripts/import-opendata.js',
  'scripts/import-quefaire.js',
  'scripts/import-openagenda.js',
  'scripts/import-ticketmaster.js',
];

console.log('🚀 Import complet Luma');
console.log('======================\n');

for (const script of scripts) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`▶️  ${script}`);
  console.log('='.repeat(50));
  try {
    execSync(`node ${script}`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`❌ Erreur dans ${script}`);
  }
  console.log('');
}

console.log('\n✅ Import complet terminé !');