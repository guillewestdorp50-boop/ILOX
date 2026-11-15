from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1])
source = Path(__file__).resolve().parents[1] / "ilox-src"
engine_path = root / "src/core/Engine.ts"
audio_path = root / "src/audio/AudioSystem.ts"

def replace_once(path, old, new):
    value = path.read_text(encoding="utf-8")
    if old not in value:
        raise SystemExit(f"Patch no encontrado en {path}: {old[:100]!r}")
    path.write_text(value.replace(old, new, 1), encoding="utf-8")

# Conservar el mundo The Forest y retirar solo sus elementos de ciencia ficción.
replace_once(engine_path, "import { Heightfield, SPAWN } from '../world/heightfield';",
             "import { Heightfield } from '../world/heightfield';")
replace_once(engine_path, "import { createLandmarks } from '../world/Landmarks';\n", "")
replace_once(engine_path, "import { Drone } from '../world/Drone';\n", "")
replace_once(engine_path, "import { FirstPersonController } from '../player/FirstPersonController';",
             "import { ThirdPersonController } from '../player/ThirdPersonController';\nimport { ILOXAvatar } from '../player/ILOXAvatar';")
replace_once(engine_path, "  private controller!: FirstPersonController;",
             "  private controller!: ThirdPersonController;\n  private avatar!: ILOXAvatar;")
replace_once(engine_path, "  private drone!: Drone;\n", "")
replace_once(engine_path,
             "    const q = new URLSearchParams(location.search).get('q') ?? 'med';",
             "    const touchDevice = window.matchMedia('(pointer: coarse)').matches;\n    const q = new URLSearchParams(location.search).get('q') ?? (touchDevice ? 'low' : 'med');")
replace_once(engine_path,
             "    await createLandmarks(this.field, this.scene, colliders);\n    this.drone = new Drone(this.scene, this.field);\n",
             "")
replace_once(engine_path,
             "    this.controller = new FirstPersonController(this.camera, this.field, colliders, SPAWN);\n    this.audio = new AudioSystem(this.field, this.controller);",
             "    this.avatar = new ILOXAvatar('man');\n    this.scene.add(this.avatar.group);\n    this.controller = new ThirdPersonController(this.camera, this.field, colliders, this.avatar);\n    this.audio = new AudioSystem(this.field, this.controller);")
replace_once(engine_path, "    this.controller.enabled = playing;",
             "    this.controller.setEnabled(playing);")
replace_once(engine_path,
             "  /** Arranca el audio; debe invocarse desde un gesto del usuario (clic). */",
             "  setMoveInput(x: number, y: number): void {\n    this.controller.setMoveInput(x, y);\n  }\n\n  look(dx: number, dy: number): void {\n    this.controller.look(dx, dy);\n  }\n\n  /** Arranca el audio; debe invocarse desde un gesto del usuario (clic). */")
replace_once(engine_path, "    this.drone.update(dt, t, p);\n", "")

# Mantener el audio ambiental usando la interfaz pública del nuevo controlador.
replace_once(audio_path,
             "import { FirstPersonController } from '../player/FirstPersonController';",
             "import { ThirdPersonController } from '../player/ThirdPersonController';")
replace_once(audio_path, "private readonly controller: FirstPersonController",
             "private readonly controller: ThirdPersonController")

player_dir = root / "src/player"
player_dir.mkdir(parents=True, exist_ok=True)
shutil.copy2(source / "ILOXAvatar.ts", player_dir / "ILOXAvatar.ts")
shutil.copy2(source / "ThirdPersonController.ts", player_dir / "ThirdPersonController.ts")
shutil.copy2(source / "main.ts", root / "src/main.ts")
shutil.copy2(root / "ilox-forest-index.html", root / "index.html")
shutil.copy2(root / "ilox-forest.css", root / "ilox.css")
shutil.copy2(root / "manifest.webmanifest", root / "public/manifest.webmanifest")

for unused in ("efigie.bin", "crystal_a.bin", "crystal_b.bin"):
    asset = root / "public/models" / unused
    if asset.exists():
        asset.unlink()

print("The Forest integrado con el avatar ILOX animado y movimiento real en tercera persona.")
