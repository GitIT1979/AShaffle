# AShuffle Desktop (Windows)

Десктопная сборка AShuffle: тот же код, что и в `AShaffle_HTML/`, запакованный
в одно окно через WebView2 (pywebview).

## Запуск

Готовый файл: `dist/AShaffle_desktop.exe` — самодостаточный, веб-ресурсы
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
pyinstaller --onefile --windowed --name AShaffle_desktop --clean --add-data "..\AShaffle_HTML;web" app.py
```

## Структура

- `app.py` — локальный сервер + окно webview; в собранном exe берёт ресурсы
  из распаковки (`sys._MEIPASS/web`), в исходниках — из `../AShaffle_HTML`
- `build.bat` — команда сборки
- `dist/AShaffle_desktop.exe` — готовая сборка
