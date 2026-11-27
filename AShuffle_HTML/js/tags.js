"use strict";
/* ============================================================
   6b. ТЕГИ И ДЛИТЕЛЬНОСТЬ
   ============================================================ */
function decodeTextFrame(body){
  if(!body || !body.length) return "";
  var enc = body[0], bytes = body.subarray(1), text = "";
  try{
    if(enc === 0)      text = new TextDecoder("iso-8859-1").decode(bytes);
    else if(enc === 3) text = new TextDecoder("utf-8").decode(bytes);
    else if(enc === 2) text = new TextDecoder("utf-16be").decode(bytes);
    else {
      var le = bytes[0] === 0xFF && bytes[1] === 0xFE;
      var be = bytes[0] === 0xFE && bytes[1] === 0xFF;
      text = new TextDecoder(be ? "utf-16be" : "utf-16le").decode(bytes.subarray((le || be) ? 2 : 0));
    }
  }catch(e){ return ""; }
  return text.split("\u0000")[0].replace(/\u0000+/g, "").trim();
}
/* ID3v1 в конце файла: многие рипы хранят имя только там */
function readId3v1(file){
  if(file.size < 128) return Promise.resolve(null);
  return file.slice(file.size - 128).arrayBuffer().then(function(buf){
    var u8 = new Uint8Array(buf);
    if(String.fromCharCode(u8[0],u8[1],u8[2]) !== "TAG") return null;
    function dec(off, len){
      var bytes = u8.subarray(off, off + len), end = bytes.length;
      while(end > 0 && (bytes[end-1] === 0 || bytes[end-1] === 32)) end--;
      bytes = bytes.subarray(0, end);
      if(!bytes.length) return "";
      try{ return new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim(); }catch(e){}
      try{ return new TextDecoder("windows-1251").decode(bytes).trim(); }catch(e){}
      return "";
    }
    return { title: dec(3, 30), artist: dec(33, 30), album: dec(63, 30) };
  }).catch(function(){ return null; });
}
function readMp3Tags(file){
  var cap = 32 * 1024 * 1024;
  return file.slice(0, 10).arrayBuffer().then(function(headBuf){
    var head = new Uint8Array(headBuf);
    var hasTag = head.length === 10 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33;
    var want = hasTag ? 10 + _syncsafe(head, 6) + ((head[5] & 0x10) ? 10 : 0) : 0;
    /* Гигантский (или повреждённый) тег целиком в память не берём */
    if(want > cap) want = 0;
    if(!want) return null;
    return file.slice(0, want).arrayBuffer().then(function(buf){
      var tag = readId3Tag(new Uint8Array(buf));
      var out = {};
      if(tag && tag.frames && tag.frames.length){
        tag.frames.forEach(function(f){
          var v;
          if(f.id === "TIT2" && !out.title){ v = decodeTextFrame(f.body); if(v) out.title = v; }
          else if(f.id === "TPE1" && !out.artist){ v = decodeTextFrame(f.body); if(v) out.artist = v; }
          else if(f.id === "TALB" && !out.album){ v = decodeTextFrame(f.body); if(v) out.album = v; }
          else if(f.id === "TLEN" && !out.length){ v = parseInt(decodeTextFrame(f.body), 10); if(v > 0) out.length = v; }
        });
      }
      return (out.title || out.artist) ? out : null;
    });
  }).then(function(out){
    if(out && out.title && out.artist) return out;
    /* Тегов нет или не хватает полей — добираем из ID3v1 в хвосте файла */
    return readId3v1(file).then(function(v1){
      if(!v1) return (out && (out.title || out.artist)) ? out : null;
      out = out || {};
      if(!out.title && v1.title) out.title = v1.title;
      if(!out.artist && v1.artist) out.artist = v1.artist;
      if(!out.album && v1.album) out.album = v1.album;
      return (out.title || out.artist) ? out : null;
    });
  }).catch(function(){ return null; });
}
/* FLAC: VORBIS_COMMENT с тегами + STREAMINFO с длительностью */
function _vorbisFields(b, out){
  if(b.length < 8) return;
  var dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  var pos = 0, vlen = dv.getUint32(pos, true);
  pos += 4 + vlen;
  if(pos + 4 > b.length) return;
  var n = dv.getUint32(pos, true);
  pos += 4;
  for(var i=0;i<n && pos+4<=b.length;i++){
    var l = dv.getUint32(pos, true);
    pos += 4;
    if(pos + l > b.length) break;
    var s = new TextDecoder("utf-8").decode(b.subarray(pos, pos + l));
    pos += l;
    var eq = s.indexOf("=");
    if(eq < 1) continue;
    var key = s.slice(0, eq).toUpperCase(), val = s.slice(eq + 1).trim();
    if(!val) continue;
    if(key === "TITLE" && !out.title) out.title = val;
    else if(key === "ARTIST" && !out.artist) out.artist = val;
    else if(key === "ALBUM" && !out.album) out.album = val;
  }
}
function readFlacTags(file){
  return file.slice(0, 2*1024*1024).arrayBuffer().then(function(buf){
    var u8 = new Uint8Array(buf);
    if(u8.length < 8 || String.fromCharCode(u8[0],u8[1],u8[2],u8[3]) !== "fLaC") return null;
    var out = {}, pos = 4;
    while(pos + 4 <= u8.length){
      var h = u8[pos], type = h & 0x7f, last = (h & 0x80) !== 0;
      var len = (u8[pos+1] << 16) | (u8[pos+2] << 8) | u8[pos+3];
      var start = pos + 4;
      if(start + len > u8.length) break;
      if(type === 4) _vorbisFields(u8.subarray(start, start + len), out);
      else if(type === 0 && len >= 18){
        var b = u8.subarray(start, start + len);
        var sr = (b[10] << 12) | (b[11] << 4) | (b[12] >> 4);
        var total = (b[13] & 0x0f) * 4294967296 + (((b[14] << 24) | (b[15] << 16) | (b[16] << 8) | b[17]) >>> 0);
        if(sr > 0 && total > 0) out.length = Math.round(total / sr * 1000);
      }
      pos = start + len;
      if(last) break;
    }
    return (out.title || out.artist) ? out : null;
  }).catch(function(){ return null; });
}
/* APEv2: тег лежит в конце файла, перед возможным ID3v1 */
function readApeTags(file){
  var tail = Math.min(file.size, 1024*1024);
  return file.slice(file.size - tail).arrayBuffer().then(function(buf){
    var u8 = new Uint8Array(buf);
    var magic = "APETAGEX", idx = -1;
    for(var i=u8.length-8;i>=0;i--){
      var ok = true;
      for(var k=0;k<8;k++){ if(u8[i+k] !== magic.charCodeAt(k)){ ok = false; break; } }
      if(ok){ idx = i; break; }
    }
    if(idx < 0) return null;
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var size = dv.getUint32(idx + 12, true);
    var count = dv.getUint32(idx + 16, true);
    if(size < 32) return null;
    var start = idx + 32 - size;
    if(start < 0) return null;
    var pos = start, out = {};
    for(var n=0;n<count && pos + 8 <= idx;n++){
      var vlen = dv.getUint32(pos, true);
      pos += 8;
      var keyEnd = pos;
      while(keyEnd < idx && u8[keyEnd] !== 0) keyEnd++;
      var key = String.fromCharCode.apply(null, u8.subarray(pos, keyEnd)).toLowerCase();
      pos = keyEnd + 1;
      if(pos + vlen > u8.length) break;
      var val = new TextDecoder("utf-8").decode(u8.subarray(pos, pos + vlen)).replace(/\u0000+$/g, "").trim();
      pos += vlen;
      if(key === "title" && !out.title) out.title = val;
      else if(key === "artist" && !out.artist) out.artist = val;
      else if(key === "album" && !out.album) out.album = val;
    }
    return (out.title || out.artist) ? out : null;
  }).catch(function(){ return null; });
}
/* ASF/WMA: метаданные в объектах заголовка файла */
var _ASF_HEADER = "3026b2758e66cf11a6d900aa0062ce6c";
var _ASF_CD     = "3326b2758e66cf11a6d900aa0062ce6c";
var _ASF_ECD    = "40a4d0d207e3d21197f000a0c95ea850";
function _hexGuid(u8, off){
  var s = "";
  for(var i=0;i<16;i++) s += ("0" + u8[off+i].toString(16)).slice(-2);
  return s;
}
function _utf16le(u8, start, len){
  return new TextDecoder("utf-16le").decode(u8.subarray(start, start + len)).replace(/\u0000+$/g, "").trim();
}
function _u64(dv, off){
  return dv.getBigUint64 ? Number(dv.getBigUint64(off, true)) : (dv.getUint32(off, true) + dv.getUint32(off + 4, true) * 4294967296);
}
function _asfContentDescription(u8, start, end, out){
  var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if(start + 10 > end) return;
  var lens = [], p = start;
  for(var i=0;i<5;i++){ lens.push(dv.getUint16(p, true)); p += 2; }
  var fields = ["title", "artist", "copyright", "description", "rating"];
  for(var j=0;j<5;j++){
    if(p + lens[j] > end) break;
    var val = _utf16le(u8, p, lens[j]);
    p += lens[j];
    if(fields[j] === "title" && val && !out.title) out.title = val;
    else if(fields[j] === "artist" && val && !out.artist) out.artist = val;
  }
}
function _asfExtended(u8, start, end, out){
  var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if(start + 2 > end) return;
  var n = dv.getUint16(start, true), p = start + 2;
  for(var i=0;i<n && p + 2 <= end;i++){
    var nl = dv.getUint16(p, true);
    p += 2;
    if(p + nl + 4 > end) break;
    var name = _utf16le(u8, p, nl).toLowerCase();
    p += nl;
    var type = dv.getUint16(p, true);
    p += 2;
    var vl = dv.getUint16(p, true);
    p += 2;
    if(p + vl > end) break;
    var val = type === 0 ? _utf16le(u8, p, vl) : "";
    p += vl;
    if(!val) continue;
    if((name === "title" || name === "wm/title") && !out.title) out.title = val;
    else if((name === "author" || name === "wm/artist" || name === "wm/albumartist") && !out.artist) out.artist = val;
    else if(name === "wm/albumtitle" && !out.album) out.album = val;
  }
}
function readWmaTags(file){
  return file.slice(0, 1024*1024).arrayBuffer().then(function(buf){
    var u8 = new Uint8Array(buf);
    if(u8.length < 30 || _hexGuid(u8, 0) !== _ASF_HEADER) return null;
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var hsize = _u64(dv, 16);
    var count = dv.getUint32(24, true);
    var end = Math.min(u8.length, hsize || u8.length);
    var p = 30, out = {};
    for(var i=0;i<count && p + 24 <= end;i++){
      var g = _hexGuid(u8, p);
      var osize = _u64(dv, p + 16);
      if(osize < 24 || p + osize > end) break;
      if(g === _ASF_CD) _asfContentDescription(u8, p + 24, p + osize, out);
      else if(g === _ASF_ECD) _asfExtended(u8, p + 24, p + osize, out);
      p += osize;
    }
    return (out.title || out.artist) ? out : null;
  }).catch(function(){ return null; });
}
var _probeQueue = [], _probeActive = 0;
/* MP4/M4A: moov → udta → meta → ilst, тексты в атомах ©nam / ©ART / ©alb */
function _mp4Atoms(u8, start, end){
  var list = [], p = start;
  while(p + 8 <= end){
    var size = ((u8[p]<<24) | (u8[p+1]<<16) | (u8[p+2]<<8) | u8[p+3]) >>> 0;
    var type = String.fromCharCode(u8[p+4], u8[p+5], u8[p+6], u8[p+7]);
    var hdr = 8;
    if(size === 1 && p + 16 <= end){
      var hi = ((u8[p+8]<<24)|(u8[p+9]<<16)|(u8[p+10]<<8)|u8[p+11]) >>> 0;
      var lo = ((u8[p+12]<<24)|(u8[p+13]<<16)|(u8[p+14]<<8)|u8[p+15]) >>> 0;
      size = hi * 4294967296 + lo;
      hdr = 16;
    } else if(size === 0){
      size = end - p;
    }
    if(size < hdr || p + size > end) break;
    list.push({ type: type, start: p + hdr, end: p + size });
    p += size;
  }
  return list;
}
function _mp4Find(atoms, type){
  for(var i=0;i<atoms.length;i++) if(atoms[i].type === type) return atoms[i];
  return null;
}
function _mp4Text(u8, atom){
  var data = _mp4Find(_mp4Atoms(u8, atom.start, atom.end), "data");
  if(!data) return "";
  return new TextDecoder("utf-8").decode(u8.subarray(data.start + 8, data.end)).replace(/\u0000+$/g, "").trim();
}
function readMp4Tags(file){
  if(file.size > 48 * 1024 * 1024) return Promise.resolve(null);
  return file.arrayBuffer().then(function(buf){
    var u8 = new Uint8Array(buf);
    var moov = _mp4Find(_mp4Atoms(u8, 0, u8.length), "moov");
    if(!moov) return null;
    var udta = _mp4Find(_mp4Atoms(u8, moov.start, moov.end), "udta");
    if(!udta) return null;
    var meta = _mp4Find(_mp4Atoms(u8, udta.start, udta.end), "meta");
    if(!meta) return null;
    var ilst = _mp4Find(_mp4Atoms(u8, meta.start + 4, meta.end), "ilst");
    if(!ilst) return null;
    var out = {};
    _mp4Atoms(u8, ilst.start, ilst.end).forEach(function(k){
      var v;
      if(k.type === "\u00A9nam" && !out.title){ v = _mp4Text(u8, k); if(v) out.title = v; }
      else if(k.type === "\u00A9ART" && !out.artist){ v = _mp4Text(u8, k); if(v) out.artist = v; }
      else if(k.type === "\u00A9alb" && !out.album){ v = _mp4Text(u8, k); if(v) out.album = v; }
    });
    return (out.title || out.artist) ? out : null;
  }).catch(function(){ return null; });
}
/* Ogg Vorbis / Opus: склеиваем данные первых страниц и ищем заголовок комментариев */
function readOggTags(file){
  return file.slice(0, 512*1024).arrayBuffer().then(function(buf){
    var u8 = new Uint8Array(buf);
    if(u8.length < 28 || String.fromCharCode(u8[0],u8[1],u8[2],u8[3]) !== "OggS") return null;
    var parts = [], p = 0;
    while(p + 27 <= u8.length){
      if(String.fromCharCode(u8[p],u8[p+1],u8[p+2],u8[p+3]) !== "OggS") break;
      var nseg = u8[p+26], table = p + 27, total = 0;
      if(table + nseg > u8.length) break;   /* усечённая таблица сегментов */
      for(var i=0;i<nseg;i++) total += u8[table+i];
      var dstart = table + nseg;
      if(dstart + total > u8.length) break;
      parts.push(u8.subarray(dstart, dstart + total));
      p = dstart + total;
    }
    if(!parts.length) return null;
    var len = 0;
    parts.forEach(function(x){ len += x.length; });
    var data = new Uint8Array(len), o = 0;
    parts.forEach(function(x){ data.set(x, o); o += x.length; });

    var idx = -1, skip = 0;
    for(var j=0;j+8<data.length;j++){
      if(data[j] === 3 && data[j+1] === 0x76 && data[j+2] === 0x6f && data[j+3] === 0x72 &&
         data[j+4] === 0x62 && data[j+5] === 0x69 && data[j+6] === 0x73){ idx = j; skip = 7; break; }
      if(data[j] === 0x4f && data[j+1] === 0x70 && data[j+2] === 0x75 && data[j+3] === 0x73 &&
         data[j+4] === 0x54 && data[j+5] === 0x61 && data[j+6] === 0x67 && data[j+7] === 0x73){ idx = j; skip = 8; break; }
    }
    if(idx < 0) return null;
    var out = {};
    _vorbisFields(data.subarray(idx + skip), out);
    return (out.title || out.artist) ? out : null;
  }).catch(function(){ return null; });
}
function probeDuration(file){
  if(typeof Audio !== "function") return Promise.resolve(0);
  return new Promise(function(resolve){
    _probeQueue.push({ file: file, resolve: resolve });
    pumpProbes();
  });
}
/* Не больше 4 одновременных чтений метаданных: иначе большая папка вешает браузер */
function pumpProbes(){
  while(_probeActive < 4 && _probeQueue.length){
    (function(job){
      _probeActive++;
      var url = URL.createObjectURL(job.file), a = new Audio(), done = false;
      function finish(v){
        if(done) return;
        done = true;
        try{ a.removeAttribute("src"); }catch(e){}
        try{ URL.revokeObjectURL(url); }catch(e2){}
        _probeActive--;
        job.resolve(v || 0);
        pumpProbes();
      }
      a.preload = "metadata";
      a.onloadedmetadata = function(){ finish(isFinite(a.duration) ? a.duration : 0); };
      a.onerror = function(){ finish(0); };
      setTimeout(function(){ finish(0); }, 8000);
      a.src = url;
    })(_probeQueue.shift());
  }
}
function usefulTag(v){
  if(!v) return false;
  var s = String(v).trim();
  if(s.length < 2 || s.length > 150) return false;
  if(!/[a-zA-Zа-яА-ЯёЁ]/.test(s)) return false;
  if(/^(track|audio|unknown|untitled|no title)\b/i.test(s)) return false;
  return true;
}
/* Тег важнее имени файла; длительность нужна для отсева чужих совпадений. */
/* Длительность mp3 по первому кадру (CBR) — запасной путь,
   когда <audio> не смог прочитать метаданные */
var _BR = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
var _SR = [44100,48000,32000,0];
function mp3DurationEstimate(file){
  return file.slice(0, 8192).arrayBuffer().then(function(buf){
    var u8 = new Uint8Array(buf);
    var start = 0;
    if(u8.length > 10 && u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33){
      start = 10 + (((u8[6]&0x7f)<<21) | ((u8[7]&0x7f)<<14) | ((u8[8]&0x7f)<<7) | (u8[9]&0x7f));
    }
    for(var i=start; i<u8.length-4 && i<start+4096; i++){
      if(u8[i] === 0xFF && (u8[i+1] & 0xE0) === 0xE0){
        var br = _BR[(u8[i+2] >> 4) & 0x0F] * 1000;
        var sr = _SR[(u8[i+2] >> 2) & 0x03];
        if(!br || !sr) continue;
        var audioBytes = file.size - i;
        var dur = audioBytes * 8 / br;
        return (dur > 5 && dur < 7200) ? Math.round(dur * 10) / 10 : 0;
      }
    }
    return 0;
  }).catch(function(){ return 0; });
}
function inspectEntry(e){
  return probeDuration(e.file).then(function(dur){
    if(dur > 0){ e.duration = dur; return dur; }
    if(ext(e.name) === "mp3") return mp3DurationEstimate(e.file).then(function(d2){
      if(d2 > 0) e.duration = d2;
      return d2;
    });
    return 0;
  }).then(function(){
    var extn = ext(e.name);
    if(extn === "mp3") return readMp3Tags(e.file);
    if(extn === "flac") return readFlacTags(e.file);
    if(extn === "m4a" || extn === "alac") return readMp4Tags(e.file);
    if(extn === "ogg" || extn === "oga" || extn === "opus") return readOggTags(e.file);
    if(extn === "ape") return readApeTags(e.file);
    if(extn === "wma") return readWmaTags(e.file);
    return null;
  }).then(function(tags){
    if(tags){
      e.tags = tags;
      if(!e.duration && tags.length) e.duration = tags.length / 1000;
      if(e.info.status === "raw" && e.id !== editingId){
        var changed = false;
        if(usefulTag(tags.artist) && norm(tags.artist) !== norm(e.info.artist)){ e.info.artist = stripSiteJunk(foldMixed(stripNamePrefix(tags.artist.trim()))); changed = true; }
        if(usefulTag(tags.title)  && norm(tags.title)  !== norm(e.info.title)){  e.info.title  = stripNoiseBrackets(stripSiteJunk(foldMixed(stripNamePrefix(tags.title.trim()))));  changed = true; }
        if(changed){
          /* Граница могла сдвинуться и в тегах: «g-eazy» + «and halsey-him and i» */
          var pulledTag = pullCreditFromTitle(e.info.artist, e.info.title);
          if(pulledTag){ e.info.artist = pulledTag.artist; e.info.title = pulledTag.title; }
        }
        if(changed){ e.info.fromTags = true; e.info._raw = ""; }
      }
    }
    /* Строку с открытой формой правки не трогаем: не съедим фокус и набранный текст */
    if(e.id!==editingId) refreshRow(e);
  }).catch(function(){});
}

