/* ============================================================
   10. ZIP
   ============================================================ */
var _crcTable = (function(){
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function _crc32(u8){
  var c = 0xFFFFFFFF;
  for (var i = 0; i < u8.length; i++) c = _crcTable[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function _w16(a,o,v){a[o]=v&0xFF;a[o+1]=(v>>>8)&0xFF;}
function _w32(a,o,v){a[o]=v&0xFF;a[o+1]=(v>>>8)&0xFF;a[o+2]=(v>>>16)&0xFF;a[o+3]=(v>>>24)&0xFF;}
/* Архив целиком собирается в памяти — за этим пределом вкладка скорее упадёт, чем покажет ошибку */
var ZIP_MAX_BYTES = 2 * 1024 * 1024 * 1024;

function buildZipBlob(entries, onProgress){
  var enc = new TextEncoder();
  var files = entries.map(function(e){
    var nb = enc.encode(e.name);
    return { file: e.file, nameBytes: nb, nameLen: nb.length, size: e.file.size, crc: 0, offset: 0 };
  });
  var localTotal = 0, cdTotal = 0;
  files.forEach(function(f){
    f.localSize = 30 + f.nameLen + f.size;
    f.cdSize = 46 + f.nameLen;
    localTotal += f.localSize;
    cdTotal += f.cdSize;
  });
  if(files.length > 65535){
    return Promise.reject(new Error("файлов больше 65535 — ZIP столько не хранит"));
  }
  if(localTotal + cdTotal + 22 > ZIP_MAX_BYTES){
    return Promise.reject(new Error("архив больше 2 ГБ — сохраните результат в папку"));
  }
  var now = new Date();
  var dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((now.getSeconds() >> 1) & 0x1f);
  var dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);
  var out = new Uint8Array(localTotal + cdTotal + 22);
  var off = 0, done = 0;
  function readOne(i){
    if(i >= files.length) return Promise.resolve();
    var f = files[i];
    return f.file.arrayBuffer().then(function(buf){
      var data = new Uint8Array(buf);
      var start = off;
      f.offset = start;
      f.crc = _crc32(data);
      var o = start;
      _w32(out, o, 0x04034b50); o += 4;
      _w16(out, o, 20); o += 2;
      _w16(out, o, 0x0800); o += 2;
      _w16(out, o, 0); o += 2;
      _w16(out, o, dosTime); o += 2;
      _w16(out, o, dosDate); o += 2;
      _w32(out, o, f.crc); o += 4;
      _w32(out, o, f.size); o += 4;
      _w32(out, o, f.size); o += 4;
      _w16(out, o, f.nameLen); o += 2;
      _w16(out, o, 0); o += 2;
      out.set(f.nameBytes, o);
      out.set(data, start + 30 + f.nameLen);
      off = start + 30 + f.nameLen + data.length;
      done++;
      if(onProgress) onProgress(done, files.length);
      /* Читаем по одному файлу: в памяти одновременно весь архив + один файл, а не два архива */
      return readOne(i + 1);
    });
  }
  return readOne(0).then(function(){
    var cdOffset = off;
    files.forEach(function(f){
      _w32(out, off, 0x02014b50); off += 4;
      _w16(out, off, 20); off += 2;
      _w16(out, off, 20); off += 2;
      _w16(out, off, 0x0800); off += 2;
      _w16(out, off, 0); off += 2;
      _w16(out, off, dosTime); off += 2;
      _w16(out, off, dosDate); off += 2;
      _w32(out, off, f.crc); off += 4;
      _w32(out, off, f.size); off += 4;
      _w32(out, off, f.size); off += 4;
      _w16(out, off, f.nameLen); off += 2;
      _w16(out, off, 0); off += 2;
      _w16(out, off, 0); off += 2;
      _w16(out, off, 0); off += 2;
      _w16(out, off, 0); off += 2;
      _w32(out, off, 0); off += 4;
      _w32(out, off, f.offset); off += 4;
      out.set(f.nameBytes, off); off += f.nameLen;
    });
    var cdSize = off - cdOffset;
    _w32(out, off, 0x06054b50); off += 4;
    _w16(out, off, 0); off += 2;
    _w16(out, off, 0); off += 2;
    _w16(out, off, files.length); off += 2;
    _w16(out, off, files.length); off += 2;
    _w32(out, off, cdSize); off += 4;
    _w32(out, off, cdOffset); off += 4;
    _w16(out, off, 0); off += 2;
    return new Blob([out], { type: "application/zip" });
  });
}

function download(file,name){
  var url=URL.createObjectURL(file);
  var a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url)},30000);
}

function saveAllToDir(dirHandle){
  pshow("Сохранение в «" + dirHandle.name + "»…");
  var ch = Promise.resolve();
  var usedNames = {};
  results.forEach(function(r, i){
    ch = ch.then(function(){
      var name = r.name;
      if(usedNames[name]){
        usedNames[name]++;
        var m = name.match(/^(.*)(.[^.]+)$/);
        name = m ? (m[1] + "_" + usedNames[name] + m[2]) : (name + "_" + usedNames[name]);
      } else {
        usedNames[name] = 1;
      }
      return dirHandle.getFileHandle(name, { create: true })
        .then(function(fh){ return fh.createWritable(); })
        .then(function(w){ return w.write(r.file).then(function(){ return w.close(); }); })
        .then(function(){ pup(i+1, results.length); });
    });
  });
  return ch.then(function(){ return dirHandle.name; });
}

function downloadAsZipViaAnchor(){
  pshow("Подготовка ZIP…");
  return buildZipBlob(
    results.map(function(r){ return { name: r.name, file: r.file }; }),
    function(done, total){ pup(done, total, "Читаю файл " + done + " из " + total); }
  ).then(function(blob){
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "ashuffle.zip";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    phide();
    stt("ZIP сохранён: " + results.length + " файлов");
  }).catch(function(e){
    phide();
    stt("Не удалось собрать ZIP: " + (e && e.message ? e.message : e));
  });
}

function downloadAsZip(){
  if(!results.length) return Promise.resolve();
  if(CAN_PICK_FILE){
    var pickPromise;
    try{
      pickPromise = window.showSaveFilePicker({
        suggestedName: "ashuffle.zip",
        types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }]
      });
    } catch(e){
      return downloadAsZipViaAnchor();
    }
    return pickPromise.then(function(handle){
      pshow("Подготовка ZIP…");
      return buildZipBlob(
        results.map(function(r){ return { name: r.name, file: r.file }; }),
        function(done, total){ pup(done, total, "Читаю файл " + done + " из " + total); }
      ).then(function(blob){
        return handle.createWritable().then(function(w){
          return w.write(blob).then(function(){ return w.close(); });
        });
      }).then(function(){
        phide();
        stt("ZIP сохранён: " + results.length + " файлов");
      });
    }).catch(function(e){
      phide();
      if(e && e.name === "AbortError"){ stt("Сохранение отменено"); return; }
      return downloadAsZipViaAnchor();
    });
  }
  return downloadAsZipViaAnchor();
}

$("dlAll").addEventListener("click", function(){
  if(!results.length || busy) return;
  var btn = $("dlAll");
  btn.disabled = true;
  function onDone(){ btn.disabled = false; }

  if(CAN_PICK_DIR){
    var dirPromise;
    try{
      dirPromise = window.showDirectoryPicker({ mode: "readwrite" });
    } catch(e){
      downloadAsZip().then(onDone, onDone);
      return;
    }
    dirPromise.then(function(dirHandle){
      return saveAllToDir(dirHandle);
    }).then(function(dirName){
      phide();
      stt("Сохранено в «" + dirName + "»: " + results.length + " файлов.");
      onDone();
    }).catch(function(e){
      phide();
      if(e && e.name === "AbortError"){
        stt("Выбор папки отменён.");
        onDone();
      } else {
        console.warn("showDirectoryPicker failed:", e);
        stt("Выбор папки не сработал — сохраняю ZIP.");
        downloadAsZip().then(onDone, onDone);
      }
    });
  } else {
    downloadAsZip().then(onDone, onDone);
  }
});

