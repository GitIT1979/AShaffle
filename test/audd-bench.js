"use strict";
/* Замер распознавания по звуку через AudD (демо-режим без токена / с токеном).
   Запуск: node test/audd-bench.js [--json] */
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
const TOKEN = process.env.AUDD_TOKEN || "";
const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

(async () => {
  const rows = [];
  for (const [i, file] of FILES.entries()) {
    const full = path.join(DIR, file);
    if (!fs.existsSync(full)) { rows.push({ file, error: "нет файла" }); continue; }
    const size = fs.statSync(full).size;
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(full)], { type: "audio/mpeg" }), file);
    if (TOKEN) form.append("api_token", TOKEN);

    const t0 = Date.now();
    let out = null, err = null, status = 0;
    try {
      const r = await fetch("https://api.audd.io/", { method: "POST", body: form });
      status = r.status;
      out = await r.json();
    } catch (e) { err = e.message; }
    const ms = Date.now() - t0;
    const res = out && out.result;
    rows.push({
      file,
      mb: +(size / 1048576).toFixed(1),
      ms,
      status,
      artist: res && res.artist,
      title: res && res.title,
      album: res && res.album,
      timecode: res && res.timecode,
      found: !!res,
      err,
    });
    if (i < FILES.length - 1) await new Promise((r) => setTimeout(r, 400));
  }

  if (process.argv.includes("--json")) { console.log(JSON.stringify(rows, null, 2)); return; }

  console.log("файл".padEnd(58) + "МБ     мс   результат");
  for (const r of rows) {
    const name = r.file.length > 56 ? r.file.slice(0, 55) + "…" : r.file;
    if (r.error) { console.log(name.padEnd(58) + "-  " + String(r.ms || "").padStart(5) + "   " + r.error); continue; }
    const shown = r.found ? r.artist + " — " + r.title : "не распознано";
    console.log(name.padEnd(58) + String(r.mb).padStart(4) + " " + String(r.ms).padStart(5) + "   " + shown);
  }
  const times = rows.filter((r) => r.found).map((r) => r.ms).sort((a, b) => a - b);
  const found = rows.filter((r) => r.found).length;
  console.log("\nраспознано: " + found + " из " + rows.length);
  if (times.length) {
    const sum = times.reduce((a, b) => a + b, 0);
    console.log("время до результата, мс: min " + times[0] + ", median " + times[Math.floor(times.length / 2)] +
                ", среднее " + Math.round(sum / times.length) + ", max " + times[times.length - 1]);
  }

  /* сверка с ожидаемым из имени файла */
  const clean = (s) => s.replace(/\.[^.]+$/, "").replace(/^\s*\d{1,3}\s*-\s*/, "");
  const hit = (row) => {
    if (!row.found) return false;
    const expected = clean(row.file);
    return norm(expected).includes(norm(row.title)) || norm(row.artist) === norm(expected.split(" - ")[0]);
  };
  console.log("совпало с именем файла: " + rows.filter(hit).length + " из " + rows.length);
})();
