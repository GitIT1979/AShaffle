/* ============================================================
   12. ПРОЧЕЕ
   ============================================================ */

/* Кнопки в списке файлов: править, сохранить, сбросить, убрать */
$("list").addEventListener("click", function(e){
  var b = e.target.closest ? e.target.closest("[data-act]") : null;
  if(!b) return;
  /* Слушать и менять вариант можно и во время проверки: это не меняет очередь */
  var act0=b.dataset.act;
  if((busy || verifying) && act0 !== "alt" && act0 !== "play"){
    stt("Дождитесь окончания проверки…");
    return;
  }
  var id=+b.dataset.id, act=b.dataset.act;
  var idx=files.findIndex(function(x){ return x.id===id; });
  if(idx<0) return;
  if(act==="edit"){ editingId=id; draw(); var f0=$("ed-artist"); if(f0) f0.focus(); return; }
  if(act==="play"){ togglePlay(id); return; }
  /* Смена варианта: одно и то же название у разных исполнителей */
  if(act==="alt"){
    var inf=files[idx].info, al=inf.alts||[];
    if(al.length<2){ stt("У этого трека только один вариант."); return; }
    var k=((inf.altIdx||0)+1)%al.length, c=al[k];
    inf.altIdx=k;
    inf.artist=c.artist; inf.title=c.title;
    inf.source=c.source||""; inf.score=c.score||0;
    if(inf.status==="none") inf.status="fixed";
    /* Выбор пользователя запоминаем навсегда */
    memSet(files[idx].name, inf.artist, inf.title);
    confirmed=false; resetResults();
    refreshRow(files[idx]); updateGoBtn();
    /* Подсветка — чтобы смена варианта была заметна */
    var rowEl=document.querySelector('#list .fi[data-id="'+id+'"]');
    if(rowEl){
      rowEl.classList.add("flash");
      setTimeout(function(){ try{ rowEl.classList.remove("flash"); }catch(e2){} }, 700);
    }
    var msgAlt="Вариант "+(k+1)+" из "+al.length+": "+c.artist+" — "+c.title+(c.source?" ("+c.source+")":"");
    /* Имена пересобираем только по команде пользователя */
    if(madeTrue && !busy && !verifying){
      madeTrue=false; results=[]; resetResults(); updateGoBtn();
      stt(msgAlt+". Нажмите 🪄, чтобы пересобрать имена.");
    } else {
      stt(msgAlt);
    }
    return;
  }
  if(act==="cancel"){ editingId=0; draw(); return; }
  if(act==="reset"){
    var p0=files[idx].parsed;
    /* Возврат к исходному имени отменяет и запомненную правку */
    memDel(files[idx].name);
    files[idx].info={ artist:p0.artist, title:p0.title, _raw:p0._raw, _glued:!!p0._glued, status:"raw", source:"" };
    madeTrue=false; confirmed=false;
    editingId=0; dirty=true; resetResults(); draw();
    stt("Возвращено имя из файла: "+files[idx].name);
    return;
  }
  if(act==="save"){
    var ae=$("ed-artist"), te=$("ed-title");
    var aVal=ae?ae.value.trim():"", tVal=te?te.value.trim():"";
    if(!tVal) tVal="unknown_track";
    files[idx].info.artist=foldMixed(aVal);
    files[idx].info.title=foldMixed(tVal);
    files[idx].info.status="manual";
    files[idx].info.alts=null; files[idx].info.altIdx=0;
    files[idx].info.source="";
    /* Ручная правка запоминается навсегда */
    memSet(files[idx].name, files[idx].info.artist, files[idx].info.title);
    madeTrue=false; confirmed=false;
    editingId=0; dirty=true; resetResults(); draw();
    stt("Название исправлено вручную.");
    return;
  }
  if(act==="rm"){
    if(editingId===id) editingId=0;
    if(playingId===id) stopPlayback();
    madeTrue=false; confirmed=false;
    files.splice(idx,1);
    resetResults();
    if(!files.length){ dirty=false; stt("Очищено"); }
    else { dirty=true; stt("Файлов: "+files.length+"."); }
    draw();
  }
});

$("add").addEventListener("click",function(){$("fi").click()});$("addDir").addEventListener("click",function(){$("fdir").click()});
$("fi").addEventListener("change",function(e){add(e.target.files, null);e.target.value=""});
$("fdir").addEventListener("change",function(e){
  var arr=[], pmap=[];
  for(var i=0;i<e.target.files.length;i++){
    arr.push(e.target.files[i]);
    pmap.push(e.target.files[i].webkitRelativePath||"");
  }
  add(arr, pmap); e.target.value="";
});
$("clr").addEventListener("click",function(){
  if(busy || verifying) return;
  files=[];results=[];dirty=false;editingId=0;madeTrue=false;confirmed=false;
  stopPlayback();
  draw();drawResults();$("results").classList.remove("show");phide();
  stt("Очищено"); updateGoBtn();
});
$("tt").addEventListener("click",function(){
  /* По кругу: как в системе → светлая → тёмная */
  var order=["system","light","dark"], cur=themeMode(), next=order[(order.indexOf(cur)+1)%3];
  theme(next);
  stt("Тема: "+(next==="system"?"как в системе":next==="dark"?"тёмная":"светлая"));
});

/* Строка проигрывания: ползунок, пауза, стоп */
(function(){
  var a=$("player"), s=$("pbs"), b=$("pbp"), x=$("pbx");
  if(!a) return;
  a.addEventListener("timeupdate", pbarUpdate);
  a.addEventListener("loadedmetadata", pbarUpdate);
  a.addEventListener("play", function(){ if(b) b.textContent="⏸"; });
  a.addEventListener("pause", function(){ if(b) b.textContent="▶"; });
  if(s){
    s.addEventListener("input", function(){
      s.dataset.seek = "1";
      var dur = a.duration || 0;
      if(dur) a.currentTime = (s.value / 1000) * dur;
      pbarUpdate();
    });
    s.addEventListener("change", function(){ delete s.dataset.seek; });
    s.addEventListener("pointerup", function(){ delete s.dataset.seek; });
    /* Жест перетаскивания прерван системой — ползунок снова следует за треком */
    s.addEventListener("pointercancel", function(){ delete s.dataset.seek; });
  }
  if(b) b.addEventListener("click", function(){
    if(a.paused){ var p=a.play(); if(p && p.catch) p.catch(function(){}); }
    else a.pause();
  });
  if(x) x.addEventListener("click", function(){
    var wasRes = playingRes;
    stopPlayback();
    if(wasRes >= 0) drawResults(); else draw();
  });
})();

function readDirRecursive(entry, path, out){
  return new Promise(function(resolve){
    if(entry.isFile){
      entry.file(function(file){ out.push({file:file, path:(path?path+"/":"")+file.name}); resolve(); }, function(){resolve()});
    } else if(entry.isDirectory){
      var reader=entry.createReader(); var allEntries=[];
      function readBatch(){
        reader.readEntries(function(batch){
          if(batch.length===0){
            var chain=Promise.resolve();
            allEntries.forEach(function(child){
              chain=chain.then(function(){ return readDirRecursive(child, (path?path+"/":"")+entry.name, out); });
            });
            chain.then(resolve);
          } else { allEntries=allEntries.concat(Array.prototype.slice.call(batch)); readBatch(); }
        }, function(){resolve()});
      }
      readBatch();
    } else { resolve(); }
  });
}
function handleDrop(e){
  e.preventDefault(); $("dz").classList.remove("over");
  if(busy) return;
  var items=e.dataTransfer.items;
  if(items && items.length && items[0].webkitGetAsEntry){
    var entries=[];
    for(var i=0;i<items.length;i++){ var en=items[i].webkitGetAsEntry(); if(en) entries.push(en); }
    var collected=[]; var chain=Promise.resolve();
    entries.forEach(function(en){ chain=chain.then(function(){ return readDirRecursive(en, "", collected); }); });
    chain.then(function(){ add(collected.map(function(x){return x.file}), collected.map(function(x){return x.path})); });
  } else { add(e.dataTransfer.files, null); }
}
var dz=$("dz");
["dragenter","dragover"].forEach(function(e){dz.addEventListener(e,function(x){x.preventDefault();dz.classList.add("over")})});
["dragleave","drop"].forEach(function(e){dz.addEventListener(e,function(x){x.preventDefault();dz.classList.remove("over")})});
dz.addEventListener("drop", handleDrop);
dz.addEventListener("click",function(){$("fi").click()});

if(!CAN_PICK_DIR){
  $("fsHint").style.display = "block";
  $("dlAll").textContent = CAN_PICK_FILE ? "💾 Сохранить все (ZIP)" : "💾 Скачать все (ZIP)";
  $("dlAll").title = "Выбор папки напрямую недоступен — результат сохранится в ZIP.";
} else {
  $("dlAll").title = "Сохранить файлы в выбранную папку";
}

theme(themeMode());
if(_sysTheme && _sysTheme.addEventListener){
  /* Смена темы в ОС при режиме «как в системе» */
  _sysTheme.addEventListener("change", function(){ if(themeMode()==="system") applyTheme("system"); });
}
draw();stt("Готов к работе");
