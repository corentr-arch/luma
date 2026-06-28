async function main() {
  const res = await fetch(
    'https://jsvnuvjntlxalbdufgbu.supabase.co/functions/v1/seances-cinema',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmludGx4YWxiZHVmZ2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTI5MjcsImV4cCI6MjA2MTU4ODkyN30.sWpHBDvBq5DI_LNjRFaMkFBRjQwM6oU_KvXrSEa8JeY',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzdm51dmludGx4YWxiZHVmZ2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTI5MjcsImV4cCI6MjA2MTU4ODkyN30.sWpHBDvBq5DI_LNjRFaMkFBRjQwM6oU_KvXrSEa8JeY',
      },
      body: JSON.stringify({ codeAllocine: 'P0015' }),
    }
  );
  console.log('HTTP status:', res.status);
  const text = await res.text();
  console.log('Réponse:', text.slice(0, 500));
}

main().catch(console.error);