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
  "readFlacTags:readFlacTags,readMp4Tags:readMp4Tags,readOggTags:readOggTags," +
  "readApeTags:readApeTags,readWmaTags:readWmaTags," +
  "untranslit:untranslit,tokenNear:tokenNear," +
  "isGoodMatchFlex:isGoodMatchFlex,pickMusicBrainzResult:pickMusicBrainzResult," +
  "matchScore:matchScore,cleanJunk:cleanJunk,dropVariants:dropVariants," +
  "foldMixed:foldMixed,collapseDoubles:collapseDoubles,stripSiteJunk:stripSiteJunk," +
  "altParse:altParse," +
  "add:add,entries:function(){return files;},needsCheck:needsCheck,summaryText:summaryText," +
  "rowHtml:rowHtml};\n})();");

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

const row = api.rowHtml(api.entries()[0], 0);
eq(row.indexOf('class="path"') < 0, true, "путь убран из верхней строки");
ok(row.indexOf('class="dir"') >= 0, "при разных папках показывается метка папки");

/* ---------- транслитерация и длительность ---------- */
eq(api.translit("Дельфин"), "delfin", "транслит: Дельфин");
eq(api.translit("На часах ноль-ноль"), "na chasakh nol-nol", "транслит: кириллица → латиница");
eq(api.durOk(200, 200000), true, "длительность совпала");
eq(api.durOk(200, 230000), false, "длительность расходится на 30 с");
eq(api.durOk(0, 230000), true, "длительность неизвестна — не отсекаем");
eq(api.isGoodMatchFlex("Delfin Lyubov", "Дельфин", "Любовь"), true, "матч через транслит результата");
eq(api.untranslit("Dabro"), "дабро", "обратный транслит: Dabro");
eq(api.untranslit("VityaDusha"), "витя душа", "обратный транслит: camelCase");
eq(api.untranslit("Дельфин"), "дельфин", "обратный транслит не трогает кириллицу");
eq(api.tokenNear("делфин", "дельфин"), true, "нечёткое сравнение: мягкий знак");
eq(api.isGoodMatchFlex("Dabro На часах ноль-ноль", "Дабро", "На часах ноль-ноль"), true, "матч: латиница ↔ кириллица");
eq(api.isGoodMatchFlex("VityaDusha Груз былого", "ВитяДуша", "Груз былого"), true, "матч: слитное латинское написание");
eq(api.isGoodMatchFlex("Rick Astley Never Gonna Give You Up", "Dreadsquad", "Slumdog millionaire"), false, "ложное совпадение не принято");

const recs = [{ "artist-credit": [{ name: "Dabro" }], title: "На часах ноль-ноль", length: 206386 }];
ok(api.pickMusicBrainzResult(recs, "Dabro На часах ноль-ноль", 206), "MB: совпадение с верной длительностью");
eq(api.pickMusicBrainzResult(recs, "Dabro На часах ноль-ноль", 100), null, "MB: отсев по длительности");
ok(api.matchScore("Dabro На часах ноль-ноль", "Dabro", "На часах ноль-ноль", 206, 206000) > 0.95, "оценка точного совпадения");
ok(api.matchScore("Dabro На часах ноль-ноль", "Полина Гагарина", "Один в поле воин", 206, 206000) < 0.5, "чужой кандидат оценён ниже");

/* ---------- чистка скобок ---------- */
eq(api.cleanJunk("Song (Official Video)"), "Song", "убираем (Official Video)");
eq(api.cleanJunk("Song (feat. X)"), "Song", "убираем (feat. X)");
eq(api.cleanJunk("Song (Remastered 2011)"), "Song", "убираем (Remastered 2011)");
eq(api.cleanJunk("Song - Topic"), "Song", "убираем хвост - Topic");
eq(api.cleanJunk("Song (Remix)"), "Song (Remix)", "ремикс оставляем — это версия записи");
eq(api.cleanJunk("Song (Live)"), "Song (Live)", "live оставляем");
eq(api.dropVariants("Song (Live)"), "Song", "для поиска live убираем");
eq(api.tokenNear("направл", "направление"), true, "усечённое слово совпадает");
const ap = api.altParse("Категория - Лесник - Король и Шут.mp3");
eq(ap && ap.artist, "Король и Шут", "обратный разбор: исполнитель в конце");
eq(ap && ap.title, "Лесник", "обратный разбор: название в середине");
eq(api.altParse("Король и Шут - Лесник.mp3"), null, "двух частей недостаточно для обратного разбора");
eq(api.tokenNear("мишел", "мишель"), true, "усечённый исполнитель совпадает");
eq(api.isGoodMatchFlex("Марат Мэлхарт", "ЧУДОBRO", ""), false, "чужой исполнитель не проходит проверку");
eq(api.isGoodMatchFlex("Моя Мишел", "Моя Мишель", ""), true, "усечённый исполнитель проходит");

/* ---------- смешанная письменность и лишние буквы ---------- */
eq(api.foldMixed("Bетер"), "Ветер", "латинская B внутри кириллицы");
eq(api.foldMixed("Mоя"), "Моя", "латинская M внутри кириллицы");
eq(api.foldMixed("Rick Astley"), "Rick Astley", "чистую латиницу не трогаем");
eq(api.collapseDoubles("Мишелль"), "Мишель", "лишняя удвоенная буква");
eq(api.stripSiteJunk("Бесприданница (Sefon.Pro)"), "Бесприданница", "сайт в скобках вырезан");
eq(api.stripSiteJunk("Song [zaycev.net]"), "Song", "сайт в квадратных скобках вырезан");
eq(api.stripSiteJunk("Song (Live)"), "Song (Live)", "обычные скобки не трогаем");
eq(api.isGoodMatchFlex("Bетер меняет направление", "Ветер меняет направление", ""), true, "матч при смешанной письменности");

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

  /* ---------- FLAC ---------- */
  const encU = (s) => new TextEncoder().encode(s);
  const be32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  const le32 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  const concat = (...arrs) => {
    const len = arrs.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  };
  const si = new Uint8Array(34);
  const sr = 44100, total = 8820000;
  si[10] = (sr >> 12) & 255; si[11] = (sr >> 4) & 255; si[12] = (sr & 15) << 4;
  const tb = be32(total);
  si[14] = tb[0]; si[15] = tb[1]; si[16] = tb[2]; si[17] = tb[3];
  const f1 = encU("TITLE=Песня"), f2 = encU("ARTIST=Артист");
  const vc = concat(new Uint8Array(4), le32(2), le32(f1.length), f1, le32(f2.length), f2);
  const blk = (type, last, body) => concat(new Uint8Array([(last ? 0x80 : 0) | type, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255]), body);
  const flacBuf = concat(encU("fLaC"), blk(0, false, si), blk(4, true, vc));
  const ftags = await api.readFlacTags(new File([flacBuf], "x.flac"));
  eq(ftags && ftags.title, "Песня", "FLAC: TITLE");
  eq(ftags && ftags.artist, "Артист", "FLAC: ARTIST");
  eq(ftags && ftags.length, 200000, "FLAC: длительность из STREAMINFO");

  /* ---------- M4A ---------- */
  const typ = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  const atomB = (typeBytes, payload) => {
    const size = 8 + payload.length;
    return concat(new Uint8Array([(size >>> 24) & 255, (size >>> 16) & 255, (size >>> 8) & 255, size & 255]), typeBytes, payload);
  };
  const dataAtom = (text) => atomB(typ("data"), concat(new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0]), encU(text)));
  const ilst = atomB(typ("ilst"), concat(
    atomB(new Uint8Array([0xA9, 0x6e, 0x61, 0x6d]), dataAtom("Песня")),
    atomB(new Uint8Array([0xA9, 0x41, 0x52, 0x54]), dataAtom("Артист")),
  ));
  const mp4 = concat(
    atomB(typ("ftyp"), encU("M4A \u0000\u0000\u0002\u0000")),
    atomB(typ("moov"), atomB(typ("udta"), atomB(typ("meta"), concat(new Uint8Array([0, 0, 0, 0]), ilst)))),
  );
  const mtags = await api.readMp4Tags(new File([mp4], "x.m4a"));
  eq(mtags && mtags.title, "Песня", "M4A: ©nam");
  eq(mtags && mtags.artist, "Артист", "M4A: ©ART");

  /* ---------- Ogg ---------- */
  const oggPage = (payload, seq, htype) => concat(
    encU("OggS"), new Uint8Array([0, htype]), new Uint8Array(8), new Uint8Array(4),
    le32(seq), new Uint8Array(4), new Uint8Array([1, payload.length]), payload,
  );
  const idPacket = concat(new Uint8Array([1]), encU("vorbis"), new Uint8Array(23));
  const comment = concat(new Uint8Array([3]), encU("vorbis"), new Uint8Array(4), le32(2) , le32(f1.length), f1, le32(f2.length), f2);
  const ogg = concat(oggPage(idPacket, 0, 2), oggPage(comment, 1, 0));
  const otags = await api.readOggTags(new File([ogg], "x.ogg"));
  eq(otags && otags.title, "Песня", "Ogg: TITLE");
  eq(otags && otags.artist, "Артист", "Ogg: ARTIST");

  /* ---------- APEv2 ---------- */
  const ascii = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  const apeItem = (key, value) => concat(le32(value.length), le32(0), ascii(key), new Uint8Array([0]), value);
  const apeItems = concat(apeItem("Title", encU("Песня")), apeItem("Artist", encU("Артист")));
  const apeFooter = concat(encU("APETAGEX"), le32(2000), le32(apeItems.length + 32), le32(2), le32(0), new Uint8Array(8));
  const ape = concat(new Uint8Array(100), apeItems, apeFooter);
  const atags = await api.readApeTags(new File([ape], "x.ape"));
  eq(atags && atags.title, "Песня", "APE: Title");
  eq(atags && atags.artist, "Артист", "APE: Artist");

  /* ---------- WMA/ASF ---------- */
  const le16 = (n) => new Uint8Array([n & 255, (n >> 8) & 255]);
  const le64 = (n) => {
    const a = new Uint8Array(8);
    let m = n;
    for (let i = 0; i < 8; i++) { a[i] = m & 255; m = Math.floor(m / 256); }
    return a;
  };
  const u16 = (s) => {
    const a = new Uint8Array(s.length * 2);
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a[i * 2] = c & 255; a[i * 2 + 1] = c >> 8; }
    return a;
  };
  const guid = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
  const wTitle = u16("Песня"), wArtist = u16("Артист");
  const cdPayload = concat(le16(wTitle.length), le16(wArtist.length), le16(0), le16(0), le16(0), wTitle, wArtist);
  const cdObject = concat(guid("3326b2758e66cf11a6d900aa0062ce6c"), le64(24 + cdPayload.length), cdPayload);
  const wmaHeaderSize = 30 + cdObject.length;
  const wma = concat(guid("3026b2758e66cf11a6d900aa0062ce6c"), le64(wmaHeaderSize), le32(1), new Uint8Array(2), cdObject);
  const wtags = await api.readWmaTags(new File([wma], "x.wma"));
  eq(wtags && wtags.title, "Песня", "WMA: Title");
  eq(wtags && wtags.artist, "Артист", "WMA: Author");

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
