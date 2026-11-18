const dz = async (t) => { const r = await fetch("https://api.deezer.com/search?q=" + encodeURIComponent(t) + "&limit=5"); const j = await r.json(); return (j.data||[]).map(x=>x.artist.name+" — "+x.title+" ["+x.duration+"s]"); };
(async () => {
  const qs = ["ally brooke lips dont lie","Ally Brooke Lips Don't Lie A Boogie","star wars imperial march","imperial march star wars"];
  for (const q of qs) { try { console.log(JSON.stringify(q), "=>", JSON.stringify(await dz(q))); } catch(e){ console.log(q,"ERR",e.message); } }
})();
