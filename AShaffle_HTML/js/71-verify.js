/* Проходит по списку по одному файлу и отмечает статус каждого названия. */
function verifyQueue(todo){
  pshow("Проверка названий через интернет…");
  var st={changed:0, confirmed:0, missing:0, cancelled:false, stopped:false};
  var i=0, netStreak=0, failedNow=[];
  function step(){
    if(cancelVerify){ st.cancelled=true; return Promise.resolve(st); }
    if(i>=todo.length) return Promise.resolve(st);
    var f=todo[i], netAt=_netErrors;
    /* Пометка версии из самого файла: тот же допуск, что внутри lookupTrack */
    var wide = versionWide(f.info.artist, f.info.title);
    markProcessing(f);
    pup(i, todo.length, "Проверяю "+(i+1)+" из "+todo.length+": "+f.name);
    /* Правка пользователя запомнена — в интернет не идём */
    var mem = memGet(f.name);
    if(mem && (mem.artist || mem.title)){
      f.info.artist = mem.artist || f.info.artist;
      f.info.title  = mem.title  || f.info.title;
      f.info.source = "память";
      f.info.score  = 1;
      f.info.status = "manual";
      f.info.alts = null; f.info.altIdx = 0;
      i++;
      refreshRow(f);
      return step();
    }
    return lookupTrack(f.info, f.duration).then(function(found){
      if(found) return found;
      /* Если в имени три и более части, пробуем прочитать его с конца */
      var alt = altParse(f.name);
      if(!alt) return null;
      return lookupTrack(alt, f.duration).then(function(f2){
        if(f2) f2.alt = true;
        return f2;
      });
    }).then(function(found){
      /* Латиницу пробуем заменить кириллическим написанием того же трека */
      return preferCyrillic(found, f.duration, f.info.artist, wide);
    }).then(function(found){
      /* Исполнитель уже русский, а название ещё латиницей */
      return preferCyrillicTitle(found, f.duration, f.info.artist, wide);
    }).then(function(found){
      /* Полный кредит: «G-Eazy & Halsey» вместо «G-Eazy» */
      return completeCredit(found, f.info, f.duration, wide);
    }).then(function(found){
      if(found){
        /* Если имя отличается только регистром, оставляем написание из файла */
        var foundTitle = stripNoiseBrackets(stripSiteJunk(found.title || ""));
        var sameArtist = norm(found.artist) === norm(f.info.artist);
        var sameTitle  = norm(foundTitle)  === norm(f.info.title);
        var same = sameArtist && sameTitle;
        /* Фит из исходного имени не теряем, если база подтвердила основного исполнителя */
        var srcArtist = f.info.artist || "";
        var featMatch = srcArtist.match(/^(.+?)\s+(?:feat\.?|ft\.?)\s+(.+)$/i);
        var keepFeat = false;
        if(featMatch && isGoodMatchFlex(featMatch[1], found.artist || "", "")) keepFeat = true;
        /* Если найденный исполнитель — часть исходного («Sean Paul» внутри «Imanbek & Sean Paul»), оставляем исходный.
           Но «лишним» должен быть настоящий исполнитель, а не артикль «the» */
        var srcTok = unique(tokens(srcArtist));
        var fndTok = unique(tokens(found.artist || ""));
        var subset = fndTok.length > 0 && fndTok.every(function(w){
          return srcTok.some(function(x){ return x === w || tokenNear(w, x); });
        });
        var extraTok = srcTok.filter(function(w){
          return !fndTok.some(function(x){ return x === w || tokenNear(w, x); });
        });
        var extraMeaningful = extraTok.some(function(w){ return w.length > 2 && !MODIFIERS[w]; });
        /* Сохраняем кредит файла только если это явный совместный кредит
           («feat», «&», «and»), а не искажённая граница слов */
        var creditMark = /(?:^|\s)(feat\.?|ft\.?|&|and|with|vs\.?|и|с)(?:\s|$)/i.test(srcArtist);
        if(subset && fndTok.length < srcTok.length && extraMeaningful && creditMark) keepFeat = true;
        /* Строчное имя в файле — мусорная запись, а не кредит: берём написание каталога */
        var srcAllLower = !!srcArtist && srcArtist === srcArtist.toLowerCase() && srcArtist !== srcArtist.toUpperCase();
        if(srcAllLower) keepFeat = false;
        /* Обрубок вроде «Var» — не участник кредита, а мусор: не сохраняем его */
        var srcTrim = dropJunkPrefix(srcArtist);
        if(srcTrim && norm(srcTrim) === norm(found.artist)) keepFeat = false;
        /* Если в файле всё строчными ("kesha"), берём написание базы */
        var srcTitle = f.info.title || "";
        var lowerArtist = !!srcArtist && srcArtist === srcArtist.toLowerCase() && srcArtist !== srcArtist.toUpperCase();
        var lowerTitle  = !!srcTitle  && srcTitle  === srcTitle.toLowerCase()  && srcTitle  !== srcTitle.toUpperCase();
        f.info.artist = keepFeat ? srcArtist : ((sameArtist && srcArtist && !lowerArtist) ? srcArtist : (found.artist || srcArtist));
        /* Склеенное имя из файла («A-b-c») и кредит каталога «A & B» приводим к «A Feat. B» */
        if(!keepFeat && f.info._glued) f.info.artist = featCredit(f.info.artist);
        f.info.artist = keepArticle(f.info.artist, srcArtist);
        /* На выходе латинских двойников быть не должно */
        f.info.artist = foldMixed(f.info.artist);
        /* Словарь важнее каталога: Alyans -> Альянс */
        var dictArtist = aliasFor(f.info.artist);
        if(dictArtist && /[а-яё]/i.test(dictArtist)) f.info.artist = dictArtist;
        var finalTitle = (sameTitle && srcTitle && !lowerTitle) ? srcTitle : (foundTitle || srcTitle);
        /* Версия записи из исходной фразы не теряется: «(Get Better Radio Remix)» */
        var vtail = versionTail(found, { artist: srcArtist, title: srcTitle });
        if(vtail && norm(finalTitle).indexOf(norm(vtail)) < 0) finalTitle = finalTitle + " (" + capWords(vtail) + ")";
        f.info.title = foldMixed(finalTitle);
        f.info.source = found.source || "";
        f.info.score  = found.score || 0;
        f.info.status = same ? "ok" : "fixed";
        f.info.alt = !!found.alt;
        /* Все подходящие варианты: лучший уже выбран, остальные — на случай ошибки */
        f.info.alts = altsFor({ artist:f.info.artist, title:f.info.title, source:f.info.source, score:f.info.score }, found.alts, f.duration);
        f.info.altIdx = 0;
        if(same) st.confirmed++; else st.changed++;
      } else {
        f.info.status="none";
        st.missing++;
        failedNow.push(f);
      }
      i++;
      refreshRow(f);
      if(i%5===0) updateGoBtn();
      netStreak = (!found && _netErrors>netAt) ? netStreak+1 : 0;
      if(netStreak>=3){ st.stopped=true; return st; }
      return step();
    });
  }
  return step().then(function(r){
    phide();
    markProcessing(null);
    /* сеть легла — это не «не найдено», файлы остаются непроверенными */
    if(r.stopped){
      failedNow.forEach(function(f){ f.info.status="raw"; f.info.source=""; });
      r.missing=0;
    }
    return r;
  });
}

