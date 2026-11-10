"""Готовит mp3-файлы с разными вариантами ID3 для проверки перезаписи тегов."""
import json
import os
import struct

from mutagen.id3 import ID3, APIC, TALB, TDRC, TIT2, TPE1, TRCK

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tmp")
os.makedirs(BASE, exist_ok=True)
AUDIO = bytes(range(256)) * 8  # 2048 байт «аудио»
COVER = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def syncsafe(n: int) -> bytes:
    return bytes([(n >> 21) & 0x7F, (n >> 14) & 0x7F, (n >> 7) & 0x7F, n & 0x7F])


def tagged(name: str, version: int) -> None:
    path = os.path.join(BASE, name)
    with open(path, "wb") as f:
        f.write(AUDIO)
    tag = ID3()
    tag.add(TIT2(encoding=3, text=["Old Title"]))
    tag.add(TPE1(encoding=3, text=["Old Artist"]))
    tag.add(TALB(encoding=3, text=["Album X"]))
    tag.add(TDRC(encoding=3, text=["2019"]))
    tag.add(TRCK(encoding=3, text=["12"]))
    tag.add(APIC(encoding=3, mime="image/png", type=3, desc="Cover", data=COVER))
    tag.save(path, v2_version=version)


def untagged(name: str) -> None:
    with open(os.path.join(BASE, name), "wb") as f:
        f.write(AUDIO)


def v22(name: str) -> None:
    """ID3v2.2 с кадром TT2 — такие теги нельзя переносить, но нужно целиком пропустить."""
    body = b"TT2" + struct.pack(">I", len(b"\x00Old Song"))[1:] + b"\x00Old Song"
    header = b"ID3\x02\x00\x00" + syncsafe(len(body))
    with open(os.path.join(BASE, name), "wb") as f:
        f.write(header + body + AUDIO)


tagged("in1.mp3", 3)
untagged("in2.mp3")
v22("in3.mp3")
tagged("in4.mp3", 4)

items = [
    {"src": "in1.mp3", "out": "out1.mp3", "num": 5, "artist": "New Ärtist", "title": "New Title"},
    {"src": "in2.mp3", "out": "out2.mp3", "num": 6, "artist": "Second", "title": "No Tag"},
    {"src": "in3.mp3", "out": "out3.mp3", "num": 7, "artist": "Third", "title": "Old v22"},
    {"src": "in4.mp3", "out": "out4.mp3", "num": 8, "artist": "Fourth", "title": "Old v24"},
]
with open(os.path.join(BASE, "inputs.json"), "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)

with open(os.path.join(BASE, "audio.bin"), "wb") as f:
    f.write(AUDIO)

print("fixtures ready:", ", ".join(i["src"] for i in items))
