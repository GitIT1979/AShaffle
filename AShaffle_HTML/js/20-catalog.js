/* ============================================================
   3. MusicBrainz + iTunes (таймауты, retry 503/429)
   ============================================================ */
var _mbCache = {}, _lastMBRequest = 0, _netErrors = 0;
/* Кэши не растут бесконечно: при переполнении выметаем старую половину записей */
function _cachePut(store, key, val, cap){
  var ks = Object.keys(store);
  if(ks.length >= (cap || 2000)){
    for(var i = 0; i < (ks.length >> 1); i++) delete store[ks[i]];
  }
  store[key] = val;
}

function _fetchT(url, opts, ms){
  if(typeof AbortController !== "function") return fetch(url, opts);
  var ac = new AbortController();
  var timer = setTimeout(function(){ ac.abort(); }, ms || 15000);
  var o = {}, k;
  for(k in (opts || {})) if(Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
  o.signal = ac.signal;
  return fetch(url, o).then(function(r){ clearTimeout(timer); return r; },
                           function(e){ clearTimeout(timer); throw e; });
}
function _mbFetch(url, attempt){
  attempt = attempt || 0;
  return _fetchT(url, null, 15000)
    .then(function(r){
      if((r.status === 503 || r.status === 429) && attempt < 2){
        console.warn("MB " + r.status + ", retry in 2s (attempt " + (attempt+1) + ")");
        return new Promise(function(resolve){ setTimeout(resolve, 2000); })
          .then(function(){ return _mbFetch(url, attempt + 1); });
      }
      if(!r.ok) throw new Error("MB " + r.status);
      return r;
    });
}
function _mbRequest(query, limit){
  var lim = limit || 5;
  var key = "mb|" + lim + "|" + query.toLowerCase();
  if(Object.prototype.hasOwnProperty.call(_mbCache, key)) return Promise.resolve(_mbCache[key]);
  var now = Date.now(), wait = Math.max(0, 1100 - (now - _lastMBRequest));
  return new Promise(function(resolve){
    setTimeout(function(){
      _lastMBRequest = Date.now();
      var url = "https://musicbrainz.org/ws/2/recording/?query=" +
                encodeURIComponent(query) + "&fmt=json&limit=" + lim;
      _mbFetch(url)
        .then(function(r){ return r.json(); })
        .then(function(data){
          _cachePut(_mbCache, key, data.recordings || []);
          resolve(_mbCache[key]);
        })
        .catch(function(){ _netErrors++; resolve([]); });
    }, wait);
  });
}
function lookupMusicBrainzByRecording(term){
  return _mbRequest('recording:"' + term.replace(/"/g,"") + '"');
}
function lookupMusicBrainzByArtistTitle(artist, title){
  var parts = [];
  if(artist) parts.push('artist:"' + artist.replace(/"/g,"") + '"');
  if(title)  parts.push('recording:"' + title.replace(/"/g,"") + '"');
  return _mbRequest(parts.join(" AND "), 15);
}
/* ---------- варианты одного названия ---------- */
/* Несколько песен могут называться одинаково и совпадать по длительности.
   Собираем всех подходящих кандидатов, лучшего берём сразу, остальные — на выбор. */
/* Ключ «тот же самый кредит»: без служебных слов, «feat» и регистра.
   Название сравниваем как есть — иначе (live) и (acoustic) схлопнутся с оригиналом */
function creditKey(artist, title){
  var sig = tokens(artist).filter(function(w){
    return !MODIFIERS[w] && w !== "feat" && w !== "ft" && w !== "x";
  }).sort().join(" ");
  return sig + "|" + tokens(title).sort().join(" ");
}
function altsPush(list, cand){
  if(!cand || !cand.artist || !cand.title) return;
  /* «(Bonus)», сайты и прочее — не часть названия, иначе дубликаты не склеятся */
  var clean = stripNoiseBrackets(stripSiteJunk(String(cand.title)));
  cand = { artist: cand.artist, title: clean || cand.title, source: cand.source, score: cand.score, dur: cand.dur };
  /* Сравниваем по набору слов: «The Black Eyed Peas Feat. J Balvin» и
     «Black Eyed Peas & J Balvin» — один и тот же кредит */
  var k = creditKey(cand.artist, cand.title);
  for(var i=0;i<list.length;i++){
    if(creditKey(list[i].artist, list[i].title) === k){
      if((cand.score||0) > (list[i].score||0)) list[i] = cand;
      return;
    }
  }
  list.push(cand);
}
function sortAlts(list, limit){
  return list.slice().sort(function(x,y){
    var d = (y.score||0) - (x.score||0);
    if(Math.abs(d) > 1e-9) return d;
    return (x.title||"").length - (y.title||"").length;
  }).slice(0, limit || 5).map(function(c){
    return { artist:c.artist, title:c.title, source:c.source, score:c.score || 0, dur:c.dur || 0 };
  });
}
function mergeAlts(list, more){
  var out = (list || []).slice();
  (more || []).forEach(function(c){ altsPush(out, c); });
  return sortAlts(out);
}
/* Выбранный вариант — всегда первым, остальные подряд */
function altsFor(chosen, extra, fileDur){
  var list = [];
  altsPush(list, { artist: chosen.artist, title: chosen.title, source: chosen.source, score: chosen.score || 0, dur: fileDur || 0 });
  (extra || []).forEach(function(c){ altsPush(list, c); });
  var sorted = sortAlts(list, 6);
  var key = creditKey(chosen.artist, chosen.title);
  var rest = [], self = null;
  sorted.forEach(function(c){
    if(creditKey(c.artist, c.title) === key) self = c;
    else rest.push(c);
  });
  if(!self) self = { artist: chosen.artist, title: chosen.title, source: chosen.source, score: chosen.score || 0, dur: fileDur || 0 };
  self.isSelf = true;
  return [self].concat(rest);
}
/* Лучший кандидат: выше балл, при равенстве — более короткое название */
function _betterCand(cur, cand){
  if(!cur) return true;
  if(cand.score > cur.score + 1e-9) return true;
  return Math.abs(cand.score - cur.score) <= 1e-9 && cand.title.length < cur.title.length;
}
function pickMusicBrainzResult(recordings, query, dur, wide){
  if(!recordings || !recordings.length) return null;
  var best = null, picked = [];
  for(var i=0;i<recordings.length;i++){
    var rec = recordings[i];
    if(!rec["artist-credit"] || !rec["artist-credit"].length) continue;
    var mbArtist = rec["artist-credit"].map(function(c){ return (c.name || "") + (c.joinphrase || ""); }).join("").trim();
    var mbTitle  = stripFeat(rec.title);
    if(isPlaceholder(mbArtist) || isPlaceholder(mbTitle)) continue;
    if(!mbTitle || !/[a-zA-Zа-яА-ЯёЁ]/.test(mbTitle)) continue;
    if(!durOk(dur, rec.length) && !(durOkExact(dur, rec.length) && (wide || nameExact(query, mbArtist, mbTitle)))) continue;
    if(!isGoodMatchFlex(query, mbArtist, mbTitle)) continue;
    var cleanTitle = String(mbTitle).trim();
    var s = matchScore(query, mbArtist, mbTitle, dur, rec.length);
    /* Сначала отсев по баллу — в альтернативы ⇄ непрошедшие порог не попадают */
    if(s < MIN_SCORE) continue;
    var cand = { artist: mbArtist, title: cleanTitle, source: "MusicBrainz", score: s, dur: rec.length || 0 };
    altsPush(picked, cand);
    if(_betterCand(best, cand)) best = cand;
  }
  if(best) best.alts = sortAlts(picked);
  return best;
}
var _itCache = {}, _lastITRequest = 0;
/* Deezer: ключ не нужен, но CORS нет — берём через JSONP. Название оставляем как есть. */
var _dzCache = {}, _jsonpSeq = 0;
function _jsonp(url, cbParam, timeoutMs){
  function attempt(n){
    return new Promise(function(resolve){
      var name = "__asj" + (++_jsonpSeq) + "_" + Date.now();
      var script = document.createElement("script");
      var done = false, timer = 0;
      function finish(data){
        if(done) return;
        done = true;
        if(timer) clearTimeout(timer);
        try{ delete window[name]; }catch(e){ window[name] = undefined; }
        if(script.parentNode) script.parentNode.removeChild(script);
        if(data) return resolve(data);
        /* Сбой сети или лимит Deezer: одна повторная попытка */
        if(n < 1) return setTimeout(function(){ attempt(n+1).then(resolve); }, 500);
        resolve(null);
      }
      window[name] = function(data){ finish(data); };
      script.onerror = function(){ finish(null); };
      script.src = url + "&" + cbParam + "=" + encodeURIComponent(name);
      timer = setTimeout(function(){ finish(null); }, timeoutMs || 10000);
      document.body.appendChild(script);
    });
  }
  return attempt(0);
}
function lookupDeezer(term, dur, loose, wide){
  if(!term) return Promise.resolve(null);
  var key = "dz|" + Math.round(dur||0) + "|" + term.toLowerCase() + (loose ? "|L" : "") + (wide ? "|W" : "");
  if(Object.prototype.hasOwnProperty.call(_dzCache, key)) return Promise.resolve(_dzCache[key]);
  var url = "https://api.deezer.com/search?q=" + encodeURIComponent(term) + "&limit=5&output=jsonp";
  return _jsonp(url, "callback", 10000).then(function(json){
    /* Транспортный сбой JSONP: считаем ошибкой сети и не кэшируем */
    if(!json){ _netErrors++; return null; }
    var out = null, picked = [];
    ((json && json.data) || []).forEach(function(t){
      if(!t || !t.title || !t.artist || !t.artist.name) return;
      if(isPlaceholder(t.artist.name) || isPlaceholder(t.title)) return;
      if(!durOk(dur, (t.duration || 0) * 1000) && !(durOkExact(dur, (t.duration || 0) * 1000) && (wide || nameExact(term, t.artist.name, t.title)))) return;
      var m = loose ? isGoodMatchLoose(term, t.artist.name, t.title) : isGoodMatchFlex(term, t.artist.name, t.title);
      if(!m) return;
      var s = matchScore(term, t.artist.name, t.title, dur, (t.duration || 0) * 1000);
      var cand = { artist: t.artist.name, title: stripFeat(String(t.title).trim()), source: "Deezer", score: s, dur: (t.duration || 0) * 1000 };
      if(s < MIN_SCORE) return;
      altsPush(picked, cand);
      if(_betterCand(out, cand)) out = cand;
    });
    if(out) out.alts = sortAlts(picked);
    _cachePut(_dzCache, key, out);
    return out;
  }).catch(function(){ _netErrors++; return null; });
}
function lookupITunes(term, dur, loose, wide){
  if(!CAN_ITUNES) return Promise.resolve(null);
  if(!term) return Promise.resolve(null);
  var key = "it|" + Math.round(dur||0) + "|" + term.toLowerCase() + (loose ? "|L" : "") + (wide ? "|W" : "");
  if(Object.prototype.hasOwnProperty.call(_itCache, key)) return Promise.resolve(_itCache[key]);
  var now = Date.now(), wait = Math.max(0, 3200 - (now - _lastITRequest));
  return new Promise(function(resolve){
    setTimeout(function(){
      _lastITRequest = Date.now();
      var url = "https://itunes.apple.com/search?term=" + encodeURIComponent(term) + "&media=music&entity=song&limit=5";
      _fetchT(url, null, 12000)
        .then(function(r){ if(!r.ok) throw new Error("iTunes " + r.status); return r.json(); })
        .then(function(data){
          var out = null, picked = [];
          if(data.resultCount && data.results){
            for(var i=0;i<data.results.length;i++){
              var res = data.results[i];
              if(!res.trackName || !res.artistName) continue;
              if(isPlaceholder(res.artistName) || isPlaceholder(res.trackName)) continue;
              if(!/[a-zA-Zа-яА-ЯёЁ]/.test(res.trackName)) continue;
              if(!durOk(dur, res.trackTimeMillis) && !(durOkExact(dur, res.trackTimeMillis) && (wide || nameExact(term, res.artistName, res.trackName)))) continue;
              var m2 = loose ? isGoodMatchLoose(term, res.artistName, res.trackName) : isGoodMatchFlex(term, res.artistName, res.trackName);
              if(!m2) continue;
              var cleanTitle = stripFeat(res.trackName);
              var sc = matchScore(term, res.artistName, res.trackName, dur, res.trackTimeMillis);
              var cand2 = { artist: res.artistName, title: cleanTitle, source: "iTunes", score: sc, dur: res.trackTimeMillis || 0 };
              if(sc < MIN_SCORE) continue;
              altsPush(picked, cand2);
              if(_betterCand(out, cand2)) out = cand2;
            }
          }
          if(out) out.alts = sortAlts(picked);
          _cachePut(_itCache, key, out); resolve(out);
        })
        .catch(function(){ _netErrors++; resolve(null); });
    }, wait);
  });
}

