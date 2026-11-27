"use strict";
/* Общий загрузчик кода приложения для проверок: читает js-блоки из
   AShaffle_HTML/js в алфавитном порядке и склеивает их в исходный скрипт
   (до v11.67 код вынимался из inline-<script> корневого AShaffle.html).
   Порядок имён файлов задаёт порядок исполнения — он важен. */
const fs = require("fs");
const path = require("path");

function appCode() {
  const dir = path.join(__dirname, "..", "AShaffle_HTML", "js");
  return '"use strict";\n' + fs.readdirSync(dir)
    .filter(f => f.endsWith(".js"))
    .sort()
    .map(f => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("");
}

module.exports = { appCode };
