# -*- coding: utf-8 -*-
"""AShuffle — десктопная оболочка для Windows.

Поднимает локальный сервер с файлами AShaffle_HTML и открывает окно
на его адресе. Возможности те же, что у HTML-версии: контекст 127.0.0.1 —
безопасный, поэтому работают «Сохранить все в папку», выбор ZIP-файла
и сетевые запросы к Deezer, iTunes и MusicBrainz.

Запуск из исходников:  python app.py   (нужен pywebview: см. build.bat)
Сборка exe:            build.bat       (pyinstaller, exe появится рядом с build.bat)
"""
import http.server
import os
import socket
import socketserver
import sys
import tempfile
import threading
import time
import traceback

try:
    import webview
except ImportError:
    sys.exit("Не установлен pywebview. Выполните: python -m pip install pywebview pyinstaller")

APP_NAME = "AShuffle"
INDEX = "AShaffle.html"
PORT_RANGE = range(8123, 8133)


def log(msg):
    try:
        with open(os.path.join(tempfile.gettempdir(), "ashuffle_desktop.log"),
                  "a", encoding="utf-8") as f:
            f.write(time.strftime("%H:%M:%S ") + msg + "\n")
    except Exception:
        pass


def _hook(exc_type, exc, tb):
    log("UNCAUGHT: " + "".join(traceback.format_exception(exc_type, exc, tb)))
    sys.__excepthook__(exc_type, exc, tb)


sys.excepthook = _hook


def web_root():
    # Собранный exe: ресурсы лежат внутри временной распаковки pyinstaller
    base = getattr(sys, "_MEIPASS", None)
    if base and os.path.isdir(os.path.join(base, "web")):
        return os.path.join(base, "web")
    # Запуск из исходников: AShaffle_HTML на уровень выше этой папки
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "AShaffle_HTML")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.abspath(web_root()), **kwargs)

    def log_message(self, *args):
        pass


def main():
    root = os.path.abspath(web_root())
    log("старт: web_root=%s __file__=%s _MEIPASS=%s" % (root, __file__, getattr(sys, "_MEIPASS", None)))
    if not os.path.isfile(os.path.join(root, INDEX)):
        sys.exit("Не найден %s рядом с %s" % (INDEX, root))

    socketserver.TCPServer.allow_reuse_address = True
    httpd = None
    for port in PORT_RANGE:
        # bind сам по себе не гарантирует, что порт свободен: Windows разрешает
        # двойной bind с SO_REUSEADDR (например, рядом работает python -m http.server).
        # Поэтому занятость проверяем пробным подключением.
        probe = socket.socket()
        try:
            probe.settimeout(0.5)
            busy = probe.connect_ex(("127.0.0.1", port)) == 0
        finally:
            probe.close()
        if busy:
            log("порт %d занят другим процессом, ищу дальше" % port)
            continue
        try:
            httpd = socketserver.TCPServer(("127.0.0.1", port), Handler)
            log("порт выбран: %d" % port)
            break
        except OSError as e:
            log("порт %d недоступен: %s" % (port, e))
            continue
    if httpd is None:
        sys.exit("Не удалось занять ни один порт %d–%d" % (PORT_RANGE.start, PORT_RANGE.stop - 1))

    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d/%s" % (httpd.server_address[1], INDEX)
    log("сервер: " + url)
    try:
        webview.create_window(APP_NAME, url, width=1024, height=800, min_size=(640, 480))
        log("окно создано, webview.start()…")
        webview.start()
        log("webview завершён штатно")
    except Exception:
        log("WEBVIEW ERROR: " + traceback.format_exc())
        raise
    httpd.shutdown()


if __name__ == "__main__":
    main()
