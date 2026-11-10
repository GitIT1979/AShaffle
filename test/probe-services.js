(async () => {
  const q = "Моя Мишель Ветер меняет направление";
  try {
    const r = await fetch("https://api.deezer.com/search?q=" + encodeURIComponent(q) + "&limit=3");
    console.log("deezer status", r.status, "cors:", r.headers.get("access-control-allow-origin"));
    const j = await r.json();
    console.log("deezer:", (j.data || []).map(x => x.artist.name + " — " + x.title + " [" + x.duration + "s]"));
  } catch (e) { console.log("deezer ERR", e.message); }
  try {
    const r2 = await fetch("https://api.discogs.com/database/search?q=" + encodeURIComponent(q));
    console.log("discogs status", r2.status, "cors:", r2.headers.get("access-control-allow-origin"));
    console.log((await r2.text()).slice(0, 120));
  } catch (e) { console.log("discogs ERR", e.message); }
  try {
    const r3 = await fetch("https://ws.audioscrobbler.com/2.0/?method=track.search&track=" + encodeURIComponent(q) + "&format=json");
    console.log("lastfm status", r3.status);
    console.log((await r3.text()).slice(0, 160));
  } catch (e) { console.log("lastfm ERR", e.message); }
})();
