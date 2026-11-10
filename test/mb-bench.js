"use strict";
/* Базовый замер: текстовый поиск MusicBrainz по именам файлов.
   Это не распознавание по звуку, а тот путь, который используется в AShaffle. */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "tracks");
const FILES = [
  "002 - Dabro - На часах ноль-ноль.mp3",
  "003 - BEARWOLF - Один в поле воин.mp3",
  "004 - AY YOLA - Homay.mp3",
  "005 - slumdog_millionaire_04 - Paper Planes (Performed by M.I.A.).mp3",
  "006 - ВитяДуша - Груз былого.mp3",
  "007 - Бонд с кнопкой - Кухни.mp3",
  "008 - Mr. Credo - Медляк.mp3",
  "009 - Дельфин - Любовь.mp3",
  "010 - BEARWOLF - Феникс.mp3",
];

function parse(name) {
  let s = name.replace(/\.[^.]+$/, "").replace(/^\s*\d{1,3}\s*[-.)]\s*/, "");
  const m = s.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: "", title: s.trim() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const rows = [];
  for (const [i, file] of FILES.entries()) {
    if (!fs.existsSync(path.join(DIR, file))) { rows.push({ file, error: "нет файла" }); continue; }
    const { artist, title } = parse(file);
    const term = (artist ? artist + " " : "") + title;
    const url = "https://musicbrainz.org/ws/2/recording/?query=" +
      encodeURIComponent(term.replace(/["()]/g, " ")) + "&fmt=json&limit=3";
    const t0 = Date.now();
    let status = 0, found = null, err = null;
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Ashuffle/8.8 ( https://example.com/ashuffle )" } });
      status = r.status;
      const j = await r.json();
      const rec = (j.recordings || []).find((x) => x["artist-credit"] && x["artist-credit"].length);
      if (rec) found = rec["artist-credit"][0].name + " — " + rec.title;
    } catch (e) { err = e.message; }
    rows.push({ file, term, ms: Date.now() - t0, status, found, err });
    if (i < FILES.length - 1) await sleep(1100);
  }
  console.log(JSON.stringify(rows, null, 2));
  const ok = rows.filter((r) => r.found);
  console.log("\nсовпадений: " + ok.length + " из " + rows.length);
  const times = rows.map((r) => r.ms).filter(Boolean).sort((a, b) => a - b);
  console.log("время ответа, мс: min " + times[0] + ", median " + times[Math.floor(times.length / 2)] + ", max " + times[times.length - 1]);
})();
