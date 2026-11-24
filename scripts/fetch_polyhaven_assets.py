#!/usr/bin/env python3
"""Download a small Poly Haven CC0 glTF asset for ILOX's static build."""
import json
import os
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "nature" / "boulder_01"
API = "https://api.polyhaven.com/files/boulder_01"
MAX_BYTES = 14_000_000
UA = "ILOX-AssetBuilder/0.1 (free CC0 game asset pipeline)"

def request_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=90) as response:
        return response.read()

def walk_files(node, path=()):
    if not isinstance(node, dict):
        return
    if isinstance(node.get("url"), str):
        yield (path, node)
    for key, value in node.items():
        if isinstance(value, dict):
            yield from walk_files(value, path + (str(key),))

def safe_extract(archive, destination):
    base = destination.resolve()
    with zipfile.ZipFile(archive) as zf:
        for item in zf.infolist():
            target = (destination / item.filename).resolve()
            if target == base or base in target.parents:
                zf.extract(item, destination)

def download_includes(record, destination):
    includes = record.get("include")
    if not isinstance(includes, dict):
        return
    for name, item in includes.items():
        if not isinstance(item, dict) or not isinstance(item.get("url"), str):
            continue
        relative = Path(str(name))
        if relative.is_absolute() or ".." in relative.parts:
            continue
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(request_bytes(item["url"]))

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for child in list(OUT.iterdir()):
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()

    data = json.loads(request_bytes(API).decode("utf-8"))
    candidates = []
    for path, record in walk_files(data):
        joined = "/".join(path).lower()
        url = record["url"]
        suffix = Path(urlparse(url).path).suffix.lower()
        if "gltf" not in joined or suffix not in (".zip", ".gltf", ".glb"):
            continue
        size = int(record.get("size") or 0)
        if size and size > MAX_BYTES:
            continue
        candidates.append((0 if "1k" in joined else 1, size or MAX_BYTES, path, record, suffix))

    if not candidates:
        raise RuntimeError("Poly Haven no ofreció una variante glTF/GLB de 1K dentro del límite de 14 MB.")
    candidates.sort(key=lambda x: (x[0], x[1]))
    _, _, path, record, suffix = candidates[0]

    with tempfile.TemporaryDirectory() as temp:
        temp_file = Path(temp) / ("asset" + suffix)
        temp_file.write_bytes(request_bytes(record["url"]))
        if zipfile.is_zipfile(temp_file):
            safe_extract(temp_file, OUT)
        else:
            shutil.copy2(temp_file, OUT / temp_file.name)
            download_includes(record, OUT)

    models = list(OUT.rglob("*.glb")) + list(OUT.rglob("*.gltf"))
    if not models:
        raise RuntimeError("El paquete descargado no contiene un archivo .glb o .gltf.")
    models.sort(key=lambda p: (p.suffix != ".glb", len(p.parts), str(p)))
    model = models[0]
    manifest = {
        "available": True,
        "asset": "Boulder 01",
        "source": "Poly Haven",
        "license": "CC0",
        "file": model.relative_to(OUT).as_posix(),
        "bytes": sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file()),
        "api_variant": "/".join(path),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Poly Haven CC0 asset ready:", json.dumps(manifest))

if __name__ == "__main__":
    main()
