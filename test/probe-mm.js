const UA = "Ashuffle/9.7 ( https://example.com/ashuffle )";
const mb = async (q) => {
  const url = "https://musicbrainz.org/ws/2/recording/?query=" + encodeURIComponent(q) + "&fmt=json&limit=3";
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  const j = await r.json();
  return (j.recordings || []).map(x => (x["artist-credit"] ? x["artist-credit"][0].name : "?") + " — " + x.title + " [" + Math.round((x.length || 0) / 1000) + "s]");
};
const it = async (term) => {
  const r = await fetch("https://itunes.apple.com/search?term=" + encodeURIComponent(term) + "&media=music&entity=song&limit=3");
  const j = await r.json();
  return (j.results || []).map(x => x.artistName + " — " + x.trackName + " [" + Math.round((x.trackTimeMillis || 0) / 1000) + "s]");
};
(async () => {
  const queries = [
    'artist:"Моя Мишель" AND recording:"Ветер меняет направл"',
    'recording:"Моя Мишель Ветер меняет направл"',
    'recording:"Моя Мишель Ветер меняет направление"',
    'recording:"Ветер меняет направление" AND artist:"Моя Мишель"'
  ];
  for (const q of queries) {
    console.log("Q:", q);
    console.log("  MB:", JSON.stringify(await mb(q)));
    await new Promise(r => setTimeout(r, 1200));
  }
  console.log("iTunes:", JSON.stringify(await it("Моя Мишель Ветер меняет направление")));
  await new Promise(r => setTimeout(r, 1000));
  console.log("iTunes trunc:", JSON.stringify(await it("Моя Мишель Ветер меняет направл")));
})();
