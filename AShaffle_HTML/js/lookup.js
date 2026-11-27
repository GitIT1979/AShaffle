"use strict";
/* ============================================================
   8. ПРОВЕРКА НАЗВАНИЙ И ASHUFFLE
   ============================================================ */
/* Название кандидата должно состоять из слов файла: «На Заре» ⊂ «Звуки на заре» */
function tailOk(found, fileWords){
  if(!found || !found.title) return false;
  var pool = fileWords.map(function(w){ return w.toLowerCase(); });
  var tt = tokens(found.title);
  if(!tt.length) return false;
  var ok = tt.every(function(w){
    return pool.some(function(x){ return x === w || tokenNear(w, x); });
  });
  if(ok) return true;
  /* «9PM» в каталоге против «9 pm» в файле: сравниваем и без пробелов */
  var joinedTitle = tt.join("");
  var joinedPool = pool.join("");
  return joinedTitle.length > 2 && joinedPool.indexOf(joinedTitle) >= 0;
}
/* Имя строчными буквами: Deezer ищет «Джанго», но не «жанго» */
function capitalizeArtist(artist){
  var s = String(artist||"").trim();
  if(!s) return "";
  if(s !== s.toLowerCase() || s === s.toUpperCase()) return "";
  var out = s.replace(/(^|[\s\-–—(])([a-zа-яё])/g, function(m, pre, ch){ return pre + ch.toUpperCase(); });
  return out !== s ? out : "";
}
/* Одиночная буква прилипла к имени: «MДжанго» → «Джанго» */
function shaveGluedLetter(artist){
  var s = String(artist||"");
  var out = s.replace(/^[A-Za-zА-ЯЁ](?=[А-ЯЁ])/, "");
  return (out !== s && out.length > 1) ? out : "";
}
/* Порядковые числительные: «на 5-м этаже» люди пишут и так,
   а в каталоге — «на пятом этаже» */
var _ORD_NOM = ["первый","второй","третий","четвёртый","пятый","шестой","седьмой","восьмой","девятый","десятый","одиннадцатый","двенадцатый"];
var _ORD_PREP = ["первом","втором","третьем","четвёртом","пятом","шестом","седьмом","восьмом","девятом","десятом","одиннадцатом","двенадцатом"];
function expandOrdinals(s){
  return String(s||"").replace(/(^|[^\d])(\d{1,2})\s*[-–—]?\s*(й|я|ый|ой|ом|м|го|му|е)(?![а-яё])/gi, function(m, pre, num, suf){
    var n = parseInt(num, 10);
    if(!(n >= 1 && n <= 12)) return m;
    var low = suf.toLowerCase();
    var word = (/^(м|ом|го|му|е)$/.test(low)) ? _ORD_PREP[n-1] : _ORD_NOM[n-1];
    if(!word) return m;
    return pre + word;
  });
}
/* Вся фраза как название: «Moya Моя Любовь На 5-Ом» + «Этаже».
   Дубли транслита схлопываются («Moya» = «Моя»), числительные разворачиваются. */
function phraseTitle(artist, title){
  var words = (String(artist||"") + " " + String(title||"")).split(/\s+/).filter(Boolean);
  var out = [];
  words.forEach(function(w){
    var key = translit(w.toLowerCase());
    for(var i=0;i<out.length;i++){
      if(translit(out[i].toLowerCase()) === key){
        if(/[а-яё]/i.test(w) && !/[а-яё]/i.test(out[i])) out[i] = w;
        return;
      }
    }
    out.push(w);
  });
  return expandOrdinals(out.join(" ")).replace(/\s+/g, " ").trim();
}
/* Короткий латинский обрубок перед кириллическим именем: «Var Би-2» → «Би-2».
   Роли (DJ, MC, TV…) — не мусор, их не трогаем. */
var _ROLE_PREFIX = { dj:1, mc:1, vj:1, fm:1, tv:1, am:1, pm:1, ost:1, vip:1, mp3:1, hd:1, hq:1, feat:1 };
function dropJunkPrefix(artist){
  var m = String(artist||"").trim().match(/^([A-Za-z]{1,4})\s+(\S.*)$/);
  if(!m) return "";
  var head = m[1].toLowerCase(), rest = m[2].trim();
  if(_ROLE_PREFIX[head]) return "";
  if(!/^[А-ЯЁа-яё]/.test(rest)) return "";
  if(!/[а-яё]/i.test(rest)) return "";
  return rest;
}
/* «feat eneli» — не часть названия: для запроса кредит можно убрать */
function stripFeatCredit(s){
  return String(s||"").replace(/\s+(feat\.?|ft\.?|featuring|при\s+уч\.?)\s+\S+/gi, " ").replace(/\s+/g, " ").trim();
}
/* ============================================================
   ПАМЯТЬ ПРАВОК
   Пользователь поправил трек вручную или выбрал вариант ⇄ —
   это запоминается по имени файла и применяется само.
   ============================================================ */
var _MEM_KEY = "ashuffle.mem.v1";
function memAll(){
  try{ return JSON.parse(localStorage.getItem(_MEM_KEY) || "{}") || {}; }catch(e){ return {}; }
}
function memSave(){
  try{ localStorage.setItem(_MEM_KEY, JSON.stringify(_MEM)); }catch(e){}
}
var _MEM = memAll();
function memKeyOf(name){ return norm(name); }
function memGet(name){
  var k = memKeyOf(name);
  return Object.prototype.hasOwnProperty.call(_MEM, k) ? _MEM[k] : null;
}
function memSet(name, artist, title){
  if(!name) return;
  var a = String(artist||"").trim(), t = String(title||"").trim();
  if(!a && !t) return;
  _MEM[memKeyOf(name)] = { artist:a, title:t, name:String(name), at:Date.now() };
  memSave();
}
function memDel(name){
  var k = memKeyOf(name);
  if(Object.prototype.hasOwnProperty.call(_MEM, k)){ delete _MEM[k]; memSave(); }
}
if(typeof window !== "undefined") window.__ashuffleMemory = function(){ return _MEM; };

function lookupTrack(info, dur){
  /* Латинские двойники вычищаем у любых входных данных, не только из имени файла */
  var a=foldMixed(info.artist||""), t=foldMixed(info.title||""), raw=foldMixed(info._raw||"");
  /* Заглушка («unknown_artist») или непроизносимая запись («花電車») —
     не исполнитель: ищем по одному названию */
  if(isPlaceholder(a) || !tokens(a).length) a = "";
  var wide = versionWide(info.artist, info.title);
  var primary=(a && t && t!=="unknown_track") ? (a+" "+t) : "";
  /* Без исполнителя запрос строится по названию, а не по сырому имени файла */
  var term=(primary || (a ? raw : t) || raw).replace(/[-_]+/g," ").replace(/\s+/g," ").trim();
  if(!term) return Promise.resolve(null);
  if(!primary && (!t || t === "unknown_track")) return Promise.resolve(null);

  var qterm = dropVariants(term) || term;
  var titleQ = dropVariants(t || "");
  var shortTerm = ((a ? a + " " : "") + (t || "").split(/\s+/).slice(0, 2).join(" ")).trim();
  if(shortTerm === qterm) shortTerm = "";
  /* Усечённое или неполное имя исполнителя — те же запасные варианты */
  /* Название из одних служебных слов («remix») само по себе ничего не ищет:
     запрос «исполнитель + remix» цепляет чужие ремиксы. Считаем до titleOnly:
     иначе titleWeak в этой точке ещё undefined и «модификатор» ищется как песня */
  var titleTok = tokens(t || "");
  var titleWeak = titleTok.length > 0 && titleTok.every(function(w){ return MODIFIERS[w]; });
  var titleOnly = (titleWeak ? "" : (titleQ || t || "")).trim();
  if(titleOnly === qterm || titleOnly === shortTerm) titleOnly = "";
  var firstArtistWord = (a || "").split(/\s+/)[0] || "";
  var shortArtistTerm = (firstArtistWord && t && firstArtistWord !== a && !titleWeak) ? (firstArtistWord + " " + (titleQ || t)).trim() : "";
  if(shortArtistTerm === qterm) shortArtistTerm = "";
  var cyr = /[а-яё]/i.test(term);

  var steps=[];
  function pushMBPrecise(){
    steps.push(guardArtist(function(){
      return lookupMusicBrainzByArtistTitle(a, titleQ || t).then(function(r){ return pickMusicBrainzResult(r, primary, dur, wide); });
    }, a, t));
  }
  function pushMBTerm(term){
    steps.push(guardArtist(function(){
      return lookupMusicBrainzByRecording(term).then(function(r){ return pickMusicBrainzResult(r, term, dur, wide); });
    }, a && term.indexOf(a) === 0 ? a : "", t));
  }
  function pushDeezer(term){
    /* Без исполнителя правило «лишних слов» не работает: в кандидате всегда есть имя артиста */
    var l = !a;
    steps.push(guardArtist(function(){ return lookupDeezer(term, dur, l, wide); }, a && term.indexOf(a) === 0 ? a : "", t));
  }
  function pushITunes(term){
    var l = !a;
    steps.push(guardArtist(function(){ return lookupITunes(term, dur, l, wide); }, a && term.indexOf(a) === 0 ? a : "", t));
  }
  /* Запрос без исполнителя не должен подменять исполнителя: сверяем с тем, что в файле */
  function guardTitle(expectedTitle, fn){
    return function(){
      return fn().then(function(f){
        if(!f) return f;
        return isGoodMatchFlex(expectedTitle, "", f.title || "") ? f : null;
      });
    };
  }
  function guardArtist(fn, expected, expectedTitle){
    return function(){
      return fn().then(function(f){
        if(!f || !expected) return f;
        if(isGoodMatchFlex(expected, f.artist || "", "")) return f;
        /* В каталоге бывает перепутано: артист = наше название, название = наш артист */
        if(expectedTitle && isGoodMatchFlex(expected, f.title || "", "") && isGoodMatchFlex(expectedTitle, f.artist || "", "")) return f;
        return null;
      });
    };
  }

  if(cyr){
    /* У русских треков MusicBrainz часто пуст, а Deezer и Apple знают каталог */
    pushDeezer(qterm);
    pushITunes(qterm);
    if(primary) pushMBPrecise();
    pushMBTerm(qterm);
  } else {
    if(primary) pushMBPrecise();
    pushMBTerm(qterm);
    /* Латиница ищется сразу в каталогах: обратный транслит — уже догадка */
    pushDeezer(qterm);
    pushITunes(qterm);
  }
  /* Известные переводы имён групп: technology → Технология.
     Словарь — не догадка, поэтому спрашиваем сразу после основного запроса */
  var als = aliasSplit(a, t);
  if(als && als.alias && als.alias !== a){
    var aliasTerm = (als.alias + " " + als.rest).replace(/\s+/g, " ").trim();
    var restCyr = als.rest && !/[а-яё]/i.test(als.rest) ? untranslit(als.rest) : "";
    var aliasTermCyr = (restCyr ? (als.alias + " " + restCyr) : "").trim();
    if(aliasTermCyr && aliasTermCyr.toLowerCase() !== aliasTerm.toLowerCase()){
      steps.push(function(){ return lookupDeezer(aliasTermCyr, dur, 0, wide); });
      steps.push(function(){ return lookupITunes(aliasTermCyr, dur, 0, wide); });
    }
    if(aliasTerm && aliasTerm.toLowerCase() !== qterm.toLowerCase()){
      steps.push(function(){ return lookupDeezer(aliasTerm, dur, 0, wide); });
      steps.push(function(){ return lookupITunes(aliasTerm, dur, 0, wide); });
      steps.push(function(){
        return lookupMusicBrainzByRecording(aliasTerm).then(function(r){ return pickMusicBrainzResult(r, aliasTerm, dur, wide); });
      });
    }
  }
  /* Короткий латинский обрубок в начале имени: «Var Би-2» → «Би-2» */
  var trimmed = dropJunkPrefix(a);
  if(trimmed){
    var trTerm = (trimmed + " " + (titleQ || t)).replace(/\s+/g, " ").trim();
    if(trTerm.toLowerCase() !== qterm.toLowerCase()){
      steps.push(guardArtist(function(){ return lookupDeezer(trTerm, dur, 0, wide); }, trimmed, titleQ || t));
      steps.push(guardArtist(function(){ return lookupITunes(trTerm, dur, 0, wide); }, trimmed, titleQ || t));
      steps.push(guardArtist(function(){
        return lookupMusicBrainzByRecording(trTerm).then(function(r){ return pickMusicBrainzResult(r, trTerm, dur, wide); });
      }, trimmed, titleQ || t));
    }
  }
  /* Название — языковой огрызок («eng»), а в исполнителе два слова:
     пробуем того же исполнителя и перевёрнутый порядок («intelligency august») */
  var titleJunk = /^(eng|rus|ru|en|ukr|bel)$/i.test(String(t||"").trim());
  var aw = String(a||"").split(/\s+/).filter(Boolean);
  if(titleJunk && aw.length >= 2 && aw.length <= 3){
    var lastWord = aw[aw.length-1];
    var revTerm = aw.slice().reverse().join(" ");
    steps.push(guardArtist(function(){ return lookupDeezer(a, dur, 0, wide); }, lastWord, t));
    steps.push(guardArtist(function(){ return lookupDeezer(revTerm, dur, 0, wide); }, lastWord, t));
    steps.push(guardArtist(function(){ return lookupITunes(revTerm, dur, 0, wide); }, lastWord, t));
  }
  /* Имя строчными: «жанго» → «Джанго» */
  var capA = capitalizeArtist(a);
  if(capA){
    var capTerm = (capA + " " + (titleQ || t)).replace(/\s+/g, " ").trim();
    if(capTerm.toLowerCase() !== qterm.toLowerCase()){
      steps.push(guardArtist(function(){ return lookupDeezer(capTerm, dur, 0, wide); }, capA, titleQ || t));
      steps.push(guardArtist(function(){ return lookupITunes(capTerm, dur, 0, wide); }, capA, titleQ || t));
      steps.push(guardArtist(function(){
        return lookupMusicBrainzByRecording(capTerm).then(function(r){ return pickMusicBrainzResult(r, capTerm, dur, wide); });
      }, capA, titleQ || t));
    }
  }
  /* Одиночная буква прилипла к имени: «MДжанго» → «Джанго» */
  var shaved = shaveGluedLetter(a);
  if(shaved){
    var shTerm = (shaved + " " + (titleQ || t)).replace(/\s+/g, " ").trim();
    if(shTerm.toLowerCase() !== qterm.toLowerCase()){
      steps.push(guardArtist(function(){ return lookupDeezer(shTerm, dur, 0, wide); }, shaved, titleQ || t));
      steps.push(guardArtist(function(){ return lookupITunes(shTerm, dur, 0, wide); }, shaved, titleQ || t));
      steps.push(guardArtist(function(){
        return lookupMusicBrainzByRecording(shTerm).then(function(r){ return pickMusicBrainzResult(r, shTerm, dur, wide); });
      }, shaved, titleQ || t));
    }
  }
  /* Второй проход латиницей: «Дельфин» → «Delfin» */
  var trq=translit(qterm);
  if(trq && trq !== qterm.toLowerCase()) pushMBTerm(trq);
  /* Третий проход кириллицей: «Dabro» → «дабро» */
  var unq=untranslit(qterm);
  if(unq && unq !== qterm.toLowerCase() && /[а-яё]/.test(unq)){
    /* Русские названия ищем и в каталогах, не только в MusicBrainz */
    steps.push(function(){ return lookupDeezer(unq, dur, true, wide); });
    steps.push(function(){ return lookupITunes(unq, dur, true, wide); });
    pushMBTerm(capWords(unq));
    /* MusicBrainz хранит кредиты вида «Джанго & Екатерина Гусева»:
       отдельно ищем кириллическое название, а исполнителя сверяем сами */
    var unqT = untranslit(titleQ || t);
    if(unqT && unqT !== unq && /[а-яё]{3}/.test(unqT)){
      var unqA = untranslit(String(a||"").replace(/[-_]+/g, " ")).trim();
      var firstCyr = unqA.split(/\s+/)[0] || "";
      steps.push(function(){
        /* «Джанго & Екатерина Гусева» — в кредите первый исполнитель наш */
        var q = firstCyr.length >= 3 ? lookupMusicBrainzByArtistTitle(capWords(firstCyr), capWords(unqT))
                                      : lookupMusicBrainzByRecording(capWords(unqT));
        return q.then(function(r){
          return pickMusicBrainzResult(r, (unqA + " " + unqT).trim(), dur, wide);
        });
      });
    }
  }
  /* Смешанная письменность и лишние буквы — пробуем исправленный запрос */
  var qfold = foldMixed(qterm);
  if(qfold && qfold !== qterm){ pushDeezer(qfold); pushITunes(qfold); pushMBTerm(qfold); }
  var qdup = collapseDoubles(qfold);
  if(qdup && qdup !== qfold){ pushDeezer(qdup); pushITunes(qdup); pushMBTerm(qdup); }
  /* Известные переводы имён групп: technology → Технология */
  var alias = aliasFor(a);
  /* Усечённое имя файла сокращают постепенно */
  if(shortTerm){ pushDeezer(shortTerm); pushITunes(shortTerm); }
  /* Неполный исполнитель: первое слово имени */
  if(shortArtistTerm){
    steps.push(guardTitle(titleQ || t, function(){ return lookupDeezer(shortArtistTerm, dur, 0, wide); }));
    steps.push(guardTitle(titleQ || t, function(){ return lookupITunes(shortArtistTerm, dur, 0, wide); }));
  }
  /* Совсем без исполнителя — по одному названию; название кандидата тоже проверяем */
  if(titleOnly){
    steps.push(guardTitle(titleOnly, guardArtist(function(){ return lookupDeezer(titleOnly, dur, true, wide); }, a)));
    steps.push(guardTitle(titleOnly, guardArtist(function(){ return lookupITunes(titleOnly, dur, true, wide); }, a)));
    steps.push(guardTitle(titleOnly, guardArtist(function(){
      return lookupMusicBrainzByRecording(titleOnly).then(function(r){ return pickMusicBrainzResult(r, titleOnly, dur, wide); });
    }, a)));
  }
  var headWord = String(a||"").split(/\s+/)[0].replace(/[-–—]+$/, "");
  var allWords = (String(a||"") + " " + String(t||"")).split(/\s+/)
                   .filter(function(w){ return /[a-zA-Zа-яА-ЯёЁ0-9]/.test(w); });
  /* Префиксный перебор: первые 4–6 слов фразы (в исполнителя могло попасть название) */
  if(allWords.length > 4){
    var prefSeen = {};
    for(var pk=4; pk<=Math.min(6, allWords.length-1); pk++){
      (function(k){
        var q = allWords.slice(0, k).join(" ").replace(/\s+/g, " ").trim();
        if(!q || prefSeen[q.toLowerCase()]) return;
        prefSeen[q.toLowerCase()] = 1;
        steps.push(function(){
          return lookupDeezer(q, dur, true, wide).then(function(f){ return tailOk(f, allWords) ? f : null; });
        });
        var q2 = stripFeatCredit(q);
        if(q2 && q2 !== q){
          steps.push(function(){
            return lookupDeezer(q2, dur, true, wide).then(function(f){ return tailOk(f, allWords) ? f : null; });
          });
        }
      })(pk);
    }
  }
  /* Последняя попытка: вся фраза как название — когда в исполнителя попал кусок названия */
  var phrase = phraseTitle(a, t);
  if(phrase && phrase.toLowerCase() !== qterm.toLowerCase() && tokens(phrase).length >= 3){
    steps.push(guardTitle(phrase, function(){ return lookupDeezer(phrase, dur, true, wide); }));
    steps.push(guardTitle(phrase, function(){ return lookupITunes(phrase, dur, true, wide); }));
    steps.push(guardTitle(phrase, function(){
      return lookupMusicBrainzByRecording(capWords(phrase)).then(function(r){ return pickMusicBrainzResult(r, phrase, dur, wide); });
    }));
  }
  /* Последняя попытка: первое слово исполнителя + хвост названия.
     В тегах граница бывает сдвинута: «Alians- Звуки на» + «заре» → «Alians на заре» */
  if(headWord && allWords.length >= 3){
    var asked = {};
    asked[qterm.toLowerCase()] = 1; asked[titleOnly.toLowerCase()] = 1;
    [2, 3, 1].forEach(function(n){
      if(n >= allWords.length) return;
      var tail = allWords.slice(allWords.length - n).join(" ");
      var q = (headWord + " " + tail).replace(/\s+/g, " ").trim();
      var key = q.toLowerCase();
      if(asked[key]) return;
      asked[key] = 1;
      /* Название в кандидате должно состоять из слов файла — нового не выдумываем */
      steps.push(guardArtist(function(){
        return lookupDeezer(q, dur, true, wide).then(function(f){ return tailOk(f, allWords) ? f : null; });
      }, headWord, tail));
      steps.push(guardArtist(function(){
        return lookupITunes(q, dur, true, wide).then(function(f){ return tailOk(f, allWords) ? f : null; });
      }, headWord, tail));
    });
  }

  /* Без исполнителя каждый шаг обязан подтвердить название */
  if(!a && steps.length){
    var tq = titleQ || t;
    steps = steps.map(function(fn){ return guardTitle(tq, fn); });
  }
  var i=0;
  function next(){
    if(i>=steps.length || i>=_MAX_STEPS) return Promise.resolve(null);
    return Promise.resolve(steps[i++]()).then(function(found){ return found ? found : next(); });
  }
  return next().catch(function(){ return null; });
}

