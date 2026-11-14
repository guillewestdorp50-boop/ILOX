from pathlib import Path
import sys

root = Path(sys.argv[1])
engine_path = root / "src/core/Engine.ts"
main_path = root / "src/main.ts"

def replace_once(path, old, new):
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Patch no encontrado en {path}: {old[:90]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")

# Convertir la base de naturaleza en un mundo natural de ILOX:
# retirar dron, efigie, cristales y obelisco, conservando terreno, bosque,
# pasto, rocas, troncos, atmósfera y audio ambiental.
replace_once(engine_path,
    "import { createLandmarks } from '../world/Landmarks';\n", "")
replace_once(engine_path,
    "import { Drone } from '../world/Drone';\n", "")
replace_once(engine_path,
    "  private drone!: Drone;\n", "")
replace_once(engine_path,
    "    const q = new URLSearchParams(location.search).get('q') ?? 'med';",
    "    const touchDevice = window.matchMedia('(pointer: coarse)').matches;\n    const q = new URLSearchParams(location.search).get('q') ?? (touchDevice ? 'low' : 'med');")
replace_once(engine_path,
    "    await createLandmarks(this.field, this.scene, colliders);\n    this.drone = new Drone(this.scene, this.field);\n", "")
replace_once(engine_path,
    "    this.drone.update(dt, t, p);\n", "")

# Controles táctiles: joystick virtual + arrastre para mirar.
replace_once(main_path,
    "const loadText = document.getElementById('loadtext')!;\n",
    "const loadText = document.getElementById('loadtext')!;\nconst coarsePointer = window.matchMedia('(pointer: coarse)').matches;\n")
replace_once(main_path,
    "  playBtn.addEventListener('click', () => {\n    engine.startAudio();\n    canvas.requestPointerLock();\n  });",
    """  playBtn.addEventListener('click', () => {
    engine.startAudio();
    if (coarsePointer) {
      engine.setPlaying(true);
      overlay.classList.add('hidden');
      document.body.classList.add('playing');
    } else {
      canvas.requestPointerLock();
    }
  });""")
replace_once(main_path,
    "  engine.start();",
    """  if (coarsePointer) {
    const joystick = document.getElementById('joystick');
    const stick = document.getElementById('stick');
    const touchUi = document.getElementById('touch-ui');
    const activeKeys = new Set<string>();
    let joyPointer: number | null = null;
    let lookPointer: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const key = (code: string, down: boolean) => {
      if (down && !activeKeys.has(code)) {
        activeKeys.add(code);
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      } else if (!down && activeKeys.has(code)) {
        activeKeys.delete(code);
        window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      }
    };
    const releaseMove = () => {
      for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) key(code, false);
      if (stick) stick.style.transform = 'translate(0px, 0px)';
    };

    joystick?.addEventListener('pointerdown', (event) => {
      if (!document.body.classList.contains('playing')) return;
      event.preventDefault();
      event.stopPropagation();
      joyPointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      updateJoystick(event);
    });
    const updateJoystick = (event: PointerEvent) => {
      if (!joystick || event.pointerId !== joyPointer) return;
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = rect.width * 0.34;
      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const length = Math.hypot(dx, dy);
      if (length > radius) { dx = dx / length * radius; dy = dy / length * radius; }
      if (stick) stick.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
      key('KeyW', dy < -radius * 0.22);
      key('KeyS', dy > radius * 0.22);
      key('KeyA', dx < -radius * 0.22);
      key('KeyD', dx > radius * 0.22);
    };
    joystick?.addEventListener('pointermove', updateJoystick);
    const endJoystick = (event: PointerEvent) => {
      if (event.pointerId !== joyPointer) return;
      joyPointer = null;
      releaseMove();
    };
    joystick?.addEventListener('pointerup', endJoystick);
    joystick?.addEventListener('pointercancel', endJoystick);
    joystick?.addEventListener('lostpointercapture', endJoystick);

    document.addEventListener('pointerdown', (event) => {
      if (!document.body.classList.contains('playing')) return;
      if (joystick?.contains(event.target as Node)) return;
      if (event.target instanceof HTMLElement && event.target.closest('button')) return;
      lookPointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
    });
    document.addEventListener('pointermove', (event) => {
      if (event.pointerId !== lookPointer) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      window.dispatchEvent(new MouseEvent('mousemove', {
        movementX: dx * 1.25,
        movementY: dy * 1.25
      }));
    });
    const endLook = (event: PointerEvent) => {
      if (event.pointerId === lookPointer) lookPointer = null;
    };
    document.addEventListener('pointerup', endLook);
    document.addEventListener('pointercancel', endLook);
    void touchUi;
  }

  engine.start();""")

# Evitar que el gesto táctil desplace la página o active zoom mientras se juega.
(root / "index.html").write_text(Path("ilox-forest-index.html").read_text(encoding="utf-8"), encoding="utf-8")
(root / "ilox.css").write_text(Path("ilox-forest.css").read_text(encoding="utf-8"), encoding="utf-8")
print("Base The Forest adaptada a ILOX; controles móviles instalados.")