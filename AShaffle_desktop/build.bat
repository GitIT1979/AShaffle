@echo off
rem Сборка AShuffle.exe — десктопной оболочки AShuffle для Windows.
rem Результат: AShuffle.exe рядом с build.bat (самодостаточный, веб-ресурсы внутри).
rem Требования: Python 3.10+ (python в PATH), Windows 10/11 с WebView2.
cd /d "%~dp0"
python -m pip install pywebview pyinstaller
pyinstaller --onefile --windowed --name AShuffle --clean ^
  --distpath . ^
  --add-data "..\AShaffle_HTML;web" ^
  app.py
echo.
echo Готово: AShuffle.exe
pause
