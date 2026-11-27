
(function(){
"use strict";

var EX={mp3:1,flac:1,m4a:1,ogg:1,wav:1,aac:1,wma:1,opus:1,aiff:1,alac:1,ape:1};
var files=[];
var results=[];
var busy=false;
var dirty=false;
var nextId=1;
var editingId=0;
var verifying=false;
var cancelVerify=false;
var _multiDir=false;
var madeTrue=false;
var confirmed=false;
var playingId=0, playingUrl="";

var CAN_PICK_DIR  = typeof window.showDirectoryPicker === "function";
var CAN_PICK_FILE = typeof window.showSaveFilePicker  === "function";
var CAN_ITUNES    = typeof fetch === "function";

function $(i){return document.getElementById(i)}

/* ============================================================
   РЕЕСТР ПРАВИЛ
   Единый список всего, что программа делает с именами.
   Каждое правило привязано к функции (fn) или к константе (const);
   inFn — правило живёт внутри этой функции.
   test/harness.js проверяет, что у каждого правила есть живой код,
   а test/rules.js — что оно действительно работает.
   ============================================================ */
var RULES = [
  /* --- вход: имя файла --- */
  { id:1,  layer:"вход",   text:"Номер трека в начале имени (001 - , 07. ) отрезается, но число внутри названия остаётся", fn:"stripTrackPrefix" },
  { id:2,  layer:"вход",   text:"Мусорные латинские префиксы сайтов (KR, TV, QF, UYT, nai) срезаются до остальных чисток", fn:"stripNamePrefix" },
  { id:3,  layer:"вход",   text:"Латинские буквы-двойники внутри кириллических слов заменяются (Vиктор → Виктор)", fn:"foldMixed" },
  { id:4,  layer:"вход",   text:"Диакритика не важна: mêmes = memes, Tiësto = Tiesto, ё = е", fn:"norm" },
  { id:5,  layer:"вход",   text:"Сайты-водяные знаки в скобках и без (Sefon.me, музыка.me, sonq.ru) вырезаются", fn:"stripSiteJunk" },
  { id:6,  layer:"вход",   text:"Шум в скобках (remaster, bonus, radio edit, live) не считается частью названия", fn:"stripNoiseBrackets" },
  { id:7,  layer:"вход",   text:"Два и более дефиса внутри одного слова — разделители (the-black-eyed-peas-j-balvin)", fn:"splitGluedArtist" },
  { id:8,  layer:"вход",   text:"Одиночная буква, приклеенная к имени (MДжанго), отбрасывается при поиске", fn:"shaveGluedLetter" },
  { id:9,  layer:"вход",   text:"Кредит, застрявший в названии (and halsey - … , feat. X - …), возвращается исполнителю", fn:"pullCreditFromTitle" },
  { id:10, layer:"вход",   text:"Заглушка (unknown_artist, Unknown Artist, VA) и непроизносимое имя (花電車) — не исполнитель", fn:"isPlaceholder" },
  { id:11, layer:"вход",   text:"Теги важнее имени файла: ID3v2, ID3v1, FLAC, m4a, Ogg/Opus, APE, WMA", fn:"readMp3Tags" },
  { id:12, layer:"вход",   text:"Словарь имён групп и связок (korol i shut, жанго) — не догадка, а знание", fn:"aliasSplit" },
  { id:13, layer:"вход",   text:"Имя строчными буквами тоже запрашивается с заглавной (жанго → Джанго)", fn:"capitalizeArtist" },
  { id:14, layer:"вход",   text:"Артикль The из файла возвращается, если каталог его потерял", fn:"keepArticle" },

  /* --- запрос к каталогам --- */
  { id:15, layer:"запрос", text:"Кириллица: Deezer → iTunes → MusicBrainz; латиница: MusicBrainz → Deezer → iTunes", fn:"lookupTrack" },
  { id:16, layer:"запрос", text:"Обратный транслит уходит в Deezer и iTunes с мягким сравнением (транслит не должен блокировать точный запрос)", fn:"lookupDeezer" },
  { id:17, layer:"запрос", text:"MusicBrainz: кириллица в кавычках чувствительна к регистру — запросы капитализируются, выдача 15", fn:"capWords" },
  { id:18, layer:"запрос", text:"Хвост названия + первое слово исполнителя — когда в тегах сдвинута граница слов", fn:"tailOk" },
  { id:19, layer:"запрос", text:"Недостающий участник кредита докручивается в iTunes/Deezer (G-Eazy → G-Eazy & Halsey)", fn:"completeCredit" },
  { id:20, layer:"запрос", text:"MusicBrainz ищется и по кириллическому названию с первым словом кириллического исполнителя", inFn:"lookupTrack" },

  /* --- проверка кандидата --- */
  { id:21, layer:"проверка", text:"Допуск по длительности ±10 с; при полном совпадении имени — ±60 с", const:"DUR_TOL_EXACT" },
  { id:22, layer:"проверка", text:"Балл ниже 0.5 — случайное совпадение, кандидат отбрасывается", const:"MIN_SCORE" },
  { id:23, layer:"проверка", text:"Исполнитель кандидата сверяется с файлом, включая транслитерацию", fn:"isGoodMatchFlex" },
  { id:24, layer:"проверка", text:"Без исполнителя каждый шаг обязан подтвердить ещё и название", inFn:"lookupTrack" },
  { id:25, layer:"проверка", text:"Название кандидата должно состоять только из слов файла — нового не выдумываем", fn:"tailOk" },
  { id:26, layer:"проверка", text:"Ремиксы, каверы, караоке и мэшапы не принимаются, если их нет в запросе", const:"SUSPICIOUS" },
  { id:27, layer:"проверка", text:"Кредит файла сохраняется, только если лишний участник значимый (не артикль the)", fn:"creditGaps" },
  { id:28, layer:"проверка", text:"Строчный кредит в файле не переопределяет написание каталога", inFn:"lookupTrack" },

  /* --- вывод --- */
  { id:29, layer:"вывод",  text:"Имя всегда «Исполнитель - Название», нумерация появляется только при перемешивании", fn:"makeName" },
  { id:30, layer:"вывод",  text:"Запрещённые в Windows символы, длина и имена CON/PRN/COM1 защищены", fn:"safeNamePart" },
  { id:31, layer:"вывод",  text:"Совпадение имён разводится суффиксом « (2)»", inFn:"startRename" },
  { id:32, layer:"вывод",  text:"Если данных нет — имя файла не меняется, заглушки не подставляются", fn:"isUnknownInfo" },
  { id:33, layer:"вывод",  text:"ID3 перезаписывается (TIT2, TPE1, TRCK), прочие кадры сохраняются", fn:"buildId3v24Tag" },
  { id:34, layer:"вывод",  text:"Несколько кандидатов: лучший применяется сразу, остальные доступны по кнопке ⇄", fn:"altsFor" },
  { id:35, layer:"запрос", text:"Числа-порядковые разворачиваются в слова: «на 5-м этаже» → «на пятом этаже»", fn:"expandOrdinals" },
  { id:36, layer:"запрос", text:"Если в исполнителя попал кусок названия — вся фраза ищется как название (без дублей транслита)", fn:"phraseTitle" },
  { id:37, layer:"запрос", text:"Короткий латинский обрубок в начале имени срезается при поиске («Var Би-2» → «Би-2»); роли DJ/MC/TV не трогаются", fn:"dropJunkPrefix" },
  { id:38, layer:"запрос", text:"Префиксный перебор: первые 4–6 слов фразы, кредит «feat» из запроса убирается", fn:"stripFeatCredit" },
  { id:39, layer:"проверка", text:"Если в файле есть пометка версии (remix/live/radio), допуск по длительности расширяется до 60 с", const:"DUR_TOL_EXACT" },
  { id:40, layer:"вывод",  text:"Хвост версии из исходной фразы сохраняется в названии: (Get Better Radio Remix)", fn:"versionTail" },
  { id:41, layer:"запрос", text:"Если название — языковой огрызок (eng/rus), пробуем того же исполнителя и перевёрнутый порядок слов", inFn:"lookupTrack" },
  { id:42, layer:"проверка", text:"Ручная правка и выбранный вариант запоминаются по имени файла и применяются без интернета", fn:"memGet" }
];
/* Доступ к реестру для проверок и отладки */
if(typeof window !== "undefined") window.__ashuffleRules = function(){ return RULES; };
function ext(n){var m=n.match(/\.([^.]+)$/);return m?m[1].toLowerCase():""}
function norm(s){
  if(!s) return "";
  var t = s.normalize ? s.normalize("NFKD") : s;
  /* Диакритика: «mêmes» = «memes», «Tiësto» = «Tiesto», «ñ» = «n» */
  if(t.normalize) t = t.replace(/[\u0300-\u036f]/g, "");
  return t.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g," ");
}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function fmtSize(b){if(b<1024)return b+" Б";if(b<1048576)return (b/1024).toFixed(1)+" КБ";return (b/1048576).toFixed(1)+" МБ"}
function fmtDur(s){var t=Math.round(s||0),m=Math.floor(t/60),r=t%60;return m+":"+(r<10?"0":"")+r}
function theme(t){
  if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");$("tt").textContent="☀️"}
  else{document.documentElement.removeAttribute("data-theme");$("tt").textContent="🌙"}
  try{ localStorage.setItem("ashuffle-theme", t==="dark" ? "dark" : "light"); }catch(e){}
}

