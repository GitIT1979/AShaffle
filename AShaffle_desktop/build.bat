@echo off
rem Сборка AShaffle_desktop.exe — десктопной оболочки AShuffle для Windows.
rem Результат: AShaffle_desktop.exe рядом с build.bat (самодостаточный, веб-ресурсы внутри).
rem Требования: Python 3.10+ (python в PATH), Windows 10/11 с WebView2.
cd /d "%~dp0"
python -m pip install pywebview pyinstaller
pyinstaller --onefile --windowed --name AShaffle_desktop --clean ^
  --distpath . ^
  --add-data "..\AShaffle_HTML;web" ^
  app.py
echo.
echo Готово: AShaffle_desktop.exe
pause
