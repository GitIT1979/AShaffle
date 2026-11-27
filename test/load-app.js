"use strict";
/* Общий загрузчик кода приложения для проверок: читает js-блоки из
   AShuffle_HTML/js и склеивает их в исходный скрипт (до v11.67 код вынимался
   из inline-<script> корневого AShuffle.html).
   Порядок исполнения задаёт список ORDER — он совпадает с порядком <script>
   в AShuffle.html. Файл на диске без записи в ORDER (и наоборот) — ошибка:
   так новый блок не потеряется молча. */
const fs = require("fs");
const path = require("path");

const ORDER = [
  "core.js", "parse.js", "catalog.js", "name-shuffle.js", "id3.js",
  "tags.js", "ui.js", "lookup.js", "verify.js", "credit.js",
  "pipeline.js", "zip.js", "main.js",
];

function appCode() {
  const dir = path.join(__dirname, "..", "AShuffle_HTML", "js");
  const onDisk = fs.readdirSync(dir).filter(f => f.endsWith(".js")).sort();
  const missing = onDisk.filter(f => ORDER.indexOf(f) < 0);
  const extra = ORDER.filter(f => onDisk.indexOf(f) < 0);
  if (missing.length || extra.length) {
    throw new Error("список ORDER в load-app.js расходится с js/: +" +
      missing.join(", ") + " -" + extra.join(", "));
  }
  return '"use strict";\n' + ORDER
    .map(f => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("");
}

module.exports = { appCode };
