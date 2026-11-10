"use strict";
/* Тестовый стенд: вынимает скрипт из AShaffle.html, исполняет его в песочнице
   с минимальным DOM и проверяет чистые функции. Запуск: node test/harness.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const TMP = path.join(__dirname, "tmp");
fs.mkdirSync(TMP, { recursive: true });

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (actual === expected) { passed++; return; }
  failed++;
  console.error("FAIL " + label + "\n  expected: " + JSON.stringify(expected) +
                "\n  actual:   " + JSON.stringify(actual));
}
function ok(cond, label) { eq(!!cond, true, label); }

/* ---------- песочница ---------- */
const html = fs.readFileSync(path.join(ROOT, "AShaffle.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error("не найден inline-скрипт");
let code = m[1];
if (!/\}\)\(\);\s*$/.test(code)) throw new Error("неожиданное окончание скрипта");
code = code.replace(/\}\)\(\);\s*$/,
  "globalThis.__api={parseTrackInfo:parseTrackInfo,makeName:makeName," +
  "stripTrackPrefix:stripTrackPrefix,safeNamePart:safeNamePart,trySplit:trySplit," +
  "buildZipBlob:buildZipBlob,makeRenamedFile:makeRenamedFile," +
  "readId3Tag:readId3Tag,buildId3v24Tag:buildId3v24Tag,ext:ext," +
  "decodeTextFrame:decodeTextFrame,readMp3Tags:readMp3Tags,translit:translit,durOk:durOk," +
  "isGoodMatchFlex:isGoodMatchFlex,pickMusicBrainzResult:pickMusicBrainzResult," +
  "add:add,entries:function(){return files;},needsCheck:needsCheck,summaryText:summaryText};\n})();");

function makeEl() {
  return {
    textContent: "", innerHTML: "", title: "", disabled: false, value: "",
    style: {}, dataset: {}, files: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, removeChild() {}, click() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
  };
}
const els = {};
const document = {
  getElementById(id) { return els[id] || (els[id] = makeEl()); },
  createElement() { return makeEl(); },
  body: makeEl(),
  documentElement: { setAttribute() {}, removeAttribute() {}, getAttribute() { return null; } },
};

const sandbox = {
  console, setTimeout, clearTimeout, TextEncoder, TextDecoder, Blob, File,
  URL, AbortController, fetch, document, Buffer,
  location: { protocol: "https:" },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "AShaffle-inline.js" });
const api = sandbox.__api;

/* ---------- разбор имён ---------- */
eq(api.stripTrackPrefix("01 - Intro"), "Intro", "префикс «01 - »");
eq(api.stripTrackPrefix("07. James Bond"), "James Bond", "префикс «07. »");
eq(api.stripTrackPrefix("01 Song"), "Song", "префикс с ведущим нулём");
eq(api.stripTrackPrefix("99 Luftballons"), "99 Luftballons", "число — часть названия");
eq(api.stripTrackPrefix("2001 - Одиссея"), "2001 - Одиссея", "год — часть названия");
eq(api.stripTrackPrefix("Track 05"), "Track 05", "не оставляем пустое название");

let p = api.parseTrackInfo("01 - Rick Astley - Never Gonna Give You Up.mp3");
eq(p.artist, "Rick Astley", "artist из «A - B»");
eq(p.title, "Never Gonna Give You Up", "title из «A - B»");

p = api.parseTrackInfo("99 Luftballons.mp3");
eq(p.title, "99 Luftballons", "название с числом целиком");
eq(p.artist, "", "исполнитель не выдуман");

p = api.parseTrackInfo("Daft_Punk_-_One_More_Time.mp3");
eq(p.artist, "Daft Punk", "artist через подчёркивания");
eq(p.title, "One More Time", "title через подчёркивания");

p = api.parseTrackInfo("Artist - Title (Official Video).mp3");
eq(p.title, "Title", "чистка мусорных скобок");

/* ---------- имена файлов ---------- */
eq(api.makeName({ artist: "AC/DC", title: "Back: In Black" }, ".mp3", 7),
   "007 - AC_DC - Back_ In Black.mp3", "запрещённые символы и нумерация");
eq(api.makeName({ artist: "con", title: "x" }, ".mp3", 1),
   "001 - _con - x.mp3", "зарезервированное имя Windows");
eq(api.makeName({ artist: "A.", title: "Hello..." }, ".mp3", 2),
   "002 - A - Hello.mp3", "точки по краям");
eq(api.makeName({ artist: "A", title: "y".repeat(200) }, ".mp3", 3).length <= 6 + 1 + 3 + 90 + 4,
   true, "длина названия ограничена");
eq(api.makeName({ artist: "", title: "Track" }, ".flac", null),
   "unknown_artist - Track.flac", "без номера и исполнителя");

/* ---------- список файлов ---------- */
const mkFile = (name) => new File([new Uint8Array([1, 2, 3])], name);
api.add([mkFile("A - B.mp3")], ["x/A - B.mp3"]);
eq(api.entries().length, 1, "add: файл добавлен");
eq(api.entries()[0].info.status, "raw", "add: статус raw");
eq(api.entries()[0].info.artist, "A", "add: исполнитель разобран");
api.add([mkFile("A - B.mp3")], ["x/A - B.mp3"]);
eq(api.entries().length, 1, "add: точный дубликат отклонён");
api.add([mkFile("A - B.mp3")], ["y/A - B.mp3"]);
eq(api.entries().length, 2, "add: одноимённый файл из другой папки добавлен");
api.add([mkFile("readme.txt")], ["x/readme.txt"]);
eq(api.entries().length, 2, "add: не аудио отклонено");
eq(api.needsCheck(api.entries()[0]), true, "needsCheck для raw");

/* ---------- транслитерация и длительность ---------- */
eq(api.translit("Дельфин"), "delfin", "транслит: Дельфин");
eq(api.translit("На часах ноль-ноль"), "na chasakh nol-nol", "транслит: кириллица → латиница");
eq(api.durOk(200, 200000), true, "длительность совпала");
eq(api.durOk(200, 230000), false, "длительность расходится на 30 с");
eq(api.durOk(0, 230000), true, "длительность неизвестна — не отсекаем");
eq(api.isGoodMatchFlex("Delfin Lyubov", "Дельфин", "Любовь"), true, "матч через транслит результата");

const recs = [{ "artist-credit": [{ name: "Dabro" }], title: "На часах ноль-ноль", length: 206386 }];
ok(api.pickMusicBrainzResult(recs, "Dabro На часах ноль-ноль", 206), "MB: совпадение с верной длительностью");
eq(api.pickMusicBrainzResult(recs, "Dabro На часах ноль-ноль", 100), null, "MB: отсев по длительности");

/* ---------- ZIP ---------- */
(async function () {
  /* ---------- чтение тегов ---------- */
  const tagBytes = api.buildId3v24Tag([
    { id: "TIT2", value: "Песня" },
    { id: "TPE1", value: "Артист" },
    { id: "TLEN", value: "215000" },
  ]);
  const mp3 = new Uint8Array(tagBytes.length + 8);
  mp3.set(tagBytes, 0);
  const tags = await api.readMp3Tags(new File([mp3], "x.mp3"));
  eq(tags && tags.title, "Песня", "тег TIT2 прочитан");
  eq(tags && tags.artist, "Артист", "тег TPE1 прочитан");
  eq(tags && tags.length, 215000, "тег TLEN прочитан");

  const utf8 = new TextEncoder().encode("Привет");
  const body8 = new Uint8Array(1 + utf8.length);
  body8[0] = 3; body8.set(utf8, 1);
  eq(api.decodeTextFrame(body8), "Привет", "текстовый кадр UTF-8");

  const le = new Uint8Array([0x01, 0xFF, 0xFE]);
  const utf16 = new Uint8Array(le.length + 2 * 4);
  utf16.set(le, 0);
  "Тест".split("").forEach((ch, i) => {
    const code = ch.charCodeAt(0);
    utf16[le.length + i * 2] = code & 0xff;
    utf16[le.length + i * 2 + 1] = code >> 8;
  });
  eq(api.decodeTextFrame(utf16), "Тест", "текстовый кадр UTF-16LE с BOM");

  const payloads = [
    { name: "001 - Артист - Песня.mp3", data: new Uint8Array([1, 2, 3, 4, 5]) },
    { name: "empty.bin", data: new Uint8Array(0) },
    { name: "big.bin", data: new Uint8Array(100000).map((_, i) => (i * 37) % 251) },
  ];
  const zipDir = path.join(TMP, "zip");
  fs.rmSync(zipDir, { recursive: true, force: true });
  fs.mkdirSync(zipDir, { recursive: true });
  payloads.forEach(p2 => fs.writeFileSync(path.join(zipDir, p2.name), Buffer.from(p2.data)));

  const blob = await api.buildZipBlob(
    payloads.map(p2 => ({ name: p2.name, file: new File([p2.data], p2.name) })),
    () => {}
  );
  fs.writeFileSync(path.join(TMP, "test.zip"), Buffer.from(await blob.arrayBuffer()));
  fs.writeFileSync(path.join(TMP, "zip-expected.json"),
                   JSON.stringify(payloads.map(p2 => p2.name), null, 2));

  /* ---------- ID3: прогон подготовленных mp3 ---------- */
  const inputs = path.join(TMP, "inputs.json");
  if (fs.existsSync(inputs)) {
    const list = JSON.parse(fs.readFileSync(inputs, "utf8"));
    const outDir = path.join(TMP, "out");
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    for (const item of list) {
      const buf = fs.readFileSync(path.join(TMP, item.src));
      const file = new File([buf], item.src, { type: "audio/mpeg" });
      const res = await api.makeRenamedFile(file, item.out, item.num, item.artist, item.title);
      eq(res.name, item.out, "имя результата " + item.src);
      const got = Buffer.from(await res.arrayBuffer());
      ok(got.length > buf.length - 4096, "размер результата " + item.src);
      fs.writeFileSync(path.join(outDir, item.out), got);
    }
  }

  console.log((failed ? "ПРОВАЛЕНО: " + failed : "Все проверки пройдены") +
              " (успешно " + passed + ")");
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
