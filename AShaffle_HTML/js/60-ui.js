/* ============================================================
   7. UI
   ============================================================ */
/* Подсветка строки, которую обрабатываем прямо сейчас */
function markProcessing(f){
  var L=$("list"); if(!L || !L.querySelector) return;
  var prev=L.querySelector(".fi.processing");
  if(prev) prev.classList.remove("processing");
  if(!f) return;
  var el=L.querySelector('.fi[data-id="'+f.id+'"]');
  if(el){
    el.classList.add("processing");
    if(el.scrollIntoView) el.scrollIntoView({ block:"nearest" });
  }
}
function stt(m){
  var el=$("st"); if(!el) return;
  el.textContent=m;
  el.classList.add("show");
  if(stt._t) clearTimeout(stt._t);
  stt._t = setTimeout(function(){ el.classList.remove("show"); }, 3200);
}
function pshow(l){$("pw").classList.add("show");$("pl").textContent=l||"Обработка…";$("pp").textContent="0%";$("pf").style.width="0%"}function pup(d,t,l){var p=t>0?Math.round(d/t*100):0;$("pf").style.width=p+"%";$("pp").textContent=p+"%";$("pl").textContent=l||("Обработано "+d+" из "+t)}
function phide(){$("pw").classList.remove("show")}

function updateGoBtn(){
  var mt=$("makeTrue"), ok=$("confirm"), go=$("go");
  var fc=$("filesCard"), acts=$("actions"), rc=$("results"), dz=$("dz");
  var has = files.length > 0;
  if(fc){ fc.style.display = confirmed ? "none" : "block"; fc.classList.remove("anim-out"); }
  if(acts){ acts.style.display = confirmed ? "none" : "flex"; acts.classList.remove("anim-out"); }
  if(dz){ dz.style.display = confirmed ? "none" : "block"; dz.classList.remove("anim-out"); }
  if(rc){ if(confirmed && results.length) rc.classList.add("show"); else rc.classList.remove("show"); }

  if(busy){
    mt.style.display="none"; if(ok) ok.style.display="none";
    go.style.display = confirmed ? "block" : "none"; go.disabled=true; go.textContent="⏳ Обработка…";
  } else if(verifying){
    go.style.display="none"; if(ok) ok.style.display="none";
    mt.style.display=has?"block":"none"; mt.disabled=false; mt.textContent="■ Остановить";
  } else if(confirmed){
    mt.style.display="none"; if(ok) ok.style.display="none";
    go.style.display="block"; go.disabled=false; go.textContent="🎲 Ashuffle this!";
  } else {
    go.style.display="none";
    mt.style.display=has?"block":"none"; mt.disabled=!has; mt.textContent="🪄 Make this true!";
    if(ok) ok.style.display=(has && madeTrue)?"block":"none";
  }
}

function needsCheck(f){ return f.info.status==="raw"; }
function needsRetry(f){ return f.info.status==="raw" || f.info.status==="none"; }
function summaryText(){
  if(!files.length) return "";
  var c={raw:0,ok:0,fixed:0,none:0,manual:0};
  files.forEach(function(f){ var s=f.info.status||"raw"; c[s]=(c[s]||0)+1; });
  var p=[];
  if(c.fixed)  p.push("исправлено "+c.fixed);
  if(c.manual) p.push("вручную "+c.manual);
  if(c.ok)     p.push("подтверждено "+c.ok);
  if(c.none)   p.push("не найдено "+c.none);
  if(c.raw)    p.push("не проверено "+c.raw);
  return p.join(" · ");
}
function statusBadge(info){
  var pct = (typeof info.score === "number" && info.score > 0) ? " · " + Math.round(info.score * 100) + "%" : "";
  if(info.status==="ok")     return '<span class="bd ok" title="Подтверждено: '+esc(info.source||"интернет")+'">✓ подтверждено'+pct+'</span>';
  if(info.status==="fixed")  return '<span class="bd fx" title="Исправлено по данным '+esc(info.source||"интернета")+'">✎ '+esc(info.source||"исправлено")+pct+'</span>';
  if(info.status==="manual") return info.source === "память"
    ? '<span class="bd mn" title="Взято из ваших прошлых правок — интернет не нужен">✎ память</span>'
    : '<span class="bd mn" title="Введено вручную">✎ вручную</span>';
  return "";
}
function folderOf(p){
  if(!p) return "";
  var parts = String(p).split("/");
  return parts.length > 1 ? parts[parts.length - 2] : "";
}
function altTip(info){
  var l = info.alts || [];
  var s = "Есть варианты — нажмите, чтобы сменить:\n";
  l.forEach(function(c, k){ s += (k+1) + ") " + c.artist + " — " + c.title + (c.source ? " (" + c.source + ")" : "") + "\n"; });
  return s.replace(/\n$/, "");
}
function rowHtml(f,i){
  var info=f.info, e=ext(f.name).toUpperCase();
  var idx=String(i+1).padStart(3,"0")+".";
  if(f.id===editingId){
    return '<div class="fi" data-id="'+f.id+'">'+
      '<span class="n">'+idx+'</span>'+
      '<div class="fmain">'+
        '<div class="top">'+
          '<input class="ed a" id="ed-artist" value="'+esc(info.artist||"")+'" placeholder="Исполнитель">'+
          '<input class="ed t" id="ed-title" value="'+esc(info.title||"")+'" placeholder="Название">'+
        '</div>'+
        '<div class="bot">'+
          '<button class="btn sm" data-act="save" data-id="'+f.id+'" type="button">✓ Сохранить</button>'+
          '<button class="btn sm" data-act="reset" data-id="'+f.id+'" type="button">↺ из имени</button>'+
          '<button class="btn sm" data-act="cancel" data-id="'+f.id+'" type="button">Отмена</button>'+
        '</div>'+
      '</div></div>';
  }
  var label=(info.artist?info.artist+" — ":"")+(info.title||"unknown_track");
  var dir = _multiDir ? folderOf(f.path) : "";
  return '<div class="fi'+(playingId===f.id?' playing':'')+'" data-id="'+f.id+'">'+
    '<span class="n">'+idx+'</span>'+
    '<div class="fmain">'+
      '<div class="top">'+
        '<span class="nm" title="'+esc(f.path || f.name)+'">'+esc(f.name)+'</span>'+
        '<span class="ex">'+e+'</span>'+
        '<button class="ic" data-act="edit" data-id="'+f.id+'" type="button" title="Исправить исполнителя и название">✎</button>'+
        '<button class="ic rm" data-act="rm" data-id="'+f.id+'" type="button" title="Убрать из списка">✕</button>'+
        '<button class="ic" data-act="play" data-id="'+f.id+'" type="button" title="Прослушать">'+(playingId===f.id?'⏸':'▶')+'</button>'+
      '</div>'+
      '<div class="bot"><span class="ar">'+esc(label)+'</span>'+statusBadge(info)+
        (info.alts && info.alts.length > 1 ? '<button class="bd alt" data-act="alt" data-id="'+f.id+'" type="button" title="'+esc(altTip(info))+'" >⇄ '+((info.altIdx||0)+1)+'/'+info.alts.length+'</button>' : '')+
        (info.fromTags && info.status==="raw" ? '<span class="bd tg" title="Исполнитель и название взяты из тега файла">тег</span>' : '')+
        (info.status==="none" ? '<button class="bd nn" data-act="edit" data-id="'+f.id+'" type="button" title="Ничего не нашлось — исправьте вручную">✎ исправить</button>' : '')+
        (isUnknownInfo(info) ? '<span class="bd tg" title="В файле нет ни исполнителя, ни названия — имя не выдумываем, осталось исходное. Узнать можно только на слух.">нет данных</span>' : '')+
        (info.alt ? '<span class="bd" title="Имя прочитано с конца: исполнитель был последней частью">↔</span>' : '')+
        (dir ? '<span class="dir" title="'+esc(f.path)+'">'+esc(dir)+'</span>' : '')+
        (f.duration ? '<span class="dur">'+fmtDur(f.duration)+'</span>' : '')+
      '</div>'+
    '</div></div>';
}

/* Строка проигрывания с ползунком */
var playingRes = -1;
function pbarUpdate(){
  var a=$("player"), s=$("pbs"), t=$("pbt");
  if(!a || !s) return;
  var dur = a.duration || 0;
  if(dur > 0 && !s.dataset.seek){
    s.value = Math.round((a.currentTime / dur) * 1000);
  }
  if(t) t.textContent = fmtDur(a.currentTime||0) + (dur ? " / " + fmtDur(dur) : "");
}
function pbarShow(name){
  var b=$("pbar"); if(!b) return;
  $("pbn").textContent = name || "—";
  b.classList.add("show");
  document.body.classList.add("has-pbar");
  var a=$("player");
  if($("pbp")) $("pbp").textContent = (a && !a.paused) ? "⏸" : "▶";
  pbarUpdate();
}
function pbarHide(){
  var b=$("pbar"); if(!b) return;
  b.classList.remove("show");
  document.body.classList.remove("has-pbar");
}
function stopPlayback(){
  var a=$("player");
  if(a){ try{ a.pause(); a.removeAttribute("src"); a.load(); }catch(e){} }
  if(playingUrl){ try{ URL.revokeObjectURL(playingUrl); }catch(e){} }
  playingUrl=""; playingId=0; playingRes=-1;
  pbarHide();
}
/* Прослушивание в списке готовых файлов */
function togglePlayRes(i){
  var a=$("player");
  if(!a) return;
  var r=results[i];
  if(!r) return;
  if(playingRes===i){ stopPlayback(); drawResults(); return; }
  stopPlayback();
  playingUrl=URL.createObjectURL(r.file);
  playingRes=i;
  a.src=playingUrl;
  a.onended=function(){ stopPlayback(); drawResults(); };
  var p=a.play();
  if(p && p.catch) p.catch(function(){ stopPlayback(); drawResults(); });
  pbarShow(r.name);
  drawResults();
}
function togglePlay(id){
  var f=null;
  for(var i=0;i<files.length;i++) if(files[i].id===id){ f=files[i]; break; }
  if(!f) return;
  if(playingId===id){ stopPlayback(); draw(); return; }
  stopPlayback();
  var a=$("player");
  if(!a) return;
  playingUrl=URL.createObjectURL(f.file);
  playingId=id;
  a.src=playingUrl;
  a.onended=function(){ stopPlayback(); draw(); };
  var p=a.play();
  if(p && p.catch) p.catch(function(){ stt("Не удалось воспроизвести этот файл."); stopPlayback(); draw(); });
  pbarShow(f.info && (f.info.artist || f.info.title) ? ((f.info.artist ? f.info.artist + " — " : "") + (f.info.title || "")) : f.name);
  draw();
}

function draw(){
  var L=$("list");
  var dirs={};
  files.forEach(function(f){ var d=folderOf(f.path); if(d) dirs[d]=1; });
  _multiDir = Object.keys(dirs).length > 1;
  L.innerHTML = files.map(function(f,i){ return rowHtml(f,i); }).join("");
  $("cnt").textContent=files.length;
  updateGoBtn();
}
function refreshRow(f){
  var i=files.indexOf(f); if(i<0) return;
  var L=$("list"); if(!L || !L.querySelector) return;
  var el=L.querySelector('[data-id="'+f.id+'"]'); if(!el) return;
  var tmp=document.createElement("div");
  tmp.innerHTML=rowHtml(f,i).trim();
  if(tmp.firstChild) el.parentNode.replaceChild(tmp.firstChild, el);
}
function resetResults(){
  results=[];
  $("results").classList.remove("show");
  drawResults();
}

function drawResults(){
  var L=$("resList");L.innerHTML="";
  results.forEach(function(r,i){
    var tag=(r.isMp3 && r.trackNum)?('<span class="sz">TRCK='+r.trackNum+'</span>'):'<span class="sz">—</span>';
    var src=r.source?(' <span class="sz" style="font-size:10px;opacity:.7">'+esc(r.source)+'</span>'):'';
    var d=document.createElement("div");d.className="res-item";
    d.innerHTML='<span class="n">'+String(i+1).padStart(3,"0")+'.</span><span class="nm" title="'+esc(r.name)+'">'+esc(r.name)+'</span>'+src+'<span class="ar">'+esc(r.artist||"—")+'</span>'+tag+'<span class="sz">'+fmtSize(r.size)+'</span><button class="btn sm" data-i="'+i+'" type="button">💾</button><button class="ic" data-play="'+i+'" type="button" title="Прослушать">'+(playingRes===i?'⏸':'▶')+'</button>';
    L.appendChild(d);
  });
  $("rcnt").textContent=results.length;
  Array.prototype.forEach.call(L.querySelectorAll("button[data-i]"),function(b){
    b.addEventListener("click",function(e){
      var r=results[+e.target.dataset.i];
      download(r.file, r.name);
      stt("Скачан: "+r.name);
    });
  });
  Array.prototype.forEach.call(L.querySelectorAll("button[data-play]"),function(b){
    b.addEventListener("click",function(e){ e.stopPropagation(); togglePlayRes(+e.target.dataset.play); });
  });
}

