const UA = "Ashuffle/9.7 ( https://example.com/ashuffle )";
const mb = async (q) => {
  const r = await fetch("https://musicbrainz.org/ws/2/recording/?query=" + encodeURIComponent(q) + "&fmt=json&limit=3", { headers: { "User-Agent": UA } });
  const j = await r.json();
  return (j.recordings || []).map(x => (x["artist-credit"] ? x["artist-credit"][0].name : "?") + " — " + x.title + " [" + Math.round((x.length || 0) / 1000) + "s]");
};
const it = async (term) => {
  const r = await fetch("https://itunes.apple.com/search?term=" + encodeURIComponent(term) + "&media=music&entity=song&limit=3");
  const j = await r.json();
  return (j.results || []).map(x => x.artistName + " — " + x.trackName + " [" + Math.round((x.trackTimeMillis || 0) / 1000) + "s]");
};
(async () => {
  console.log("iTunes no-live:", JSON.stringify(await it("Моя Мишель Ветер меняет направление")));
  await new Promise(r=>setTimeout(r,3300));
  console.log("iTunes short:", JSON.stringify(await it("Моя Мишель Ветер меняет")));
  await new Promise(r=>setTimeout(r,1200));
  console.log("MB latin:", JSON.stringify(await mb('recording:"Moya Mishel Ветер меняет направление"')));
  await new Promise(r=>setTimeout(r,1200));
  console.log("MB artist latin:", JSON.stringify(await mb('artist:"Moya Mishel"')));
})();
