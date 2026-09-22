async function run() {
  try {
    const r = await fetch('https://www.cnbcindonesia.com/market', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await r.text();
    const regex = /https?:\/\/[a-zA-Z0-9\.\-\_\/]+\b/g;
    const allUrls = text.match(regex) || [];
    const interesting = allUrls.filter(u => u.includes('api') || u.includes('market') || u.includes('data') || u.includes('quote') || u.includes('foreign'));
    console.log('Interesting CNBC URLs:', Array.from(new Set(interesting)).slice(0, 20));
  } catch (e) {
    console.error(e);
  }
}
run();
