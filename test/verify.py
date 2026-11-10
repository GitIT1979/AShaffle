"""Проверяет артефакты стенда: ZIP и ID3-теги после перезаписи."""
import json
import os
import sys
import zipfile

from mutagen.id3 import ID3

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tmp")
AUDIO = open(os.path.join(BASE, "audio.bin"), "rb").read()
COVER = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
errors = []


def check(cond, msg):
    if not cond:
        errors.append(msg)


def payload(path):
    data = open(path, "rb").read()
    return data[ID3(path).size:]


# ---------- ZIP ----------
with zipfile.ZipFile(os.path.join(BASE, "test.zip")) as z:
    check(z.testzip() is None, "zip: повреждённые данные")
    names = z.namelist()
    expected = json.load(open(os.path.join(BASE, "zip-expected.json"), encoding="utf-8"))
    check(names == expected, f"zip: имена {names} != {expected}")
    for name in expected:
        want = open(os.path.join(BASE, "zip", name), "rb").read()
        check(z.read(name) == want, f"zip: содержимое {name} не совпало")
        info = z.getinfo(name)
        check(info.date_time[0] >= 2020, f"zip: дата у {name} = {info.date_time}")

# ---------- ID3 ----------
cases = {
    "out1.mp3": dict(artist="New Ärtist", title="New Title", track="5"),
    "out2.mp3": dict(artist="Second", title="No Tag", track="6"),
    "out3.mp3": dict(artist="Third", title="Old v22", track="7"),
    "out4.mp3": dict(artist="Fourth", title="Old v24", track="8"),
}
for name, want in cases.items():
    path = os.path.join(BASE, "out", name)
    if not os.path.exists(path):
        errors.append(f"{name}: файл не создан")
        continue
    tag = ID3(path)
    check(tag.version[:2] == (2, 4), f"{name}: версия тега {tag.version}")
    check(str(tag["TIT2"]) == want["title"], f"{name}: TIT2 = {tag['TIT2']!r}")
    check(str(tag["TPE1"]) == want["artist"], f"{name}: TPE1 = {tag['TPE1']!r}")
    check(str(tag["TRCK"]) == want["track"], f"{name}: TRCK = {tag['TRCK']!r}")
    check(payload(path) == AUDIO, f"{name}: аудиоданные изменились")

# обложка и альбом должны пережить перезапись (v2.3 и v2.4 источники)
for name in ("out1.mp3", "out4.mp3"):
    tag = ID3(os.path.join(BASE, "out", name))
    check("TALB" in tag and str(tag["TALB"]) == "Album X", f"{name}: альбом потерян")
    apic = [k for k in tag.keys() if k.startswith("APIC")]
    check(bool(apic), f"{name}: обложка потеряна")
    if apic:
        check(tag[apic[0]].data == COVER, f"{name}: обложка повреждена")
    check(sum(1 for k in tag.keys() if k.startswith("TALB")) == 1, f"{name}: дубль TALB")

# из v2.2 переносить нечего, но старый тег не должен остаться в аудиоданных
out3 = open(os.path.join(BASE, "out", "out3.mp3"), "rb").read()
check(b"Old Song" not in out3, "out3: обрывки ID3v2.2 остались в файле")

if errors:
    print("ПРОВАЛЕНО:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("ZIP и ID3 в порядке")
