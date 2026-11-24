from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[2]
source = root / "ilox-pwa" / "west-vill-logistica.jpg"
if not source.exists():
    raise SystemExit(f"Missing WEST-VILL icon source: {source}")

image = Image.open(source).convert("RGB")
image = ImageOps.fit(image, (512, 512), method=Image.Resampling.LANCZOS)
densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, size in densities.items():
    target = root / "west-vill-android" / "app" / "src" / "main" / "res" / f"mipmap-{density}" / "ic_launcher.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.Resampling.LANCZOS).save(target, format="PNG", optimize=True)
print("Generated WEST-VILL launcher icons.")
