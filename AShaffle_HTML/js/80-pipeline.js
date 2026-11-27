/* Шаг 1: вернуть трекам имена, сохранив исходный порядок */
function makeTrue(){
  if(!files.length || busy || verifying) return;
  busy=true; updateGoBtn(); phide(); resetResults();
  var todo=files.filter(needsRetry);
  var prep;
  if(todo.length){
    verifying=true; cancelVerify=false; updateGoBtn();
    prep=verifyQueue(todo).then(function(st){ verifying=false; return st; });
  } else {
    prep=Promise.resolve(null);
  }
  prep.then(function(st){
    if(st && st.stopped){ busy=false; draw(); return; }
    if(st && st.cancelled){ busy=false; draw(); stt("Обработка отменена."); return; }
    startRename();
  }).catch(function(err){
    console.error(err);
    busy=false; verifying=false; phide(); updateGoBtn();
    stt("Ошибка при обработке: "+(err&&err.message?err.message:err));
  });
}

/* Единый генератор неповторяющихся имён: свой реестр на каждый вызов обработки. */
function makeUniqueNamer(){
  var used = {};
  return function(name){
    if(!Object.prototype.hasOwnProperty.call(used, name)){
      used[name]=1; return name;
    }
    var m=name.match(/^(.*?)(\.[^.]+)?$/), base=m[1], ext2=m[2]||"";
    var k=2, cand;
    do{ cand=base+" ("+k+")"+ext2; k++; }
    while(Object.prototype.hasOwnProperty.call(used, cand));
    used[cand]=1;
    return cand;
  };
}

function startRename(opts){
  opts = opts || {};
  phide(); pshow("Возвращаю имена…");
  results=[];
  var j=0, failed=0;
  var uniqueName = makeUniqueNamer();
  function nextFile(){
    if(j>=files.length){
      phide(); drawResults();
      madeTrue=true;
      markProcessing(null);
      if(!opts.quiet) stt("Готово: "+results.length+" файлов в прежнем порядке."+(failed?" С ошибкой чтения: "+failed+".":""));
      busy=false; updateGoBtn();
      if(typeof opts.done === "function") opts.done();
      return;
    }
    var f=files[j], num=j+1;
    var isMp3=ext(f.name)==="mp3";
    var extPart=(f.name.match(/\.[^.]+$/) || [""])[0];
    markProcessing(f);
    pup(j, files.length, "Возвращаю имя "+(j+1)+" из "+files.length+": "+f.name);
    var finalName=uniqueName(isUnknownInfo(f.info) ? f.name : makeName(f.info, extPart, null));

    makeRenamedFile(f.file, finalName, null, f.info.artist, f.info.title)
      .catch(function(err){
        console.error("Rename failed:", f.name, err);
        failed++;
        try { return new File([f.file], finalName, { type: f.file.type || "audio/mpeg" }); }
        catch(e){ return f.file; }
      })
      .then(function(blob){
        results.push({
          file: blob,
          name: finalName,
          fid: f.id,
          artist: f.info.artist || "unknown_artist",
          source: f.info.source || "",
          size: blob.size,
          isMp3: isMp3,
          trackNum: 0
        });
        pup(j+1, files.length);
        j++; setTimeout(nextFile, 0);      });
  }
  nextFile();
}

/* Переход к списку результатов: рабочий список и кнопки скрываются с эффектом */
function confirmResults(){
  if(!madeTrue || confirmed || busy || verifying || !results.length) return;
  /* Музыка не прерывается: переносим метку на строку результата */
  if(playingId){
    /* Метка переносится по id файла: порядок results не обязан совпадать с files */
    for(var pi=0; pi<results.length; pi++){
      if(results[pi].fid === playingId){ playingRes = pi; break; }
    }
    drawResults();
  }
  var fc=$("filesCard"), acts=$("actions"), dz=$("dz");
  if(fc) fc.classList.add("anim-out");
  if(acts) acts.classList.add("anim-out");
  if(dz) dz.classList.add("anim-out");
  setTimeout(function(){
    confirmed=true;
    if(fc) fc.classList.remove("anim-out");
    if(acts) acts.classList.remove("anim-out");
    if(dz) dz.classList.remove("anim-out");
    updateGoBtn();
    var rc=$("results");
    if(rc){
      rc.classList.add("anim-in");
      setTimeout(function(){ rc.classList.remove("anim-in"); }, 420);
    }
  }, 220);
}

function runAshuffle(){
  if(!files.length || busy || verifying || !madeTrue) return;
  busy=true; updateGoBtn(); phide();
  resetResults();
  var useNumbered=true;
  var todo = files.filter(needsCheck);
  var prep;
  if(todo.length){
    verifying=true; cancelVerify=false; updateGoBtn();
    prep=verifyQueue(todo).then(function(st){ verifying=false; return st; });
  } else {
    prep=Promise.resolve(null);
  }
  prep.then(function(st){
    if(st && st.stopped){ busy=false; draw(); return; }
    if(st && st.cancelled){ busy=false; draw(); stt("Перемешивание отменено на проверке названий."); return; }
    startShuffle(useNumbered);
  }).catch(function(err){
    console.error(err);
    busy=false; verifying=false; phide(); updateGoBtn();
    stt("Ошибка при обработке: "+(err&&err.message?err.message:err));
  });
}

function startShuffle(useNumbered){
  var raw=files.filter(function(f){ return f.info.status==="raw"; });
  if(raw.length){
    busy=false; updateGoBtn();
    stt("Сначала нужно проверить названия: осталось "+raw.length+" файлов.");
    return;
  }
  var groups={};
  files.forEach(function(f){
    var key=norm(f.info.artist || "unknown_artist");
    (groups[key]=groups[key]||[]).push(f);
  });
  var ordered=inter(groups);

  phide(); pshow("Обработка файлов…");
  results=[];
  var j=0, failed=0;
  var uniqueName = makeUniqueNamer();
  function nextFile(){
    if(j>=ordered.length){
      phide();
      /* После перемешивания порядок другой — метка проигрывания больше не действительна */
      playingRes = -1;
      drawResults();
      markProcessing(null);
      $("results").classList.add("show");
      stt("Готово: "+results.length+" файлов."+(failed?" С ошибкой чтения: "+failed+".":""));
      busy=false; dirty=false; updateGoBtn();
      return;
    }
    var f=ordered[j], num=j+1;
    var isMp3=ext(f.name)==="mp3";
    var extPart=(f.name.match(/\.[^.]+$/) || [""])[0];
    markProcessing(f);
    pup(j, ordered.length, "Перемешиваю "+(j+1)+" из "+ordered.length+": "+f.name);
    var baseName=isUnknownInfo(f.info) ? f.name : makeName(f.info, extPart, null);
    /* У имени без данных свой номер уже может быть — второй не добавляем */
    if(useNumbered && isUnknownInfo(f.info)) baseName = baseName.replace(/^\d{1,3}\s*[-.]\s*/, "");
    var finalName=uniqueName(useNumbered ? (pad3(num)+" - "+baseName) : baseName);

    makeRenamedFile(f.file, finalName, num, f.info.artist, f.info.title)
      .catch(function(err){
        console.error("Rename failed:", f.name, err);
        failed++;
        try { return new File([f.file], finalName, { type: f.file.type || "audio/mpeg" }); }
        catch(e){ return f.file; }
      })
      .then(function(blob){
        results.push({
          file: blob,
          name: finalName,
          fid: f.id,
          artist: f.info.artist || "unknown_artist",
          source: f.info.source || "",
          size: blob.size,
          isMp3: isMp3,
          trackNum: num
        });
        pup(j+1, ordered.length);
        j++; setTimeout(nextFile, 0);
      });
  }
  nextFile();
}

$("go").addEventListener("click", runAshuffle);
$("confirm").addEventListener("click", confirmResults);
$("makeTrue").addEventListener("click", function(){
  if(verifying){ cancelVerify=true; stt("Останавливаю после текущего файла…"); return; }
  makeTrue();
});

/* ============================================================
   9. ДОБАВЛЕНИЕ
   ============================================================ */
function fileKey(name, size, path){
  return name + "|" + (size || 0) + "|" + (path || "");
}
function add(input, pathMap){
  if(busy || verifying) return;
  var added=0, dups=0, notAudio=0, ex={};
  files.forEach(function(f){ ex[fileKey(f.name, f.file.size, f.path)]=1; });
  for(var i=0;i<input.length;i++){
    var f=input[i], e=ext(f.name);
    if(!e||!EX[e]){ notAudio++; continue; }
    var p=pathMap && pathMap[i] ? pathMap[i] : (f.webkitRelativePath||"");
    var k=fileKey(f.name, f.size, p);
    if(ex[k]){ dups++; continue; }
    ex[k]=1;
    var parsed=parseTrackInfo(f.name);
    var entry={
      id: nextId++,
      name: f.name,
      file: f,
      path: p,
      duration: 0,
      parsed: parsed,
      info: { artist: parsed.artist, title: parsed.title, _raw: parsed._raw, _glued: !!parsed._glued, status: "raw", source: "" }
    };
    files.push(entry);
    inspectEntry(entry);
    added++;
  }
  var skipped=[];
  if(dups) skipped.push("повторов: "+dups);
  if(notAudio) skipped.push("не аудио: "+notAudio);
  var tail = skipped.length ? " Пропущено — "+skipped.join(", ")+"." : "";
  if(added===0){ draw(); stt("Ничего не добавлено."+tail); return; }
  editingId=0;
  madeTrue=false; confirmed=false;
  results=[];$("results").classList.remove("show");drawResults();draw();
  dirty=true; updateGoBtn();
  stt("Добавлено: "+added+". Всего: "+files.length+"."+tail+" Нажмите «Ashuffle this!»");
}

