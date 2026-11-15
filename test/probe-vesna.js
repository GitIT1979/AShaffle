const dz = async (t) => { const r = await fetch("https://api.deezer.com/search?q=" + encodeURIComponent(t) + "&limit=6"); const j = await r.json(); return (j.data||[]).map(x=>x.artist.name+" — "+x.title+" ["+x.duration+"s] rank "+x.rank); };
const it = async (t) => { const r = await fetch("https://itunes.apple.com/search?term=" + encodeURIComponent(t) + "&media=music&entity=song&limit=6"); const j = await r.json(); return (j.results||[]).map(x=>x.artistName+" — "+x.trackName+" ["+Math.round(x.trackTimeMillis/1000)+"s]"); };
(async () => {
  console.log("DZ холодная весна:", JSON.stringify(await dz("холодная весна"), null, 0));
  console.log("DZ джанго:", JSON.stringify(await dz("Джанго холодная весна"), null, 0));
  console.log("IT:", JSON.stringify(await it("холодная весна"), null, 0));
})();
