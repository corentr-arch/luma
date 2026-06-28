// scripts/test-allocine.js
const allocine = require('allocine-api');

allocine.api('showtimes', { theaters: 'P0013', count: 3 }, (error, result) => {
  if (error) {
    console.error('Erreur:', error);
    return;
  }
  console.log(JSON.stringify(result).slice(0, 1000));
});