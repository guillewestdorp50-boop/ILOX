from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1])
source = Path(__file__).resolve().parents[1] / "ilox-src"
engine_path = root / "src/core/Engine.ts"
audio_path = root / "src/audio/AudioSystem.ts"
sky_path = root / "src/world/SkyEnv.ts"

def replace_once(path, old, new):
    value = path.read_text(encoding="utf-8")
    if old not in value:
        raise SystemExit(f"Patch no encontrado en {path}: {old[:100]!r}")
    path.write_text(value.replace(old, new, 1), encoding="utf-8")

# Conservar el mundo The Forest y retirar solo sus elementos de ciencia ficción.
replace_once(engine_path, "import { Heightfield, SPAWN } from '../world/heightfield';",
             "import { Heightfield } from '../world/heightfield';")

# Limitar el alcance de renderizado del mundo a 300 metros.
# Three.js recorta la geometría fuera del plano lejano de cámara.
replace_once(engine_path,
             """    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );""",
             """    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );""")
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
# Reducir el pasto alto un 98,7 % en todos los perfiles de calidad.
# Se conserva el terreno y su textura; se reducen las instancias reales de matas.
replace_once(engine_path,
             "  low: { grassCount: 45000, shadowMapSize: 2048, pixelRatioCap: 1.25 },\n  med: { grassCount: 130000, shadowMapSize: 3072, pixelRatioCap: 1.6 },\n  high: { grassCount: 220000, shadowMapSize: 4096, pixelRatioCap: 2 }",
             "  low: { grassCount: 585, shadowMapSize: 2048, pixelRatioCap: 1.25 },\n  med: { grassCount: 1690, shadowMapSize: 3072, pixelRatioCap: 1.6 },\n  high: { grassCount: 2860, shadowMapSize: 4096, pixelRatioCap: 2 }")

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
             "  setMoveInput(x: number, y: number): void {\n    this.controller.setMoveInput(x, y);\n  }\n\n  setSprintInput(active: boolean): void {\n    this.controller.setSprintInput(active);\n  }\n\n  look(dx: number, dy: number): void {\n    this.controller.look(dx, dy);\n  }\n\n  /** Arranca el audio; debe invocarse desde un gesto del usuario (clic). */")
replace_once(engine_path, "    this.drone.update(dt, t, p);\n", "")


# Reducir la huella gráfica de calles/senderos un 87,7 %.
# Se conserva la ruta en el terreno, pero la franja despejada queda al 12,3 %
# de su ancho anterior, dejando más suelo natural visible.
heightfield_path = root / "src/world/heightfield.ts"
replace_once(heightfield_path,
             """        const wide = smooth(18, 45, h) * 1.5;
        const pd = distToPath(x, z);
        m *= smooth(0.7 + wide, 1.9 + wide * 2.2, pd);""",
             """        const wide = smooth(18, 45, h) * 1.5 * 0.123;
        const pd = distToPath(x, z);
        m *= smooth((0.7 + wide) * 0.123, (1.9 + wide * 2.2) * 0.123, pd);""")

# Aligerar el cielo conservando su domo, color, sol y nubes.
# El shader original evalúa 7 campos FBM de 4 octavas por píxel (28 muestras
# de ruido). La versión móvil usa 2 muestras simples: ~92,9 % menos trabajo
# de ruido por píxel, sin eliminar el cielo ni las nubes.
replace_once(sky_path,
             """          float alpha = cloudField(q, uTime, 0.14);
          // Erosión fina en los bordes para que no queden "de algodón".
          alpha *= 0.8 + 0.35 * csnoise((q + csWind(uTime)) * 3.3 + 5.0);
          if (alpha <= 0.004) discard;

          // Bases sombreadas: densidad muestreada desplazada hacia el sol.
          vec2 sunOffs = normalize(uSunDir.xz + vec2(1e-4)) * 0.14;
          float dens = cloudField(q, uTime, 0.35);
          float densSun = cloudField(q + sunOffs, uTime, 0.35);
          float lit = clamp(0.95 + (dens - densSun) * 1.5, 0.7, 1.3);
          vec3 col = mix(vec3(0.62, 0.66, 0.74), vec3(1.12, 1.1, 1.05), clamp(lit, 0.0, 1.0));
          col += vec3(1.0, 0.95, 0.85) * max(lit - 1.0, 0.0);

          // Borde plateado alrededor del sol.
          col += vec3(0.35, 0.3, 0.22) * pow(max(dot(dir, uSunDir), 0.0), 12.0) * alpha;

          // Hacia el horizonte se funden con la bruma.
          col = mix(vec3(0.85, 0.9, 0.97), col, hor);

          gl_FragColor = vec4(col, alpha * hor * 0.94);""",
             """          vec2 drift = q + vec2(uTime * 0.0012, uTime * 0.0006);
          float n1 = csnoise(drift * 1.7);
          float n2 = csnoise(drift * 0.83 + 13.4);
          float alpha = smoothstep(0.49, 0.68, n1 * 0.72 + n2 * 0.28);
          if (alpha <= 0.004) discard;

          // Nubes suaves y claras: se conserva el cielo, con sombreado sencillo.
          vec3 col = mix(vec3(0.68, 0.74, 0.83), vec3(1.0, 0.98, 0.94), 0.55 + 0.45 * n1);
          col += vec3(0.16, 0.13, 0.09) * pow(max(dot(dir, uSunDir), 0.0), 12.0);
          col = mix(vec3(0.85, 0.9, 0.97), col, hor);
          gl_FragColor = vec4(col, alpha * hor * 0.82);""")

# Mantener el audio ambiental usando la interfaz pública del nuevo controlador.
replace_once(audio_path,
             "import { FirstPersonController } from '../player/FirstPersonController';",
             "import { ThirdPersonController } from '../player/ThirdPersonController';")
replace_once(audio_path, "private readonly controller: FirstPersonController",
             "private readonly controller: ThirdPersonController")

# Unificar las pisadas: mismo sonido en pasto, tierra, piedra y senderos.
# Quitar el roce de hierba y cualquier cambio de timbre según la superficie.
replace_once(audio_path, "  private rustleGain!: GainNode;\\n", "")
replace_once(audio_path,
             """    const rustleSrc = ctx.createBufferSource();
    rustleSrc.buffer = this.noiseBuf;
    rustleSrc.loop = true;
    const rustleHp = ctx.createBiquadFilter();
    rustleHp.type = 'highpass';
    rustleHp.frequency.value = 2400;
    this.rustleGain = ctx.createGain();
    this.rustleGain.gain.value = 0;
    rustleSrc.connect(rustleHp).connect(this.rustleGain).connect(this.master);
    rustleSrc.start();

""", "")
replace_once(audio_path,
             """    const grassMask = this.field.sampleMask(pos.x, pos.z);

    // Roce del pasto al avanzar entre hierba alta.
    const rustleTarget =
      grassMask > 0.4 && this.controller.isGrounded
        ? THREE.MathUtils.clamp(speed / 7.5, 0, 1) * 0.16
        : 0;
    this.rustleGain.gain.setTargetAtTime(rustleTarget, ctx.currentTime, 0.12);

    // Pasos por distancia recorrida.
    if (this.controller.isGrounded && speed > 0.6) {
      this.stepAccum += dist;
      const stride = 1.55 + speed * 0.12;
      if (this.stepAccum >= stride) {
        this.stepAccum = 0;
        this.playStep(speed, grassMask);
      }
    } else {
      this.stepAccum = Math.min(this.stepAccum, 1.2);
    }

    // Aterrizaje tras un salto o caída.
    if (this.controller.landingSpeed > 3.5) {
      this.playStep(this.controller.landingSpeed * 1.6, grassMask, true);
    }
""",
             """    // Único sonido de pasos: no depende del material ni añade roce de hierba.
    if (this.controller.isGrounded && speed > 0.6) {
      this.stepAccum += dist;
      const stride = 1.55 + speed * 0.12;
      if (this.stepAccum >= stride) {
        this.stepAccum = 0;
        this.playStep(speed);
      }
    } else {
      this.stepAccum = Math.min(this.stepAccum, 1.2);
    }
""")
replace_once(audio_path,
             """  private playStep(speed: number, grassMask: number, landing = false): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const onGrass = grassMask > 0.4;

    const g = ctx.createGain();
    const amp =
      (landing ? 0.34 : 0.14 + Math.min(speed / 8, 1) * 0.1) * (0.85 + Math.random() * 0.3);
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (landing ? 0.22 : 0.13));
    g.connect(this.master);

    // Golpe grave.
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const f0 = (landing ? 58 : 72) + Math.random() * 24;
    osc.frequency.setValueAtTime(f0 * 1.5, t);
    osc.frequency.exponentialRampToValueAtTime(f0, t + 0.07);
    const og = ctx.createGain();
    og.gain.value = onGrass ? 0.5 : 1.0;
    osc.connect(og).connect(g);
    osc.start(t);
    osc.stop(t + 0.16);

    // Crujido: banda alta en pasto, media en tierra.
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = onGrass ? 2100 + Math.random() * 900 : 620 + Math.random() * 260;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(onGrass ? 1.0 : 0.8, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(bp).connect(ng).connect(g);
    src.start(t, Math.random() * 1.2);
    src.stop(t + 0.14);
  }

""",
             """  private playStep(_speed: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    g.connect(this.master);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(132, t);
    osc.frequency.exponentialRampToValueAtTime(82, t + 0.07);
    const og = ctx.createGain();
    og.gain.value = 0.75;
    osc.connect(og).connect(g);
    osc.start(t);
    osc.stop(t + 0.16);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 850;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.7, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(bp).connect(ng).connect(g);
    src.start(t, 0.4);
    src.stop(t + 0.14);
  }

""")

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

print("The Forest integrado con el avatar ILOX animado y movimiento real en tercera persona.")
