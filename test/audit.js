/* Аудит всей библиотеки: прогоняет конвейер распознавания без браузера.
   node test/audit.js "C:\Users\User\Desktop\Музыка_Оля"
   Нужен test/tmp/durations.json (создаётся заранее из mutagen). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HTML = fs.readFileSync(path.join(__dirname, "..", "AShaffle.html"), "utf8");
const EXPORTS = [
  "parseTrackInfo", "readMp3Tags", "usefulTag", "foldMixed", "stripSiteJunk",
  "stripNamePrefix", "stripNoiseBrackets", "norm", "pullCreditFromTitle",
  "lookupTrack", "altParse", "preferCyrillic", "preferCyrillicTitle",
  "completeCredit", "isUnknownInfo", "makeName", "ext", "inspectEntry",
  "versionWide",
];

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

/* Deezer отдаётся только через JSONP: подменяем тег <script> настоящим запросом */
let pending = new Map();
function makeDocument() {
  const els = {};
  const doc = {
    getElementById(id) { return els[id] || (els[id] = makeEl()); },
    createElement(tag) {
      const el = makeEl();
      if (String(tag).toLowerCase() !== "script") return el;
      let src = "";
      Object.defineProperty(el, "src", {
        get() { return src; },
        set(v) {
          src = v;
          const name = new URL(v).searchParams.get("callback");
          const clean = new URL(v);
          clean.searchParams.delete("output");
          clean.searchParams.delete("callback");
          el.parentNode = { removeChild() {} };
          el.onerror = el.onerror || function () {};
          fetch(clean.toString())
            .then(r => r.json())
            .then(j => { if (sandbox[name]) sandbox[name](j); })
            .catch(() => { if (sandbox[name]) sandbox[name](null); });
        },
      });
      return el;
    },
    body: makeEl(),
    documentElement: { setAttribute() {}, removeAttribute() {}, getAttribute() { return null; } },
  };
  return doc;
}

const document = makeDocument();
const sandbox = {
  console, setTimeout, clearTimeout, TextEncoder, TextDecoder, Blob, File, Buffer,
  URL, AbortController, fetch, document,
  location: { protocol: "https:" },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

let code = HTML.match(/<script>([\s\S]*?)<\/script>/)[1];
if (!/\}\)\(\);\s*$/.test(code)) throw new Error("неожиданное окончание скрипта");
code = code.replace(/\}\)\(\);\s*$/,
  "globalThis.__api={" + EXPORTS.map(n => n + ":" + n).join(",") + "};\n})();");
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const api = sandbox.__api;

const dir = process.argv[2] || "C:\\Users\\User\\Desktop\\Музыка_Оля";
const durations = JSON.parse(fs.readFileSync(path.join(__dirname, "tmp", "durations.json"), "utf8"));
const files = fs.readdirSync(dir).filter(f => /\.(mp3|flac|m4a|ogg|opus|wma|ape)$/i.test(f)).sort();

function buildInfo(name, tags) {
  const parsed = api.parseTrackInfo(name);
  const info = {
    artist: parsed.artist, title: parsed.title, _raw: parsed._raw,
    _glued: !!parsed._glued, status: "raw", source: "",
  };
  if (tags) {
    if (api.usefulTag(tags.artist) && api.norm(tags.artist) !== api.norm(info.artist)) {
      info.artist = api.stripSiteJunk(api.foldMixed(api.stripNamePrefix(tags.artist.trim())));
    }
    if (api.usefulTag(tags.title) && api.norm(tags.title) !== api.norm(info.title)) {
      info.title = api.stripNoiseBrackets(api.stripSiteJunk(api.foldMixed(api.stripNamePrefix(tags.title.trim()))));
    }
    const pulled = api.pullCreditFromTitle(info.artist, info.title);
    if (pulled) { info.artist = pulled.artist; info.title = pulled.title; }
  }
  return info;
}

async function resolveFile(name) {
  const p = path.join(dir, name);
  const buf = fs.readFileSync(p);
  const f = new File([buf], name);
  const dur = durations[name] || 0;
  const ext = api.ext(name);
  let tags = null;
  try { tags = ext === "mp3" ? await api.readMp3Tags(f) : null; } catch (e) {}
  const info = buildInfo(name, tags);
  if (api.isUnknownInfo(info)) return { name, parsed: info, found: null, note: "нет данных" };
  const wide = api.versionWide(info.artist, info.title);
  let found = await api.lookupTrack(info, dur);
  if (!found) {
    const alt = api.altParse(name);
    if (alt) found = await api.lookupTrack(alt, dur);
  }
  found = await api.preferCyrillic(found, dur, info.artist, wide);
  found = await api.preferCyrillicTitle(found, dur, info.artist, wide);
  found = await api.completeCredit(found, info, dur, wide);
  return { name, parsed: info, found, dur };
}

(async () => {
  const rows = [];
  let i = 0;
  async function worker() {
    while (i < files.length) {
      const name = files[i++];
      try {
        const r = await resolveFile(name);
        rows.push(r);
        const mark = !r.found ? "НЕТ" : (api.norm(r.found.artist) === api.norm(r.parsed.artist) && api.norm(r.found.title) === api.norm(r.parsed.title)) ? "ТАКЖЕ" : "OK";
        console.log(`${mark}\t${name}\t=> ${r.found ? r.found.artist + " — " + r.found.title : "—"}\t[${r.parsed.artist} — ${r.parsed.title}]`);
      } catch (e) {
        console.log(`ОШИБКА\t${name}\t${e && e.message}`);
      }
    }
  }
  await Promise.all([worker(), worker()]);
  const fail = rows.filter(r => !r.found);
  console.log(`\nВсего: ${rows.length}, без результата: ${fail.length}`);
  fs.writeFileSync(path.join(__dirname, "tmp", "audit.json"), JSON.stringify(rows, null, 1), "utf8");
})();
