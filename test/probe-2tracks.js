const dz = async (t) => { const r = await fetch("https://api.deezer.com/search?q=" + encodeURIComponent(t) + "&limit=5"); const j = await r.json(); return (j.data||[]).map(x=>x.artist.name+" — "+x.title+" ["+x.duration+"s]"); };
const it = async (t) => { const r = await fetch("https://itunes.apple.com/search?term=" + encodeURIComponent(t) + "&media=music&entity=song&limit=5"); const j = await r.json(); return (j.results||[]).map(x=>x.artistName+" — "+x.trackName+" ["+Math.round(x.trackTimeMillis/1000)+"s]"); };
const mb = async (q) => { const r = await fetch("https://musicbrainz.org/ws/2/recording/?query=" + encodeURIComponent(q) + "&fmt=json&limit=5", {headers:{'User-Agent':'Ashuffle/11.9 ( https://example.com/ashuffle )'}}); const j = await r.json(); return (j.recordings||[]).map(x=>(x['artist-credit']?x['artist-credit'][0].name:'?')+" — "+x.title+" ["+Math.round((x.length||0)/1000)+"s]"); };
(async () => {
  console.log("DZ Ляпис:", JSON.stringify(await dz("Ляпис Трубецкой Евпатория")));
  console.log("IT Ляпис:", JSON.stringify(await it("Ляпис Трубецкой Евпатория")));
  await new Promise(r=>setTimeout(r,1200));
  console.log("MB Ляпис:", JSON.stringify(await mb('artist:"Ляпис Трубецкой" AND recording:"Евпатория"')));
  await new Promise(r=>setTimeout(r,700));
  console.log("DZ Цой:", JSON.stringify(await dz("Виктор Цой Группа крови")));
  console.log("IT Цой:", JSON.stringify(await it("Виктор Цой Группа крови")));
  await new Promise(r=>setTimeout(r,1200));
  console.log("MB Цой:", JSON.stringify(await mb('artist:"Виктор Цой" AND recording:"Группа крови"')));
})();
