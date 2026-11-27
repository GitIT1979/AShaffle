"use strict";
/* ============================================================
   4. ИМЯ ФАЙЛА С НОМЕРОМ (001, 002, ...)
   ============================================================ */
function pad3(n){ return String(n).padStart(3, "0"); }
var _WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
function safeNamePart(s){
  return String(s)
    .replace(/[\x00-\x1f\x7f]/g, "")     /* управляющие символы */
    .replace(/[\\/:*?"<>|]/g, "_")       /* запрещены в Windows */
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")     /* точки и пробелы по краям ломают Windows */
    .trim();
}
function cutTo(s, n){
  if(s.length <= n) return s;
  s = s.slice(0, n).replace(/[\s.,;:\-–—]+$/g, "");
  return s;
}
function makeName(info, originalExt, trackNum){
  var artist = info && info.artist ? foldMixed(String(info.artist).trim()) : "";
  var title  = info && info.title  ? foldMixed(String(info.title).trim())  : "unknown_track";
  if(!artist || !/[a-zA-Zа-яА-ЯёЁ]/.test(artist)) artist = "unknown_artist";
  if(!title || !/[a-zA-Zа-яА-ЯёЁ0-9]/.test(title))  title  = "unknown_track";
  artist = cutTo(safeNamePart(artist), 60) || "unknown_artist";
  title  = cutTo(safeNamePart(title), 90)  || "unknown_track";
  if(_WIN_RESERVED.test(artist)) artist = "_" + artist;
  if(_WIN_RESERVED.test(title))  title  = "_" + title;
  var prefix = "";
  if(trackNum && typeof trackNum === "number" && trackNum > 0){
    prefix = pad3(trackNum) + " - ";
  }
  return prefix + artist + " - " + title + (originalExt || "");
}

/* ============================================================
   5. ПЕРЕМЕШИВАНИЕ
   ============================================================ */
function shuf(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
function inter(g){
  var b={};
  Object.keys(g).forEach(function(a){b[a]=shuf(g[a])});
  var tot=0;Object.keys(b).forEach(function(a){tot+=b[a].length});
  var r=[],last=null;
  while(r.length<tot){
    var c=Object.keys(b).filter(function(a){return b[a].length>0&&a!==last});
    if(!c.length)c=Object.keys(b).filter(function(a){return b[a].length>0});
    if(!c.length)break;
    var w=c.map(function(a){return b[a].length});
    var tw=w.reduce(function(s,x){return s+x},0);
    var rr=Math.random()*tw,ch=c[c.length-1];
    for(var i=0;i<c.length;i++){rr-=w[i];if(rr<=0){ch=c[i];break}}
    r.push(b[ch].pop());
    last=ch;
  }
  return r;
}

