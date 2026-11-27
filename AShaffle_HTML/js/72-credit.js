/* Каталог часто знает только главного исполнителя: «G-Eazy» вместо «G-Eazy & Halsey».
   Если в файле участников больше — ищем полный кредит в том же треке */
function creditGaps(candArtist, srcArtist){
  var src = unique(tokens(foldMixed(srcArtist||"")));
  var got = unique(tokens(foldMixed(candArtist||"")));
  return src.filter(function(w){
    if(w.length < 3 || MODIFIERS[w] || w === "feat" || w === "ft") return false;
    return !got.some(function(x){ return x === w || tokenNear(w, x); });
  });
}
function betterCredit(found, cand, srcArtist){
  if(!cand || !cand.artist || !cand.title) return null;
  if(creditKey("", cand.title) !== creditKey("", found.title)) return null;
  if(creditGaps(cand.artist, srcArtist).length >= creditGaps(found.artist, srcArtist).length) return null;
  if(cand.alts) cand.alts = mergeAlts(cand.alts, found.alts);
  return cand;
}
function completeCredit(found, info, dur, wide){
  if(!found || !found.artist) return Promise.resolve(found);
  if(!creditGaps(found.artist, info.artist).length) return Promise.resolve(found);
  var term = (foldMixed(info.artist||"") + " " + foldMixed(info.title||""))
               .replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if(!term) return Promise.resolve(found);
  return lookupITunes(term, dur, 0, wide).then(function(it){
    var pick = betterCredit(found, it, info.artist);
    if(pick) return pick;
    return lookupDeezer(term, dur, 0, wide).then(function(dz){
      var p2 = betterCredit(found, dz, info.artist);
      if(p2) return p2;
      /* Второй заход — по чистому «исполнитель + название»: полный кредит
         в каталоге часто записан именно так */
      var clean = ((found.artist || "") + " " + (found.title || "")).trim();
      if(!clean || clean.toLowerCase() === term.toLowerCase()) return found;
      return lookupITunes(clean, dur, 0, wide).then(function(it2){
        var p3 = betterCredit(found, it2, info.artist);
        if(p3) return p3;
        return lookupDeezer(clean, dur, 0, wide).then(function(dz2){
          return betterCredit(found, dz2, info.artist) || found;
        });
      });
    });
  }).catch(function(){ return found; });
}

/* Если найденный исполнитель записан латиницей, ищем тот же трек кириллицей */
function preferCyrillic(found, dur, sourceArtist, wide){
  if(!found || !found.artist) return Promise.resolve(found);
  var artist = found.artist;
  if(!/[A-Za-z]/.test(artist) || /[А-Яа-яЁё]/.test(artist)) return Promise.resolve(found);
  /* Только для русских треков: иначе гоняли бы лишние запросы по английским */
  if(!/[А-Яа-яЁё]/.test((found.title || "") + " " + (sourceArtist || ""))) return Promise.resolve(found);
  /* Словарь знает написание лучше транслита: Alyans → Альянс */
  var dictName = aliasFor(artist);
  if(dictName && /[а-яё]/i.test(dictName)){
    var swapped = { artist: dictName, title: found.title, source: found.source, score: found.score };
    if(found.alts) swapped.alts = found.alts;
    return Promise.resolve(swapped);
  }
  var guess = untranslit(artist);
  if(!/[а-яё]/.test(guess)) return Promise.resolve(found);
  var term = (guess + " " + (found.title || "")).trim();
  return lookupDeezer(term, dur, 0, wide).then(function(alt){
    if(alt && alt.artist && /[А-Яа-яЁё]/.test(alt.artist)){ alt.alts = mergeAlts(alt.alts, found.alts); return alt; }
    return lookupITunes(term, dur, 0, wide).then(function(alt2){
      if(alt2 && alt2.artist && /[А-Яа-яЁё]/.test(alt2.artist)){ alt2.alts = mergeAlts(alt2.alts, found.alts); return alt2; }
      return found;
    });
  }).catch(function(){ return found; });
}

/* Название записано латиницей, а трек русский — ищем кириллическое написание */
function preferCyrillicTitle(found, dur, sourceArtist, wide){
  if(!found || !found.title) return Promise.resolve(found);
  var title = found.title, artist = found.artist || "";
  if(/[А-Яа-яЁё]/.test(title)) return Promise.resolve(found);
  /* Только если есть признак русского трека: кириллица в исполнителе */
  if(!/[А-Яа-яЁё]/.test(artist + " " + (sourceArtist || ""))) return Promise.resolve(found);
  var cyrTitle = untranslit(title);
  if(!cyrTitle || !/[а-яё]{3}/.test(cyrTitle)) return Promise.resolve(found);
  var cyrArtist = /[А-Яа-яЁё]/.test(artist) ? artist : untranslit(artist);
  if(!cyrArtist || !/[а-яё]/.test(cyrArtist)) return Promise.resolve(found);
  /* Название должно быть тем же словом, только кириллицей */
  function sameTitle(c){
    return !!c && !!c.title && /[А-Яа-яЁё]/.test(c.title) && isGoodMatchLoose(title, "", translit(c.title));
  }
  function cyrArtistOk(c){ return !!c && !!c.artist && /[А-Яа-яЁё]/.test(c.artist); }
  var term = (cyrArtist + " " + cyrTitle).trim();
  return lookupDeezer(term, dur, true, wide).then(function(alt){
    if(alt && cyrArtistOk(alt) && sameTitle(alt)){
      alt.alts = mergeAlts(alt.alts, found.alts);
      return alt;
    }
    return lookupITunes(term, dur, true, wide).then(function(alt2){
      if(alt2 && cyrArtistOk(alt2) && sameTitle(alt2)){
        alt2.alts = mergeAlts(alt2.alts, found.alts);
        return alt2;
      }
      return found;
    });
  }).catch(function(){ return found; });
}

