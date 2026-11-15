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
  "stripTrackPrefix:stripTrackPrefix,safeNamePart:safeNamePart,trySplit:trySplit,stripNamePrefix:stripNamePrefix," +
  "buildZipBlob:buildZipBlob,makeRenamedFile:makeRenamedFile," +
  "readId3Tag:readId3Tag,buildId3v24Tag:buildId3v24Tag,ext:ext," +
  "decodeTextFrame:decodeTextFrame,readMp3Tags:readMp3Tags,translit:translit,durOk:durOk," +
  "readFlacTags:readFlacTags,readMp4Tags:readMp4Tags,readOggTags:readOggTags," +
  "readApeTags:readApeTags,readWmaTags:readWmaTags," +
  "untranslit:untranslit,tokenNear:tokenNear," +
  "isGoodMatchFlex:isGoodMatchFlex,pickMusicBrainzResult:pickMusicBrainzResult," +
  "matchScore:matchScore,cleanJunk:cleanJunk,dropVariants:dropVariants," +
  "foldMixed:foldMixed,collapseDoubles:collapseDoubles,stripSiteJunk:stripSiteJunk," +
  "altParse:altParse,altsPush:altsPush,sortAlts:sortAlts,altsFor:altsFor," +
  "splitGluedArtist:splitGluedArtist,featCredit:featCredit,keepArticle:keepArticle," +
  "creditKey:creditKey,isGoodMatch:isGoodMatch,tailOk:tailOk,aliasFor:aliasFor," +
  "aliasSplit:aliasSplit,nameExact:nameExact,durOkExact:durOkExact," +
  "pullCreditFromTitle:pullCreditFromTitle,creditGaps:creditGaps," +
  "shaveGluedLetter:shaveGluedLetter,capitalizeArtist:capitalizeArtist," +
  "add:add,entries:function(){return files;},needsCheck:needsCheck,summaryText:summaryText," +
  "rowHtml:rowHtml,startRename:startRename,RULES:RULES," +
  "norm:norm,stripNoiseBrackets:stripNoiseBrackets,isPlaceholder:isPlaceholder," +
  "lookupTrack:lookupTrack,lookupDeezer:lookupDeezer,capWords:capWords," +
  "completeCredit:completeCredit,isUnknownInfo:isUnknownInfo," +
  "expandOrdinals:expandOrdinals,phraseTitle:phraseTitle," +
  "DUR_TOL:DUR_TOL,DUR_TOL_EXACT:DUR_TOL_EXACT,MIN_SCORE:MIN_SCORE,SUSPICIOUS:SUSPICIOUS};\n})();");

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
eq(api.foldMixed("Vиктор Цой"), "Виктор Цой", "латинская V внутри кириллицы");
eq(api.foldMixed("Цой"), "Цой", "чистая кириллица не меняется");
eq(api.makeName({ artist: "Vиктор Цой", title: "Кукушка" }, ".mp3", null), "Виктор Цой - Кукушка.mp3", "в имени файла двойников нет");
eq(api.parseTrackInfo("086 - Vиктор Цой - Кукушка.mp3").artist, "Виктор Цой", "двойник в имени файла");
eq(api.foldMixed("Rick Astley"), "Rick Astley", "чистую латиницу не трогаем");
eq(api.collapseDoubles("Мишелль"), "Мишель", "лишняя удвоенная буква");
eq(api.stripSiteJunk("Бесприданница (Sefon.Pro)"), "Бесприданница", "сайт в скобках вырезан");
eq(api.stripSiteJunk("Song [zaycev.net]"), "Song", "сайт в квадратных скобках вырезан");
eq(api.stripSiteJunk("Song (Live)"), "Song (Live)", "обычные скобки не трогаем");
eq(api.isGoodMatchFlex("Bетер меняет направление", "Ветер меняет направление", ""), true, "матч при смешанной письменности");

/* ---------- правила разбора на реальных именах ---------- */
const parseCases = [
  ["KR Виктор Цой - Красно-жёлтые дни.mp3", "Виктор Цой", "Красно-жёлтые дни"],
  ["023 - KR Виктор Цой - Красно-жёлтые дни.mp3", "Виктор Цой", "Красно-жёлтые дни"],
  ["TVВиктор Цой - Группа крови.mp3", "Виктор Цой", "Группа крови"],
  ["AQF жанго - Метель.mp3", "жанго", "Метель"],
  ["UYTДжанго - Вчера Сегодня Завтра.mp3", "Джанго", "Вчера Сегодня Завтра"],
  ["Sерьга - Детское сердце.mp3", "Серьга", "Детское сердце"],
  ["technology - Странные танцы.mp3", "technology", "Странные танцы"],
  ["august-intelligency-eng.mp3", "august", "intelligency"],
  ["Egor Крид feat. Филипп Киркоров - Цвет Настроения Чёрный.mp3", "Egor Крид feat. Филипп Киркоров", "Цвет Настроения Чёрный"],
  ["kesha_-_tik_tok_(vmuzone.com).mp3", "kesha", "tik tok"],
  ["Body To Body [ backingtrackx.com ].mp3", "", "Body To Body"],
  ["Bohemian Rhapsody.mp3", "", "Bohemian Rhapsody"],
];
parseCases.forEach(function(c){
  const p = api.parseTrackInfo(c[0]);
  eq(p.artist, c[1], "разбор исполнителя: " + c[0]);
  eq(p.title, c[2], "разбор названия: " + c[0]);
});

/* ---------- кредит, застрявший в названии ---------- */{
  eq(api.shaveGluedLetter("MДжанго"), "Джанго", "одиночная латинская буква срезана");
  eq(api.shaveGluedLetter("МДжанго"), "Джанго", "одиночная кириллическая буква срезана");
  eq(api.shaveGluedLetter("Джанго"), "", "нормальное имя не трогаем");
  eq(api.shaveGluedLetter("Ёлка"), "", "одна буква в начале имени — не мусор");
  eq(api.shaveGluedLetter("G-Eazy"), "", "латиница с дефисом не трогаем");
  eq(api.capitalizeArtist("жанго"), "Жанго", "строчное имя получает заглавную");
  eq(api.aliasFor("жанго"), "Джанго", "строчный жанго из словаря");
  eq(api.capitalizeArtist("g-eazy"), "G-Eazy", "дефис тоже граница слова");
  eq(api.capitalizeArtist("Джанго"), "", "имя с заглавной не трогаем");
  eq(api.capitalizeArtist("INNA"), "", "капс не трогаем");
  eq(api.stripNamePrefix("UYTДжанго"), "Джанго", "префикс срезан до склейки двойников");

  const pc = api.pullCreditFromTitle("g-eazy", "and halsey-him and i");
  eq(pc && pc.artist, "g-eazy and halsey", "продолжение исполнителя возвращено");
  eq(pc && pc.title, "him and i", "название очищено");
  eq(api.pullCreditFromTitle("g-eazy", "him and i"), null, "обычное название не трогаем");
  eq(api.pullCreditFromTitle("Queen", "Bohemian Rhapsody"), null, "без маркера кредита — нет");
  const fp2 = api.pullCreditFromTitle("", "feat. Halsey - Him and I");
  eq(fp2 && fp2.artist, "feat. Halsey", "feat в начале названия");

  const gp2 = api.parseTrackInfo("099 - g-eazy - and halsey-him and i.mp3");
  eq(gp2.artist, "g-eazy and halsey", "из имени файла кредит собран");
  eq(gp2.title, "him and i", "из имени файла название собрано");

  eq(api.creditGaps("G-Eazy", "g-eazy and halsey").join(","), "halsey", "недостающий участник найден");
  eq(api.creditGaps("G-Eazy & Halsey", "g-eazy and halsey").length, 0, "полный кредит — пробелов нет");
  eq(api.creditGaps("Ava Max", "ava max").length, 0, "одиночный исполнитель в порядке");
}

/* ---------- словарь имён групп ---------- */
{
  const sp = api.aliasSplit("korol", "i shut-dva druga");
  eq(sp && sp.alias, "Король и Шут", "связка из исполнителя и начала названия");
  eq(sp && sp.rest, "dva druga", "остаток названия отделён");
  eq(api.aliasSplit("technology", "Странные танцы").alias, "Технология", "обычный случай");
  eq(api.aliasSplit("ava max", "sweet but psycho"), null, "нераспознанный исполнитель");

  eq(api.nameExact("ava max sweet but psycho", "Ava Max", "Sweet but Psycho"), true, "точное совпадение имени");
  eq(api.nameExact("ava max sweet but psycho", "Ava Max", "Sweet but Psycho (Acoustic)"), false, "другая версия — не точное");
  eq(api.durOkExact(207.2, 187000), true, "разница 20 секунд допустима при точном имени");
  eq(api.durOkExact(100, 206386), false, "разница более минуты — нет");
}

/* ---------- словарь: одиночное имя ---------- */
{
  eq(api.aliasFor("technology"), "Технология", "словарное имя");
  eq(api.aliasFor("Technology"), "Технология", "регистр не важен");
  eq(api.aliasFor("Technology."), "Технология", "точка в конце не мешает");
  eq(api.aliasFor("technology feat. X"), "Технология", "приглашённый участник не мешает");
  eq(api.aliasFor("technologic"), "", "чужое слово по префиксу не подставляем");
  eq(api.aliasFor(""), "", "пустой исполнитель");
}

/* ---------- хвост названия ---------- */
{
  const fp = api.parseTrackInfo("061 - Alians- Звуки на - заре.mp3");
  const words = (fp.artist + " " + fp.title).split(/\s+/).filter(Boolean);
  eq(api.tailOk({ artist: "Альянс", title: "На Заре" }, words), true, "«На Заре» из слов файла");
  eq(api.tailOk({ artist: "Альянс", title: "Фальстарт" }, words), false, "чужое название не принимаем");
  eq(api.tailOk({ artist: "Баста", title: "На заре" }, words), true, "хвост из слов файла при любом исполнителе");
}

/* ---------- склеенные имена и кредиты ---------- */
{
  eq(api.splitGluedArtist("the-black-eyed-peas-j-balvin"), "the black eyed peas j balvin", "дефисы вместо пробелов в имени");
  eq(api.splitGluedArtist("jay-z"), "jay-z", "одиночный дефис не трогаем");
  eq(api.splitGluedArtist("The Black Eyed Peas"), "The Black Eyed Peas", "имя с пробелами не трогаем");

  const gp = api.parseTrackInfo("057 - the-black-eyed-peas-j-balvin - ritmo.mp3");
  eq(gp.artist, "the black eyed peas j balvin", "имя из файла расклеено");
  eq(gp._glued, true, "склеенное имя помечено");

  eq(api.featCredit("Black Eyed Peas & J Balvin"), "Black Eyed Peas Feat. J Balvin", "амперсанд заменён на Feat.");
  eq(api.featCredit("Black Eyed Peas, J Balvin & SWACQ"), "Black Eyed Peas Feat. J Balvin & SWACQ", "три участника");
  eq(api.featCredit("Queen"), "Queen", "один исполнитель без изменений");

  eq(api.keepArticle("Black Eyed Peas", "the black eyed peas j balvin"), "The Black Eyed Peas", "артикль возвращён");
  eq(api.keepArticle("Kesha", "kesha"), "Kesha", "без артикля в файле не добавляем");
  eq(api.keepArticle("Queen", ""), "Queen", "пустой источник не влияет");

  eq(api.isGoodMatch("the black eyed peas j balvin ritmo", "Black Eyed Peas, J Balvin & SWACQ", "RITMO (Bad Boys For Life) [SWACQ Remix]"), false, "ремикс не подходит");
  eq(api.isGoodMatch("the black eyed peas j balvin ritmo", "Black Eyed Peas & J Balvin", "RITMO (Bad Boys For Life)"), true, "сам трек подходит");

  const k1 = api.creditKey("The Black Eyed Peas Feat. J Balvin", "RITMO (Bad Boys For Life)");
  const k2 = api.creditKey("Black Eyed Peas & J Balvin", "RITMO (Bad Boys For Life)");
  eq(k1, k2, "один и тот же кредит склеивается");
  eq(api.creditKey("Marshmello", "FRIENDS (acoustic)") === api.creditKey("Marshmello", "Friends"), false, "акустика остаётся отдельным вариантом");
}

/* ---------- варианты одного названия ---------- */
{
  const l = [];
  api.altsPush(l, { artist: "25/17", title: "Холодная весна", source: "Deezer", score: 0.9 });
  api.altsPush(l, { artist: "Джанго", title: "Холодная весна", source: "Deezer", score: 0.85 });
  api.altsPush(l, { artist: "Джанго", title: "Холодная весна", source: "iTunes", score: 0.95 });
  eq(l.length, 2, "дубликаты вариантов склеиваются");
  eq(l[1].score, 0.95, "от дубликата остаётся лучший балл");

  const sorted = api.sortAlts(l);
  eq(sorted[0].artist, "Джанго", "варианты сортируются по баллу");

  const a = api.altsFor({ artist: "25/17", title: "Холодная весна", source: "Deezer", score: 0.9 }, l, 186700);
  eq(a.length, 2, "выбранный плюс альтернатива");
  eq(a[0].artist, "25/17", "выбранный вариант всегда первый");
  eq(a[0].isSelf, true, "первый помечен как выбранный");
  eq(a[1].artist, "Джанго", "второй — альтернатива");
}

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

  /* ---------- реестр правил: каждое правило должно иметь живой код ---------- */
  {
    const R = api.RULES;
    ok(Array.isArray(R) && R.length >= 30, "реестр правил заполнен (" + (R ? R.length : 0) + ")");
    const ids = R.map(r => r.id);
    eq(ids.join(","), ids.slice().sort((a, b) => a - b).join(","), "id правил идут по порядку");
    eq(new Set(ids).size, ids.length, "id правил не повторяются");
    const broken = R.filter(r => {
      if (r.fn) return typeof api[r.fn] !== "function";
      if (r.const) return api[r.const] === undefined;
      if (r.inFn) return typeof api[r.inFn] !== "function";
      return true;
    });
    eq(broken.map(r => r.id).join(","), "", "у каждого правила есть живой код");
    const layers = new Set(R.map(r => r.layer));
    ok(layers.has("вход") && layers.has("запрос") && layers.has("проверка") && layers.has("вывод"),
       "правила покрывают все четыре слоя");

    /* Пошаговые случаи: одно правило — один пример */
    const cases = require("./rules.js");
    const known = new Set(ids);
    const unknown = cases.filter(c => !known.has(c.id)).map(c => c.id);
    eq(unknown.join(","), "", "все случаи ссылаются на существующие правила");
    for (const c of cases) {
      let res = false;
      try { res = !!c.run(api); } catch (e) { res = false; }
      ok(res, "правило " + c.id + ": " + c.name);
    }
  }

  console.log((failed ? "ПРОВАЛЕНО: " + failed : "Все проверки пройдены") +
              " (успешно " + passed + ")");
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
