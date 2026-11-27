/* ============================================================
   6. ID3v2.4 + File с новым именем
   ============================================================ */
var _REPLACED_FRAMES = { TIT2: 1, TPE1: 1, TRCK: 1 };
function _syncsafe(u8, off){
  return ((u8[off]&0x7f)<<21)|((u8[off+1]&0x7f)<<14)|((u8[off+2]&0x7f)<<7)|(u8[off+3]&0x7f);
}
/* Читает существующий ID3v2-тег (v2.2/2.3/2.4): de-unsynchronisation, расширенный
   заголовок, кадры PIC (v2.2) → APIC, индикаторы длины, пропуск сжатых/зашифрованных. */
function _deunsync(u8){
  var out = [], i = 0, n = u8.length;
  while(i < n){
    out.push(u8[i]);
    if(u8[i] === 0xFF && i + 1 < n && u8[i+1] === 0x00) i++;
    i++;
  }
  return new Uint8Array(out);
}
/* Имена кадров ID3v2.2 → ID3v2.4. */
var _V22_MAP = { TT1:"TIT1", TT2:"TIT2", TT3:"TIT3", TP1:"TPE1", TP2:"TPE2", TP3:"TPE3",
  TP4:"TPE4", TAL:"TALB", TRK:"TRCK", TPA:"TPOS", TCO:"TCON", TCM:"TCOM", TYE:"TDRC",
  COM:"COMM", TXX:"TXXX" };
/* Кадр PIC (v2.2) переписываем в APIC (v2.4): трёхбуквенный код формата → mime-строка. */
function _picToApic(body){
  if(body.length < 6) return null;
  var fmt = String.fromCharCode(body[1], body[2], body[3]).toUpperCase();
  var mime = fmt === "PNG" ? "image/png" : "image/jpeg";
  var pos = 4;
  while(pos < body.length && body[pos] !== 0) pos++;
  if(pos + 1 >= body.length) return null;
  /* utf16-описание закрывается двумя нулями — второй пропускаем */
  if((body[0] === 1 || body[0] === 2) && body[pos + 1] === 0) pos++;
  var data = body.subarray(pos + 1);
  var out = new Uint8Array(1 + mime.length + 1 + data.length);
  var i, j = 0;
  out[j++] = body[0];
  for(i = 0; i < mime.length; i++) out[j++] = mime.charCodeAt(i);
  out[j++] = 0;
  out.set(data, j);
  return { id: "APIC", body: out };
}
function readId3Tag(u8){
  if(u8.length < 10 || u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) return null;
  var ver = u8[3], flags = u8[5], size = _syncsafe(u8, 6);
  var tag = { size: size, footer: (flags & 0x10) ? 10 : 0, frames: [] };
  if(ver < 2 || ver > 4) return tag;
  var body = u8.subarray(10, Math.min(10 + size, u8.length));
  /* Unsynchronisation: FF 00 → FF. В v2.4 размеры syncsafe — можно развернуть
     весь тег сразу; в v2.2/2.3 размеры хранят вставленные 00 — разворачиваем сам кадр */
  if(ver === 4 && (flags & 0x80)) body = _deunsync(body);
  var tagUns = ver < 4 && (flags & 0x80) !== 0;
  var pos = 0;
  if(ver === 2){
    var p2 = 0;
    while(p2 + 6 <= body.length){
      var id2 = String.fromCharCode(body[p2], body[p2+1], body[p2+2]);
      if(!/^[A-Z0-9]{3}$/.test(id2)) break;
      var len2 = (body[p2+3] << 16) | (body[p2+4] << 8) | body[p2+5];
      if(!len2 || p2 + 6 + len2 > body.length) break;
      var fb2 = body.subarray(p2 + 6, p2 + 6 + len2);
      p2 += 6 + len2;
      if(tagUns) fb2 = _deunsync(fb2);
      if(id2 === "PIC"){
        var pic = _picToApic(fb2);
        if(pic) tag.frames.push(pic);
      } else {
        tag.frames.push({ id: _V22_MAP[id2] || id2, body: fb2 });
      }
    }
    return tag;
  }
  /* Расширенный заголовок: v2.3 хранит размер без себя самого и не syncsafe */
  if((flags & 0x40) && body.length >= 8){
    var es = ver === 3
      ? 4 + (((body[0] << 24) | (body[1] << 16) | (body[2] << 8) | body[3]) >>> 0)
      : _syncsafe(body, 0);
    if(es < 0 || es > body.length) return tag;
    pos = es;
  }
  while(pos + 10 <= body.length){
    var id = String.fromCharCode(body[pos], body[pos+1], body[pos+2], body[pos+3]);
    if(!/^[A-Z0-9]{4}$/.test(id)) break;
    var fflags = (body[pos+8] << 8) | body[pos+9];
    var len = ver === 4
      ? _syncsafe(body, pos + 4)
      : (((body[pos+4] << 24) | (body[pos+5] << 16) | (body[pos+6] << 8) | body[pos+7]) >>> 0);
    if(!len || pos + 10 + len > body.length) break;
    var fb = body.subarray(pos + 10, pos + 10 + len);
    pos += 10 + len;
    /* Сжатые, зашифрованные и группированные кадры без их декодирования не читаем */
    if(ver === 3 ? (fflags & 0xE0) : (fflags & 0x4C)) continue;
    if(ver === 4 ? (fflags & 0x02) : tagUns) fb = _deunsync(fb);
    /* Индикатор длины данных: первые 4 байта кадра — не содержимое */
    if(ver === 4 && (fflags & 0x01) && fb.length >= 4) fb = fb.subarray(4);
    tag.frames.push({ id: id, body: fb });
  }
  return tag;
}
function _textFrameBody(value){
  var textBytes = new TextEncoder().encode(value);
  var body = new Uint8Array(1 + textBytes.length);
  body[0] = 0x03;
  body.set(textBytes, 1);
  return body;
}
function buildId3v24Tag(frames){
  var chunks = frames.map(function(f){
    var body = f.body || _textFrameBody(f.value || "");
    var len = body.length;
    var frame = new Uint8Array(10 + len);
    frame[0]=f.id.charCodeAt(0);
    frame[1]=f.id.charCodeAt(1);
    frame[2]=f.id.charCodeAt(2);
    frame[3]=f.id.charCodeAt(3);
    frame[4] = (len >> 21) & 0x7f;
    frame[5] = (len >> 14) & 0x7f;
    frame[6] = (len >> 7) & 0x7f;
    frame[7] = len & 0x7f;
    frame.set(body, 10);
    return frame;
  });
  var totalData = 0;
  chunks.forEach(function(c){ totalData += c.length; });
  var result = new Uint8Array(10 + totalData);
  result[0]=0x49; result[1]=0x44; result[2]=0x33;
  result[3]=0x04; result[4]=0x00; result[5]=0x00;
  result[6] = (totalData >> 21) & 0x7f;
  result[7] = (totalData >> 14) & 0x7f;
  result[8] = (totalData >> 7) & 0x7f;
  result[9] = totalData & 0x7f;
  var off = 10;
  chunks.forEach(function(c){ result.set(c, off); off += c.length; });
  return result;
}
function makeRenamedFile(originalFile, finalName, num, artist, title){
  return new Promise(function(resolve){
    function fallback(){
      try { resolve(new File([originalFile], finalName, { type: originalFile.type || "audio/mpeg" })); }
      catch(e){ resolve(originalFile); }
    }
    if(ext(originalFile.name) !== "mp3"){
      try { resolve(new File([originalFile], finalName, { type: originalFile.type || "audio/mpeg" })); }
      catch(e){ resolve(originalFile); }
      return;
    }
    originalFile.arrayBuffer().then(function(buf){
      try{
        var u8 = new Uint8Array(buf);
        var old = readId3Tag(u8);
        var offset = old ? 10 + old.size + old.footer : 0;
        if(offset > u8.length) offset = u8.length;
        var frames = [];
        if(num) frames.push({ id: "TRCK", value: String(num) });
        if(title && title !== "unknown_track")  frames.push({ id: "TIT2", value: title });
        if(artist && artist !== "unknown_artist") frames.push({ id: "TPE1", value: artist });
        /* Обложка, альбом, год и прочее раньше терялись — переносим их в новый тег. */
        if(old && old.frames.length){
          old.frames.forEach(function(f){
            if(!_REPLACED_FRAMES[f.id]) frames.push({ id: f.id, body: f.body });
          });
        }
        var tag = buildId3v24Tag(frames);
        var audio = u8.subarray(offset);
        var out = new Uint8Array(tag.length + audio.length);
        out.set(tag, 0);
        out.set(audio, tag.length);
        resolve(new File([out], finalName, { type: "audio/mpeg" }));
      }catch(e){
        console.error("ID3 write failed:", originalFile.name, e);
        fallback();
      }
    }).catch(function(e){
      console.error("Read failed:", originalFile.name, e);
      fallback();
    });
  });
}

