const UA = "Ashuffle/9.9 ( https://example.com/ashuffle )";
const mb = async (q) => {
  const r = await fetch("https://musicbrainz.org/ws/2/recording/?query=" + encodeURIComponent(q) + "&fmt=json&limit=3", { headers: { "User-Agent": UA } });
  const j = await r.json();
  return (j.recordings || []).map(x => (x["artist-credit"] ? x["artist-credit"][0].name : "?") + " — " + x.title);
};
const it = async (term) => {
  const r = await fetch("https://itunes.apple.com/search?term=" + encodeURIComponent(term) + "&media=music&entity=song&limit=3");
  const j = await r.json();
  return (j.results || []).map(x => x.artistName + " — " + x.trackName);
};
const dz = async (term) => {
  const r = await fetch("https://api.deezer.com/search?q=" + encodeURIComponent(term) + "&limit=3");
  const j = await r.json();
  return (j.data || []).map(x => x.artist.name + " — " + x.title);
};
(async () => {
  const truncated = "Моя Мишел Ветер меняет направление";
  console.log("deezer truncated artist:", JSON.stringify(await dz(truncated)));
  console.log("itunes truncated artist:", JSON.stringify(await it(truncated)));
  await new Promise(r=>setTimeout(r,1200));
  console.log("MB precise truncated:", JSON.stringify(await mb('artist:"Моя Мишел" AND recording:"Ветер меняет направление"')));
  await new Promise(r=>setTimeout(r,1200));
  console.log("MB title only:", JSON.stringify(await mb('recording:"Ветер меняет направление"')));
  await new Promise(r=>setTimeout(r,1200));
  console.log("MB artist wildcard:", JSON.stringify(await mb('artist:"Моя Мишел*" AND recording:"Ветер меняет направление"')));
})();
