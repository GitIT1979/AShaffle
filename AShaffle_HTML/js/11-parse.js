"use strict";
/* ============================================================
   1. ЛОКАЛЬНЫЙ ПАРСЕР
   ============================================================ */
/* Мусорные пометки в скобках: срезаем только когда точно понятно, что это не часть названия.
   Варианты записи (live, remix, acoustic, instrumental, demo) остаются. */
var _NOISE = {
  official:1, video:1, audio:1, music:1, lyric:1, lyrics:1, visualizer:1, visualiser:1,
  mv:1, "m/v":1, clip:1, teaser:1, trailer:1, premiere:1, topic:1,
  hd:1, hq:1, uhd:1, "4k":1, "1080p":1, "720p":1,
  explicit:1, clean:1, censored:1, remaster:1, remastered:1, deluxe:1, edition:1,
  radio:1, edit:1, version:1, mix:1,
  bonus:1, track:1, digital:1, mono:1, stereo:1, single:1, album:1, ep:1, ost:1, soundtrack:1,
  "премьера":1, "клип":1, "видеоклип":1, "официальный":1, "официальное":1,
  "видео":1, "саундтрек":1, "трек":1, "музыка":1
};
function _noiseInner(inner){
  var t = String(inner).toLowerCase().replace(/[.,;:!?"'«»]/g, " ").replace(/\s+/g, " ").trim();
  if(!t) return true;
  if(/^(feat|ft|при уч)\s+/.test(t)) return true;
  if(/^(prod|прод)(\s+by)?\s+/.test(t)) return true;
  if(/^\d{4}$/.test(t)) return true;
  if(/^\d{2,4}\s*(kbps|кбит)?$/.test(t)) return true;
  var words = t.split(" ");
  return words.every(function(w){ return _NOISE[w] || /^\d{4}$/.test(w); });
}
/* Мусорные водяные знаки сайтов в названии: «(Sefon.Pro)», «[zaycev.net]» */
var _SITE_TAIL = "ru|pro|net|com|org|info|cc|me|io|tv|su|biz|fm|co|site|online|top";
function stripSiteJunk(s){
  var re1 = new RegExp("\\s*\\(\\s*[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9-]+)*\\.(" + _SITE_TAIL + ")\\s*\\)", "gi");
  var re2 = new RegExp("\\s*\\[\\s*[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9-]+)*\\.(" + _SITE_TAIL + ")\\s*\\]", "gi");
  return String(s||"")
    .replace(re1, "")
    .replace(re2, "")
    .replace(new RegExp("[\\s._-]*[a-z0-9-]+\\.(" + _SITE_TAIL + ")\\s*$", "gi"), "")
    .replace(/\s{2,}/g, " ").trim();
}
/* «(feat. …)» в названии — не часть названия, исполнители уже есть отдельно */
function stripFeat(s){
  return String(s||"").replace(/\s*[\(\[]\s*(?:feat\.?|ft\.?|при\s*уч\.?)\s+[^\)\]]*[\)\]]/gi, "").replace(/\s{2,}/g, " ").trim();
}
/* Словарь переводов имён групп: technology → Технология */
var _ALIASES = {
  "technology": "Технология",
  "nautilus": "Наутилус",
  "nautilus pompilius": "Наутилус Помпилиус",
  "korol i shut": "Король и Шут",
  "dzhango": "Джанго",
  "jango": "Джанго",
  "жанго": "Джанго",
  "seryoga": "Серёга",
  "naiv": "Наив",
  "alians": "Альянс",
  "alyans": "Альянс",
  "dolphin": "Дельфин",
  "kino": "Кино",
  "viktor tsoi": "Виктор Цой",
  "viktor tsoy": "Виктор Цой",
  "moya mishel": "Моя Мишель",
  "zivert": "Зиверт",
  "billi ailish": "Билли Айлиш"
};
function aliasFor(artist){
  var k = String(artist||"").toLowerCase().replace(/\s+/g, " ").replace(/[\s.,;:!?]+$/, "").trim();
  if(!k) return "";
  if(_ALIASES[k]) return _ALIASES[k];
  var keys = Object.keys(_ALIASES);
  for(var i=0;i<keys.length;i++){
    /* Только по границе слова: «technology feat. X» — да, «technologic» — нет */
    if(k.indexOf(keys[i] + " ") === 0) return _ALIASES[keys[i]];
  }
  return "";
}
/* Словарь знает и целые связки: «korol i shut» — это имя группы,
   поэтому ищем самую короткую подходящую связку в начале «исполнитель + название» */
function aliasSplit(artist, title){
  var all = String(artist||"") + " " + String(title||"");
  all = all.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if(!all) return null;
  var words = all.split(" ");
  var limit = Math.min(words.length, 5);
  for(var n=1; n<=limit; n++){
    var phrase = words.slice(0, n).join(" ");
    var alias = aliasFor(phrase);
    if(alias) return { alias: alias, rest: words.slice(n).join(" ") };
  }
  return null;
}
/* Полное совпадение названия с запросом: длительность может врать (тишина, другой мастеринг),
   но только в разумных пределах — не когда разница в минуту-две */
var DUR_TOL_EXACT = 60;
function durOkExact(fileDur, candMs){
  if(!fileDur || !candMs) return true;
  return Math.abs(candMs / 1000 - fileDur) <= DUR_TOL_EXACT;
}
function nameExact(query, artist, title){
  var q = tokens(query), r = tokens((artist||"") + " " + (title||""));
  if(!q.length || q.join(" ") !== r.join(" ")) return false;
  /* Односложное короткое название совпадает случайно: «seorita» → любая Señorita */
  var sig = unique(q).filter(function(w){ return w.length >= 3 && !MODIFIERS[w]; });
  if(sig.length < 2) return sig.length === 1 && String(sig[0]).length >= 8;
  return true;
}
/** «(Bonus)», «(Remastered)» — не часть названия */
function stripNoiseBrackets(s){
  return String(s||"").replace(/\s*[\(\[]([^\)\]]*)[\)\]]/g, function(m, inner){
    return _noiseInner(inner) ? "" : m;
  }).replace(/\s{2,}/g, " ").trim();
}
/* «Unknown Artist», «VA» и прочие заглушки — не название */
function isPlaceholder(s){
  var k = String(s||"").trim().toLowerCase().replace(/[_.]+/g, " ").replace(/\s+/g, " ");
  return /^(unknown( artist| track)?|va|various artists|no artist|none|n\/a)$/.test(k);
}
function isUnknownInfo(info){
  var a=(info&&info.artist)||"", t=(info&&info.title)||"";
  return (!a || /^unknown_artist$/i.test(a)) && (!t || /^unknown_track$/i.test(t));
}
function cleanJunk(s){
  var out = String(s).replace(/\s*[\(\[]([^\)\]]*)[\)\]]/g, function(m, inner){
    return _noiseInner(inner) ? "" : m;
  });
  out = out
    .replace(/\s+[-–—]\s*(topic|official\s*(video|audio|music\s*video)|lyrics?|hd|hq|remaster(ed)?|single|album)\s*$/gi, "")
    .replace(/\s*\([^)]*\.[a-zа-я]{2,}\)/gi, "")
    .replace(/\s*\[[^\]]*\.[a-zа-я]{2,}\]/gi, "")
    .replace(/\s+official\s+music\s+video\b/gi, "")
    .replace(/\s+music\s+video\b/gi, "")
    .replace(/\s+official\s+video\b/gi, "")
    .replace(/\s+official\s+audio\b/gi, "")
    .replace(/\s+lyric\s+video\b/gi, "")
    .replace(/\s+uuid[-\s][\w-]+/gi, "")
    /* «everything i wanted audio» — одиночное служебное слово в конце */
    .replace(/\s+(audio|video|lyrics|lyric|official|clip|hd|hq|mv|m\/v)$/gi, "");
  return stripSiteJunk(out.replace(/\s+/g, " ").trim());
}
/* Для поиска убираем и варианты записи: ищем песню, а версию выберет длительность */
var _VARIANTS = { live:1, remix:1, acoustic:1, instrumental:1, extended:1, radio:1, edit:1, demo:1, cover:1, version:1 };
function dropVariants(s){
  return String(s).replace(/\s*[\(\[]([^\)\]]*)[\)\]]/g, function(m, inner){
    var words = inner.toLowerCase().replace(/[.,;:!?"'«»]/g, " ").split(/\s+/).filter(Boolean);
    return (words.length && words.every(function(w){ return _VARIANTS[w]; })) ? "" : m;
  }).replace(/\s+/g, " ").trim();
}
/* Отрезает номер трека, но не съедает названия, начинающиеся с числа:
   «01 - Intro», «07. James Bond», «01 Song» — префикс;
   «99 Luftballons», «2001 - Одиссея» — часть названия. */
function stripTrackPrefix(s){
  var cleaned = s, prev, iter = 0;
  do{
    prev = cleaned;
    var cand = cleaned
      .replace(/^\s*(track|трек)\s*\d{1,4}\s*[._\-\s–—−]*/i, "")
      .replace(/^\s*[\(\{\[]\s*\d{1,4}\s*[\)\}\]]\s*[._\-\s–—−]*/, "")
      /* номер + явный разделитель (точка, скобка, дефис…), за ним — буква */
      .replace(/^\s*\d{1,3}\s*[._)\]}\-–—]+\s*(?=[A-Za-zА-Яа-яЁё«"'])/, "")
      /* номер с ведущим нулём + пробел: «01 Song» */
      .replace(/^\s*0\d{1,3}\s+(?=[A-Za-zА-Яа-яЁё«"'])/, "")
      .replace(/^[\s._\-–—−]+/, "");
    if(/[A-Za-zА-Яа-яЁё]/.test(cand)) cleaned = cand;
    iter++;
  }while(cleaned !== prev && iter < 15);
  return cleaned.trim();
}
function trySplit(s){
  var candidates = [];
  var m = s.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if(m && m[1].trim() && m[2].trim()){
    candidates.push({ artist: m[1].trim(), title: m[2].trim(), score: 10 });
  }
  if(!m){
    m = s.match(/^(.+?)_+[-–—]_+(.+)$/);
    if(m && m[1].trim() && m[2].trim()){
      candidates.push({ artist: m[1].replace(/_/g," ").trim(), title: m[2].replace(/_/g," ").trim(), score: 9 });
    }
  }
  if(!m){
    m = s.match(/^(.+?)__+(.+)$/);
    if(m && m[1].trim() && m[2].trim()){
      candidates.push({ artist: m[1].replace(/_/g," ").trim(), title: m[2].replace(/_/g," ").trim(), score: 8 });
    }
  }
  if(!m){
    m = s.match(/^([^_]+)_+(.+)$/);
    if(m && m[1].trim() && m[2].trim()){
      candidates.push({ artist: m[1].replace(/_/g," ").trim(), title: m[2].replace(/_/g," ").trim(), score: 5 });
    }
  }
  /* Один дефис без пробелов: august-intelligency → august / intelligency */
  var dashCount = (s.match(/-/g) || []).length;
  if(!candidates.length && s.indexOf(" ") === -1 && dashCount === 1){
    var dm = s.match(/^([a-zа-яё][a-zа-яё0-9']{1,20})-([A-Za-zА-Яа-яЁё0-9][^\s]{2,})$/);
    if(dm){
      candidates.push({ artist: dm[1].trim(), title: dm[2].trim(), score: 4, _raw: s });
    }
  }
  if(!candidates.length && dashCount >= 2){
    var parts = s.split("-").map(function(x){return x.trim()}).filter(Boolean);
    if(parts.length >= 3){
      candidates.push({
        artist: parts.slice(0, -1).join(" "),
        title:  parts[parts.length - 1],
        score: 1,
        _raw: s
      });
    }
  }
  /* Раньше здесь был делёж по последнему пробелу/точке: «Bohemian Rhapsody»
     становилось исполнителем «Bohemian», а название теряло слово. Без явного
     разделителя исполнителя не угадываем — название сохраняем целиком. */
  if(!candidates.length) return { artist: "", title: s, score: 0, _raw: s };
  candidates.sort(function(a,b){ return b.score - a.score; });
  return candidates[0];
}
/* Мусорные префиксы в именах файлов: «11111 ABBA», «TVВиктор», «nai Наив», «AQF жанго» */
function stripNamePrefix(s){
  var out = String(s||"");
  out = out.replace(/^\s*\d{3,}[\s_-]+/, "");
  /* Языковые хвосты из имён файлов: august-intelligency-eng */
  out = out.replace(/[-_](eng|rus|ru|en)$/i, "");
  /* «TVВиктор», «UYTДжанго», «KR Виктор», «nai Наив» — но не «Egor Крид» */
  out = out.replace(/^[A-Z]{2,6}(?=[А-ЯЁа-яё])/, "");
  out = out.replace(/^[A-Z]{2,6}\s+(?=[А-ЯЁа-яё])/, "");
  out = out.replace(/^[a-z]{2,6}\s+(?=[А-ЯЁа-яё])/, "");
  return out.trim();
}
/* Обратный разбор имени с тремя и более частями: «Категория - Название - Исполнитель» */
function altParse(filename){
  var stem = filename.replace(/\.[^.]+$/, "");
  var cleaned = cleanJunk(stripNamePrefix(stripTrackPrefix(stem)));
  var parts = cleaned.split(/\s+[-–—]\s+/).map(function(x){ return x.trim(); }).filter(Boolean);
  if(parts.length < 3) return null;
  var artist = parts[parts.length - 1];
  var title = parts.slice(1, parts.length - 1).join(" - ");
  if(!artist || !title) return null;
  return { artist: foldMixed(artist), title: foldMixed(title), _raw: cleaned, score: 0 };
}
/* «the-black-eyed-peas-j-balvin» — дефисы вместо пробелов */
function splitGluedArtist(s){
  var t = String(s||"").trim();
  if(!t || /\s/.test(t)) return t;
  if((t.match(/-/g) || []).length < 2) return t;
  return t.split(/-+/).filter(function(w){ return w; }).join(" ");
}
/* «A & B», «A, B» — приводим к виду «A Feat. B» */
function featCredit(artist){
  var s = String(artist||"").trim();
  if(!s) return s;
  var parts = s.split(/\s*(?:&|,|\bfeat\.?|\bft\.?|\bx\b)\s*/i).filter(function(w){ return w; });
  if(parts.length < 2) return s;
  return parts[0] + " Feat. " + parts.slice(1).join(" & ");
}
/* Каталог часто теряет «The» у группы — возвращаем его из имени файла */
function keepArticle(artist, srcArtist){
  var a = String(artist||"").trim(), s = String(srcArtist||"").trim();
  if(!a || /[А-Яа-яЁё]/.test(a)) return a;
  var st = tokens(s), at = tokens(a);
  if(!st.length || st[0] !== "the") return a;
  if(at.length && at[0] === "the") return a;
  if(st.indexOf("the") < 0) return a;
  return "The " + a;
}
/* «and halsey-him and i» — в названии застряло продолжение исполнителя:
   g-eazy + and halsey  →  «g-eazy and halsey» ,  «him and i» */
function pullCreditFromTitle(artist, title){
  var t = String(title||"").trim();
  var m = t.match(/^(and|&|feat\.?|ft\.?|with|vs\.?|x)\s+(.{1,40}?)\s*[-–—]\s*(.+)$/i);
  if(!m) return null;
  var marker = m[1], name = m[2].trim(), rest = m[3].trim();
  if(!name || !rest) return null;
  if(!/[a-zA-Zа-яА-ЯёЁ]/.test(name) || !/[a-zA-Zа-яА-ЯёЁ]/.test(rest)) return null;
  var head = String(artist||"").trim();
  return { artist: (head ? head + " " : "") + marker + " " + name, title: rest };
}
function parseTrackInfo(filename){
  var stem = filename.replace(/\.[^.]+$/, "");  var cleaned = stripNamePrefix(stripTrackPrefix(stem));
  cleaned = cleanJunk(cleaned);
  var split = trySplit(cleaned);
  var artist = foldMixed(split.artist), title = foldMixed(split.title);
  var rawForSearch = split._raw || cleaned;
  title = cleanJunk(title);
  if(!/[a-zA-Zа-яА-ЯёЁ]/.test(title)) title = "unknown_track";
  if(artist && !/[a-zA-Zа-яА-ЯёЁ]/.test(artist)) artist = "";
  var glued = false;
  var fixed = splitGluedArtist(artist);
  if(fixed !== artist){ glued = true; artist = fixed; }
  /* Кредит, застрявший в названии, возвращаем к исполнителю */
  var pulled = pullCreditFromTitle(artist, title);
  if(pulled){ artist = pulled.artist; title = pulled.title; }
  return { artist: artist, title: title, _raw: rawForSearch, score: split.score || 0, _glued: glued };
}

/* ============================================================
   2. ВАЛИДАЦИЯ
   ============================================================ */
var MODIFIERS = {
  remaster:1, remastered:1, remix:1, mix:1, edit:1, version:1,
  live:1, acoustic:1, instrumental:1, extended:1, radio:1,
  official:1, video:1, audio:1, hd:1, hq:1,
  mono:1, stereo:1, deluxe:1, edition:1, bonus:1, track:1,
  demo:1, original:1, the:1, a:1, an:1, and:1, of:1, in:1,
  to:1, on:1, for:1, by:1, with:1,
  feat:1, ft:1, featuring:1};
var SUSPICIOUS = { mashup:1, bootleg:1, remix:1, cover:1, parody:1, karaoke:1 };

function tokens(s){
  var t = String(s || "");
  /* «mêmes» → «memes», «ё» → «е»: сравниваем без диакритики */
  if(t.normalize) t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  /* Апостроф не разделяет слово: Don't = Dont = «dont» */
  t = t.replace(/['’`´]/g, "");
  return t.toLowerCase()
    .replace(/[\(\)\[\]\{\},]/g, " ")
    .replace(/[^\wа-яё\s]/gi, " ")
    .split(/\s+/)
    .filter(function(w){ return w.length > 0; });
}
function unique(arr){
  var seen = {}, out = [];
  arr.forEach(function(w){ if(!seen[w]){ seen[w]=1; out.push(w); } });
  return out;
}
/* Латинские буквы‑двойники внутри кириллических слов: Bетер → ветер, Mоя → моя */
var _HOMO = { a:"а", b:"в", c:"с", d:"д", e:"е", f:"ф", g:"г", h:"н", i:"и", j:"й",
              k:"к", l:"л", m:"м", n:"н", o:"о", p:"р", q:"к", r:"р", s:"с", t:"т",
              u:"у", v:"в", w:"в", x:"х", y:"у", z:"з" };
function foldMixed(s){
  return String(s||"").replace(/[A-Za-zА-Яа-яЁё]+/g, function(w){
    if(!/[А-Яа-яЁё]/.test(w) || !/[A-Za-z]/.test(w)) return w;
    return w.split("").map(function(ch){
      var low = ch.toLowerCase();
      if(!Object.prototype.hasOwnProperty.call(_HOMO, low)) return ch;
      var cyr = _HOMO[low];
      return (ch !== ch.toLowerCase()) ? cyr.toUpperCase() : cyr;
    }).join("");
  });
}
/* Лишняя удвоенная буква: Мишелль → Мишель */
function collapseDoubles(s){
  return String(s||"").replace(/([A-Za-zА-Яа-яЁё])\1+/g, "$1");
}
function isGoodMatch(query, mbArtist, mbTitle, near){
  query = foldMixed(query); mbArtist = foldMixed(mbArtist); mbTitle = foldMixed(mbTitle);
  var has = function(list, w){
    if(!near) return list.indexOf(w) >= 0;
    return list.some(function(x){ return tokenNear(w, x); });
  };
  var combined = (mbArtist || "") + " " + (mbTitle || "");
  var q = unique(tokens(query));
  var r = unique(tokens(combined));
  var sigQ = q.filter(function(w){ return w.length > 2 && !MODIFIERS[w]; });
  var sigR = r.filter(function(w){ return w.length > 2 && !MODIFIERS[w]; });
  if(!sigQ.length) return true;
  var allIn = sigQ.every(function(w){ return has(r, w); });
  if(!allIn){
    var allIn2 = sigR.every(function(w){ return has(q, w); });
    return allIn2;
  }
  var extra = sigR.filter(function(w){ return !has(q, w); });
  /* Проверяем по всем словам кандидата: ремикс и кавер не должны пролезать,
     даже если они отфильтрованы как служебные */
  for(var k in SUSPICIOUS){
    if(r.indexOf(k) >= 0 && q.indexOf(k) < 0) return false;
  }
  if(extra.length > sigQ.length) return false;
  return true;
}
function lev(a, b){
  var m=a.length, n=b.length, i, j;
  var prev=new Array(n+1), cur=new Array(n+1);
  for(j=0;j<=n;j++) prev[j]=j;
  for(i=1;i<=m;i++){
    cur[0]=i;
    for(j=1;j<=n;j++){
      var cost = a.charAt(i-1)===b.charAt(j-1) ? 0 : 1;
      cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost);
    }
    var t=prev; prev=cur; cur=t;
  }
  return prev[n];
}
/* Мягкий знак и ы/и теряются при транслите, поэтому сравниваем токены приближённо */
function tokenNear(a, b){
  if(a === b) return true;
  var la=a.length, lb=b.length, min=Math.min(la,lb);
  if(min < 4) return false;
  /* обрезанное имя файла: «направл» ↔ «направление».
     Но «star» и «star1» — разные слова: цифровой хвост и слишком
     короткие основы за обрезку не считаем */
  if(a.indexOf(b) === 0 || b.indexOf(a) === 0){
    var longer = la > lb ? a : b, shorter = la > lb ? b : a;
    var rest = longer.slice(shorter.length);
    if(/^\d+$/.test(rest)) return false;
    if(min < 5) return false;
    return true;
  }
  if(Math.abs(la-lb) > 4) return false;
  return lev(a,b) <= (min >= 6 ? 2 : 1);
}

/* Остаток исходной фразы с пометкой версии: «3 to 1» + «get better radio remix»
   → «Get Better Radio Remix» — версия записи не теряется */
var _VERSION_WORDS = /(remix|mix|live|radio|edit|version|acoustic|instrumental|extended|demo|cover|bootleg|remaster)/i;
function versionTail(found, info){
  if(!found || !found.title) return "";
  /* Работаем по словам: дефисы внутри слова не должны ломать вычитание */
  var pool = tokens(String(info.artist||"") + " " + String(info.title||""));
  function consume(str){
    tokens(str).forEach(function(t){
      var at = pool.indexOf(t);
      if(at >= 0){ pool.splice(at, 1); return; }
      for(var i=0;i<pool.length;i++){
        if(tokenNear(pool[i], t)){ pool.splice(i, 1); return; }
      }
    });
  }
  consume(found.artist || "");
  consume(found.title || "");
  var rest = pool.filter(function(w){ return w !== "feat" && w !== "ft" && w !== "and"; });
  if(!rest.length || rest.length > 6) return "";
  var joined = rest.join(" ");
  if(!_VERSION_WORDS.test(joined)) return "";
  return joined;
}
/* Допуск по длительности: ремастер или тишина в начале могут добавить пару секунд */
var DUR_TOL = 10;
/* Ниже этого балла совпадение считается случайным: «Tyani» ≠ «Teni — HUSTLE» */
var MIN_SCORE = 0.5;
/* Бюджет шагов поиска: цепочка запросов не тянется бесконечно */
var _MAX_STEPS = 30;
/* Пометка версии в исходных данных («remix», «live»…) расширяет допуск по длительности.
   Передаётся параметром, а не глобальным флагом: параллельные проверки не перезаписывают друг друга */
function versionWide(artist, title){
  return _VERSION_WORDS.test(String(artist||"") + " " + String(title||""));
}
function durOk(fileDur, candMs){
  if(!fileDur || !candMs) return true;
  return Math.abs(candMs/1000 - fileDur) <= DUR_TOL;
}
/* Оценка кандидата: покрытие запроса, чистота лишних слов, близость длительности */
/* Мягкое сравнение: все слова запроса есть в кандидате, лишние допускаются */
function isGoodMatchLoose(query, artist, title){
  var q = unique(tokens(foldMixed(query))), r = unique(tokens(foldMixed((artist||"")+" "+(title||""))));
  var sigQ = q.filter(function(w){ return w.length > 2 && !MODIFIERS[w]; });
  if(!sigQ.length) return true;
  var ok = sigQ.every(function(w){ return r.some(function(x){ return x === w || tokenNear(w, x); }); });
  if(!ok) return false;
  for(var k in SUSPICIOUS){ if(r.indexOf(k) >= 0 && q.indexOf(k) < 0) return false; }
  return true;
}
function matchScore(query, artist, title, fileDur, candMs){
  /* Приводим обе стороны к латинице, иначе «Моя» и «Moya» не совпадут */
  var q = unique(tokens(translit(foldMixed(query)))), r = unique(tokens(translit(foldMixed((artist||"") + " " + (title||"")))));
  var sigQ = q.filter(function(w){ return w.length > 2 && !MODIFIERS[w]; });
  var sigR = r.filter(function(w){ return w.length > 2 && !MODIFIERS[w]; });
  var near = function(a, b){ return a === b || tokenNear(a, b); };
  var hit = 0;
  sigQ.forEach(function(w){ if(r.some(function(x){ return near(w, x); })) hit++; });
  var cov = sigQ.length ? hit / sigQ.length : 0.6;
  var extra = r.filter(function(w){ return !q.some(function(x){ return near(w, x); }); }).length;
  var clean = r.length ? 1 - extra / r.length : 1;
  var durScore = 1;
  if(fileDur && candMs) durScore = Math.max(0, 1 - Math.abs(candMs/1000 - fileDur) / (DUR_TOL * 2));
  return Math.max(0, Math.min(1, cov * 0.6 + clean * 0.2 + durScore * 0.2));
}
/* Кириллица → латиница: без этого половина русских треков не ищется в MB */
var _TR = {а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",
           к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
           х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"};
function translit(s){
  return String(s||"").toLowerCase().split("").map(function(ch){
    return Object.prototype.hasOwnProperty.call(_TR, ch) ? _TR[ch] : ch;
  }).join("").replace(/\s+/g," ").trim();
}
/* Латиница → кириллица: «Dabro» → «дабро», «VityaDusha» → «витя душа» */
var _UNTR = [
  ["shch","щ"],["sch","щ"],["zh","ж"],["kh","х"],["ts","ц"],["ch","ч"],["sh","ш"],
  ["yu","ю"],["ya","я"],["yo","ё"],["ye","е"],["ii","ий"],["yy","ый"],
  ["a","а"],["b","б"],["c","к"],["d","д"],["e","е"],["f","ф"],["g","г"],["h","х"],
  ["i","и"],["j","дж"],["k","к"],["l","л"],["m","м"],["n","н"],["o","о"],["p","п"],
  ["q","к"],["r","р"],["s","с"],["t","т"],["u","у"],["v","в"],["w","в"],["x","кс"],
  ["y","ы"],["z","з"]
];
/* MusicBrainz сравнивает кириллицу в кавычках с учётом регистра:
   «Возвращайся» находится, «возвращайся» — нет */
function capWords(s){
  return String(s||"").replace(/(^|[\s\-–—])([а-яёa-z])/gi, function(m, pre, ch){ return pre + ch.toUpperCase(); });
}
function untranslit(s){
  var raw = String(s||"").replace(/([a-z])([A-Z])/g, "$1 $2");
  /* «ay/ey/oy/uy» — «ай/ей/ой/уй» только перед согласной или в конце слова:
     «Moya» → «Моя», но «chaysya» → «чайся» */
  raw = raw.replace(/([aeou])y(?![aeiouy])/gi, function(m, v){
    return { a:"ай", e:"ей", o:"ой", u:"уй" }[v.toLowerCase()];
  });
  var src = raw.toLowerCase();
  var out = "", i = 0;
  while(i < src.length){
    var hit = null, len = 0;
    for(var k=0;k<_UNTR.length;k++){
      var seq = _UNTR[k][0];
      if(src.substr(i, seq.length) === seq){ hit = _UNTR[k][1]; len = seq.length; break; }
    }
    if(hit === null){ out += src.charAt(i); i++; }
    else { out += hit; i += len; }
  }
  return out.replace(/\s+/g," ").trim();
}
function isGoodMatchFlex(query, artist, title){
  query = foldMixed(query);
  if(isGoodMatch(query, artist, title)) return true;
  /* Мягкий проход: «seorita» ≈ «señorita» */
  if(isGoodMatch(query, artist, title, true)) return true;
  var a=foldMixed(artist||""), t=foldMixed(title||"");
  /* Приводим обе стороны к латинице: «Dabro» ↔ «Дабро» */
  var ql=translit(query), al=translit(a), tl=translit(t);
  if((ql !== String(query).toLowerCase() || al !== a.toLowerCase() || tl !== t.toLowerCase()) &&
     isGoodMatch(ql, al, tl, true)) return true;
  /* И к кириллице: «VityaDusha» ↔ «ВитяДуша» */
  var qu=untranslit(query);
  if(/[а-яё]/.test(qu) && isGoodMatch(qu, untranslit(a), untranslit(t), true)) return true;
  return false;
}

