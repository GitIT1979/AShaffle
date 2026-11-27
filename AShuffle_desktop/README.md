# AShuffle Desktop (Windows)

Десктопная сборка AShuffle: тот же код, что и в `AShuffle_HTML/`, запакованный
в одно окно через WebView2 (pywebview).

## Запуск

Готовый файл: `AShuffle.exe` в этой папке — самодостаточный, веб-ресурсы
внутри. При старте поднимает локальный сервер на `127.0.0.1:8123` (дальше
по порядку, если порт занят) и открывает окно приложения.

Возможности те же, что у HTML-версии: проверка названий через Deezer, iTunes
и MusicBrainz, прослушивание, перемешивание, «Сохранить все в папку».

## Пересборка

```
build.bat
```

или вручную:

```
python -m pip install pywebview pyinstaller
pyinstaller --onefile --windowed --name AShuffle --clean --distpath . --add-data "..\AShuffle_HTML;web" app.py
```

## Структура

- `app.py` — локальный сервер + окно webview; в собранном exe берёт ресурсы
  из распаковки (`sys._MEIPASS/web`), в исходниках — из `../AShuffle_HTML`
- `build.bat` — команда сборки
- `AShuffle.exe` — готовая сборка (лежит в корне этой папки)
