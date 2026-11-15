from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1])
source = Path(__file__).resolve().parents[1] / "ilox-src"
engine_path = root / "src/core/Engine.ts"
audio_path = root / "src/audio/AudioSystem.ts"
trees_path = root / "src/world/Trees.ts"

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

# Abrir cuatro praderas amplias entre masas de bosque. El núcleo de cada claro
# queda libre de árboles y la densidad cae gradualmente en su borde, sin crear
# cortes geométricos ni modificar el relieve, el pasto o los senderos.
replace_once(trees_path,
             "  const up = new THREE.Vector3(0, 1, 0);\n",
             """  const up = new THREE.Vector3(0, 1, 0);

  const clearings = [
    { x: 0, z: 140, rx: 82, rz: 70, feather: 26 },
    { x: 112, z: 10, rx: 70, rz: 56, feather: 24 },
    { x: -145, z: 132, rx: 68, rz: 52, feather: 22 },
    { x: 72, z: -148, rx: 58, rz: 46, feather: 20 }
  ];

  const meadowOpenness = (x: number, z: number): number => {
    let openness = 0;
    for (const clearing of clearings) {
      const distance = Math.hypot(
        (x - clearing.x) / clearing.rx,
        (z - clearing.z) / clearing.rz
      );
      const edge = 1 + clearing.feather / Math.min(clearing.rx, clearing.rz);
      const open = 1 - THREE.MathUtils.smoothstep(distance, 1, edge);
      openness = Math.max(openness, open);
    }
    return openness;
  };
""")
replace_once(trees_path,
             "    if (Math.abs(x) > margin || Math.abs(z) > margin) return false;\n",
             "    if (Math.abs(x) > margin || Math.abs(z) > margin) return false;\n    if (meadowOpenness(x, z) > 0.9) return false;\n")
replace_once(trees_path,
             """  // Árboles "héroe" que replican la composición de la referencia.
  place(0, -22, 102, 1.65, 6); // gran árbol a la izquierda
  place(1, 26, 52, 1.45, 6); // árbol medio a la derecha
  place(3, -4, 62, 1.15, 6); // árbol seco al centro
  place(2, 17, 118, 1.35, 6); // árbol cercano a la derecha del sendero
""",
             """  // Árboles de referencia ubicados en los bordes de las praderas,
  // para enmarcar el paisaje sin encerrar al jugador al comenzar.
  place(0, -110, 80, 1.65, 7);
  place(1, 185, -20, 1.45, 7);
  place(3, -220, -5, 1.15, 7);
  place(2, 150, -220, 1.35, 7);
""")
replace_once(trees_path,
             "    const density = fbm2(x * 0.008 + 50, z * 0.008 + 20, 3, 91);",
             "    const density = fbm2(x * 0.008 + 50, z * 0.008 + 20, 3, 91) * (1 - meadowOpenness(x, z) * 0.96);")

player_dir = root / "src/player"
player_dir.mkdir(parents=True, exist_ok=True)
shutil.copy2(source / "ILOXAvatar.ts", player_dir / "ILOXAvatar.ts")
shutil.copy2(source / "ThirdPersonController.ts", player_dir / "ThirdPersonController.ts")
shutil.copy2(source / "main.ts", root / "src/main.ts")
shutil.copy2(source.parent / "ilox-forest-index.html", root / "index.html")
shutil.copy2(source.parent / "ilox-forest.css", root / "ilox.css")
shutil.copy2(source.parent / "manifest.webmanifest", root / "public/manifest.webmanifest")

for unused in ("efigie.bin", "crystal_a.bin", "crystal_b.bin"):
    asset = root / "public/models" / unused
    if asset.exists():
        asset.unlink()

print("The Forest integrado con el avatar ILOX animado, controles en tercera persona y cuatro praderas abiertas entre zonas de bosque.")
