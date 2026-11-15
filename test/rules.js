/* Пошаговые проверки реестра правил: одно правило — один случай.
   Каждая запись ссылается на id из RULES в AShaffle.html и должна давать true. */

module.exports = [
  { id: 1, name: "номер трека отрезается, число в названии остаётся", run: a =>
      a.stripTrackPrefix("01 - Intro") === "Intro" && a.stripTrackPrefix("99 Luftballons") === "99 Luftballons" },

  { id: 2, name: "префикс сайта срезан до чистки двойников", run: a =>
      a.stripNamePrefix("UYTДжанго") === "Джанго" && a.stripNamePrefix("KR Виктор Цой") === "Виктор Цой" },

  { id: 3, name: "латинские двойники внутри кириллицы", run: a =>
      a.foldMixed("Vиктор Цой") === "Виктор Цой" && a.foldMixed("Little Big") === "Little Big" },

  { id: 4, name: "диакритика не важна", run: a =>
      a.norm("Tous les mêmes") === a.norm("Tous Les Memes") && a.norm("Tiësto") === a.norm("Tiesto") },

  { id: 5, name: "сайты-водяные знаки вырезаны", run: a =>
      a.stripSiteJunk("Бесприданница (Sefon.Pro)") === "Бесприданница" },

  { id: 6, name: "шум в скобках не часть названия", run: a =>
      a.stripNoiseBrackets("Dusk Till Dawn [Radio Edit]") === "Dusk Till Dawn" &&
      a.stripNoiseBrackets("Song (Remastered 2011)") === "Song" },

  { id: 7, name: "дефисы вместо пробелов в имени", run: a =>
      a.splitGluedArtist("the-black-eyed-peas-j-balvin") === "the black eyed peas j balvin" &&
      a.splitGluedArtist("jay-z") === "jay-z" },

  { id: 8, name: "одиночная буква перед именем", run: a =>
      a.shaveGluedLetter("MДжанго") === "Джанго" && a.shaveGluedLetter("Джанго") === "" },

  { id: 9, name: "кредит из названия возвращается исполнителю", run: a => {
      const p = a.pullCreditFromTitle("g-eazy", "and halsey-him and i");
      return p && p.artist === "g-eazy and halsey" && p.title === "him and i";
    } },

  { id: 10, name: "заглушки не считаются исполнителем", run: a =>
      a.isPlaceholder("unknown_artist") && a.isPlaceholder("Unknown Artist") &&
      a.isPlaceholder("VA") && !a.isPlaceholder("Ava Max") },

  { id: 12, name: "словарь знает имя и связку", run: a =>
      a.aliasFor("technology") === "Технология" &&
      a.aliasSplit("korol", "i shut-dva druga").alias === "Король и Шут" },

  { id: 13, name: "строчное имя запрашивается с заглавной", run: a =>
      a.capitalizeArtist("жанго") === "Жанго" && a.capitalizeArtist("Moya") === "" },

  { id: 14, name: "артикль The возвращается", run: a =>
      a.keepArticle("Black Eyed Peas", "the black eyed peas j balvin") === "The Black Eyed Peas" &&
      a.keepArticle("Kesha", "kesha") === "Kesha" },

  { id: 17, name: "кириллические запросы капитализируются", run: a =>
      a.capWords("возвращайся") === "Возвращайся" && a.capWords("джанго егусева") === "Джанго Егусева" },

  { id: 21, name: "допуск по длительности", run: a =>
      a.durOk(200, 205000) && !a.durOk(200, 215000) && a.durOkExact(207.2, 187000) },

  { id: 22, name: "низкий балл отбрасывается", run: a => a.MIN_SCORE === 0.5 },

  { id: 23, name: "исполнитель сверяется с транслитерацией", run: a =>
      a.isGoodMatchFlex("Alians на заре", "Альянс", "На заре") &&
      !a.isGoodMatchFlex("Rick Astley Never Gonna Give You Up", "Dreadsquad", "Slumdog millionaire") },

  { id: 25, name: "название только из слов файла", run: a =>
      a.tailOk({ title: "На Заре" }, ["Alians", "Звуки", "на", "заре"]) &&
      !a.tailOk({ title: "Фальстарт" }, ["Alians", "Звуки", "на", "заре"]) },

  { id: 26, name: "ремикс не принимается без запроса", run: a =>      a.isGoodMatch("the black eyed peas j balvin ritmo", "Black Eyed Peas, J Balvin & SWACQ", "RITMO (Bad Boys For Life) [SWACQ Remix]") === false },

  { id: 27, name: "недостающий участник кредита виден", run: a =>
      a.creditGaps("G-Eazy", "g-eazy and halsey").join(",") === "halsey" &&
      a.creditGaps("G-Eazy & Halsey", "g-eazy and halsey").length === 0 },

  { id: 29, name: "имя всегда исполнитель - название", run: a =>
      a.makeName({ artist: "Виктор Цой", title: "Кукушка" }, ".mp3", null) === "Виктор Цой - Кукушка.mp3" &&
      a.makeName({ artist: "Виктор Цой", title: "Кукушка" }, ".mp3", 7) === "007 - Виктор Цой - Кукушка.mp3" },

  { id: 30, name: "запрещённые символы и служебные имена", run: a =>
      a.safeNamePart('AC/DC: "Live"') === "AC_DC_ _Live_" &&
      a.makeName({ artist: "CON", title: "x" }, ".mp3", null).indexOf("_CON") === 0 },

  { id: 32, name: "без данных имя не меняется", run: a =>
      a.isUnknownInfo({ artist: "unknown_artist", title: "unknown_track" }) &&
      !a.isUnknownInfo({ artist: "unknown_artist", title: "Medved" }) },

  { id: 34, name: "варианты: выбранный первым", run: a => {
      const l = [];
      a.altsPush(l, { artist: "25/17", title: "Холодная весна", source: "Deezer", score: 0.9 });
      a.altsPush(l, { artist: "Джанго", title: "Холодная весна", source: "Deezer", score: 0.85 });
      const out = a.altsFor({ artist: "25/17", title: "Холодная весна", source: "Deezer", score: 0.9 }, l, 186700);
      return out[0].artist === "25/17" && out[1].artist === "Джанго";
    } },

  { id: 35, name: "порядковые числа разворачиваются в слова", run: a =>
      a.expandOrdinals("на 5-м этаже") === "на пятом этаже" &&
      a.expandOrdinals("На 5-Ом Этаже") === "На пятом Этаже" &&
      a.expandOrdinals("1-й альбом") === "первый альбом" },

  { id: 36, name: "вся фраза как название, дубли транслита схлопнуты", run: a =>
      a.phraseTitle("Moya Моя Любовь На 5-Ом", "Этаже") === "Моя Любовь На пятом Этаже" },

  { id: 37, name: "латинский обрубок срезан, роли сохранены", run: a =>
      a.dropJunkPrefix("Var Би-2") === "Би-2" &&
      a.dropJunkPrefix("DJ Грув") === "" &&
      a.dropJunkPrefix("The Beatles") === "" &&
      a.dropJunkPrefix("Би-2") === "" },
];
