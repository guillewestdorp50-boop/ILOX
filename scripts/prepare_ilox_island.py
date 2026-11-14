#!/usr/bin/env python3
"""Adapt the pinned Island source into ILOX's natural-world exploration PWA."""
from pathlib import Path
import shutil
import sys
root = Path(sys.argv[1] if len(sys.argv) > 1 else "island-source")

def patch(path, old, new, label):
    p = root / path
    s = p.read_text(encoding="utf-8")
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected 1 match, found {n}")
    p.write_text(s.replace(old, new, 1), encoding="utf-8")

# Mobile-first performance profile: retain scanned assets, trim expensive passes and instance counts.
patch("src/core/quality.ts",
"  low: { renderScale: 0.7, shadowMap: 1024, cascades: 2, shadowFar: 140, ao: false, aoScale: 0.5, taa: true, bloom: true, density: 0.45, grassFar: 28, lodScale: 0.6, oceanSegments: 128, cloudSteps: 8, rainParticles: 4000 },",
"  low: { renderScale: 0.68, shadowMap: 512, cascades: 1, shadowFar: 90, ao: false, aoScale: 0.5, taa: false, bloom: false, density: 0.08, grassFar: 8, lodScale: 0.36, oceanSegments: 48, cloudSteps: 2, rainParticles: 150 },",
"mobile low preset")
patch("src/core/quality.ts",
"export const preset: Preset = forced && PRESETS.includes(forced) ? forced : params.test ? 'high' : Math.min(PRESETS.indexOf(guess(gpuName)), 2) >= 0 ? PRESETS[Math.min(PRESETS.indexOf(guess(gpuName)), 2)] : 'high';",
"const mobileDevice = typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600);\nexport const preset: Preset = forced && PRESETS.includes(forced) ? forced : mobileDevice ? 'low' : params.test ? 'high' : Math.min(PRESETS.indexOf(guess(gpuName)), 2) >= 0 ? PRESETS[Math.min(PRESETS.indexOf(guess(gpuName)), 2)] : 'high';",
"force mobile low")

# Reduce one-time canopy baking and disable the expensive post chain on mobile/low preset.
patch("src/veg/Canopy.ts",
"const BAKE = 2048;",
"const BAKE = Q.renderScale < 0.7 ? 1024 : 2048;",
"mobile canopy bake resolution")
patch("src/veg/Canopy.ts",
"  const CELLS = 512;",
"  const CELLS = Q.renderScale < 0.7 ? 256 : 512;",
"mobile canopy mesh density")
patch("src/veg/Canopy.ts",
"import { atmo } from '../sky/Atmosphere';",
"import { atmo } from '../sky/Atmosphere';\nimport { Q } from '../core/quality';",
"canopy quality import")
patch("src/core/Engine.ts",
"    if (params.noPost) {",
"    if (params.noPost || preset === 'low') {",
"bypass mobile post processing")

# Further reduce the mobile GPU/CPU workload without replacing scanned art.
patch("src/core/Engine.ts",
"    const dpr = Math.min(window.devicePixelRatio || 1, 2);",
"    const dpr = Math.min(window.devicePixelRatio || 1, preset === 'low' ? 1.25 : 2);",
"mobile pixel ratio")

# Cap the mobile camera horizon: the upstream 30 km far plane wastes visibility work
# on terrain and scenery far beyond ILOX's playable island.
patch("src/core/Engine.ts",
"  readonly camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 30000);",
"  readonly camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, preset === 'low' ? 1800 : 30000);",
"mobile camera far plane")
patch("src/main.ts",
"  sunLight.castShadow = !new URLSearchParams(location.search).has('noshadow');",
"  sunLight.castShadow = preset !== 'low' && !new URLSearchParams(location.search).has('noshadow');",
"disable mobile shadow maps")
patch("src/main.ts",
"    veg.update(camera, 60);",
"    veg.update(camera, preset === 'low' ? 18 : 60);",
"reduce mobile vegetation culling radius")

# Thin redundant tree layers while preserving the main rainforest canopy and scanned assets.
patch("src/veg/Vegetation.ts",
"const TS = 11 / Math.sqrt(D);",
"const TS = 14 / Math.sqrt(D);",
"reduce secondary canopy tree count")
patch("src/veg/Vegetation.ts",
"const MS = 8.5 / Math.sqrt(D);",
"const MS = 12.5 / Math.sqrt(D);",
"reduce midstorey tree count")
patch("src/veg/Vegetation.ts",
"if (r.next() < 0.08) {",
"if (r.next() < 0.04) {",
"reduce extra palms among rainforest trees")

# Keep water visually alive while halving its expensive compute dispatch cadence on phones.
patch("src/main.ts",
"  let canopyK = 0, glareK = 0;",
"  let canopyK = 0, glareK = 0;\n  let oceanAccumulator = 0;",
"ocean compute accumulator")
patch("src/main.ts",
"    if (!skip.has('oceansim')) ocean.update(renderer, camera, t, dt);",
"    if (!skip.has('oceansim')) {\n      oceanAccumulator += dt;\n      if (oceanAccumulator >= 1 / 30) {\n        ocean.update(renderer, camera, t, oceanAccumulator);\n        oceanAccumulator = 0;\n      }\n    }",
"throttle ocean compute to 30hz")

# Carve several broad, naturally irregular grass clearings into the forest mask.
patch("src/world/Heightfield.ts",
"    this.mask0 = new Uint8Array(m0);\n    this.mask1 = new Uint8Array(m1);",
"    this.mask0 = new Uint8Array(m0);\n    this.mask1 = new Uint8Array(m1);\n    const meadowCenters = [\n      [-260, -10, 118], [-330, 230, 94], [235, 255, 112], [485, 30, 78], [35, 335, 86], [365, 18, 96],\n    ] as const;\n    for (let j = 0; j < this.m; j++) for (let i = 0; i < this.m; i++) {\n      const x = (i + 0.5) * 2 - HALF_WORLD, z = (j + 0.5) * 2 - HALF_WORLD;\n      const o = (j * this.m + i) * 4;\n      const hX = Math.max(0, Math.min(N - 1, Math.round(x + HALF_WORLD)));\n      const hZ = Math.max(0, Math.min(N - 1, Math.round(z + HALF_WORLD)));\n      const h = heights[hZ * N + hX];\n      if (h < 2 || this.mask1[o + 2] > 18 || this.mask1[o] > 210 || this.mask0[o + 2] > 175 || this.mask0[o] > 190) continue;\n      let meadow = 0;\n      for (const [cx, cz, radius] of meadowCenters) {\n        const dx = (x - cx) / (radius * (1.0 + 0.09 * Math.sin(z * 0.035)));\n        const dz = (z - cz) / (radius * (1.0 + 0.08 * Math.sin(x * 0.031)));\n        const d = Math.hypot(dx, dz);\n        const f = Math.max(0, Math.min(1, (1.0 - d) / 0.24));\n        meadow = Math.max(meadow, f * f * (3 - 2 * f));\n      }\n      if (meadow < 0.03) continue;\n      this.mask0[o + 3] = Math.round(this.mask0[o + 3] * (1 - meadow * 0.98));\n      this.mask0[o + 1] = Math.max(this.mask0[o + 1], Math.round(meadow * 205));\n    }",
"bake meadows")

# Keep clearings open at ground level, not merely as holes in the distant canopy.
patch("src/veg/Vegetation.ts",
"const CELL = 32;",
"const CELL = 32;\nconst MEADOWS = [[-260, -10, 118], [-330, 230, 94], [235, 255, 112], [485, 30, 78], [35, 335, 86], [365, 18, 96]] as const;\nconst inMeadow = (x: number, z: number) => MEADOWS.some(([cx, cz, r]) => {\n  const dx = (x - cx) / (r * (1 + 0.09 * Math.sin(z * 0.035)));\n  const dz = (z - cz) / (r * (1 + 0.08 * Math.sin(x * 0.031)));\n  return dx * dx + dz * dz < 0.78;\n});",
"meadow scatter mask")
patch("src/veg/Vegetation.ts",
"mesh.castShadow = lod.shadow;",
"mesh.castShadow = lod.shadow && Q.cascades > 1;",
"vegetation cast shadows")
patch("src/veg/Vegetation.ts",
"      if ((f < 0.22 && g < 0.45) || clearing(px, pz, -8)) continue;",
"      if (inMeadow(px, pz) || (f < 0.22 && g < 0.45) || clearing(px, pz, -8)) continue;",
"keep understory out of meadows")
patch("src/veg/Vegetation.ts",
"      if (f < 0.3 || clearing(px, pz, -10) || hf.water(px, pz) > 0.05 || hf.height(px, pz) < 1.5) continue;",
"      if (f < 0.3 || inMeadow(px, pz) || clearing(px, pz, -10) || hf.water(px, pz) > 0.05 || hf.height(px, pz) < 1.5) continue;",
"keep floor litter out of meadows")

# Remove man-made structures from the rendered world and collision set.
patch("src/main.ts",
"import { Village } from './world/Village';\nimport { Lighthouse } from './world/Lighthouse';",
"import type { Village } from './world/Village';\nimport type { Lighthouse } from './world/Lighthouse';",
"structure imports")
patch("src/main.ts",
"  // ---- the village and the lighthouse\n  loading.status('Building the village');\n  const village = new Village(hf, colliders);\n  village.build();\n  if (!skip.has('village')) scene.add(village.group);\n  const lighthouse = new Lighthouse(hf, colliders);\n  if (!skip.has('lighthouse')) scene.add(lighthouse.group);",
"  // ILOX natural-only world: no buildings, docks, boats or man-made landmarks.\n  const village = { boats: [], update: () => {} } as unknown as Village;\n  const lighthouse = {\n    interiorCamera: () => false, update: () => {}, prime: 0,\n    galleryY: hf.height(-300, -300) + 1.75,\n  } as unknown as Lighthouse;",
"remove buildings")
patch("src/main.ts",
"  const spot = SPOTS.find((s) => s.name === (params.spot ?? 'beach')) ?? SPOTS[0];",
"  const spot = SPOTS.find((s) => s.name === (params.spot ?? 'jungle')) ?? SPOTS[0];",
"natural spawn")
patch("src/main.ts",
"  const hud = new Hud(params.hud);",
"  const hud = new Hud(false); // ILOX keeps the natural world unobstructed.",
"hide MMO HUD")

# Touch joystick on the left; drag-to-look on the right; real sprint and jump buttons.
patch("src/player/Input.ts",
"  private wheel = 0;\n",
"  private wheel = 0;\n  private touchMoveX = 0;\n  private touchMoveY = 0;\n  private touchSprint = false;\n",
"touch state")
patch("src/player/Input.ts",
"    this.canvas = canvas;\n",
"    this.canvas = canvas;\n    canvas.style.touchAction = 'none';\n",
"touch action")
patch("src/player/Input.ts",
"    canvas.addEventListener('click', () => {\n      if (!params.test && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();\n    });",
"    canvas.addEventListener('click', () => {\n      if (!params.test && !window.matchMedia('(pointer: coarse)').matches && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();\n    });",
"mobile pointer lock")
patch("src/player/Input.ts",
"    window.addEventListener('wheel', (e) => {\n      this.wheel += Math.sign(e.deltaY);\n    }, { passive: true });",
"    window.addEventListener('wheel', (e) => {\n      this.wheel += Math.sign(e.deltaY);\n    }, { passive: true });\n\n    const ui = document.getElementById('ilox-touch');\n    const stickZone = ui?.querySelector<HTMLElement>('#ilox-stick-zone');\n    const stick = ui?.querySelector<HTMLElement>('#ilox-stick');\n    const lookZone = ui?.querySelector<HTMLElement>('#ilox-look-zone');\n    const sprintButton = ui?.querySelector<HTMLElement>('#ilox-sprint');\n    const jumpButton = ui?.querySelector<HTMLElement>('#ilox-jump');\n    let movePointer = -1, lookPointer = -1, lookX = 0, lookY = 0;\n    const moveStick = (e: PointerEvent) => {\n      if (!stickZone) return;\n      const r = stickZone.getBoundingClientRect();\n      const radius = Math.max(1, Math.min(r.width, r.height) * 0.34);\n      let x = e.clientX - (r.left + r.width / 2);\n      let y = e.clientY - (r.top + r.height / 2);\n      const d = Math.hypot(x, y);\n      if (d > radius) { x *= radius / d; y *= radius / d; }\n      this.touchMoveX = x / radius;\n      this.touchMoveY = -y / radius;\n      if (stick) stick.style.transform = 'translate(' + x + 'px, ' + y + 'px)';\n    };\n    const resetStick = () => {\n      movePointer = -1; this.touchMoveX = this.touchMoveY = 0;\n      if (stick) stick.style.transform = 'translate(0, 0)';\n    };\n    stickZone?.addEventListener('pointerdown', (e) => {\n      e.preventDefault(); movePointer = e.pointerId; stickZone.setPointerCapture(e.pointerId); moveStick(e);\n    });\n    stickZone?.addEventListener('pointermove', (e) => { if (e.pointerId === movePointer) { e.preventDefault(); moveStick(e); } });\n    stickZone?.addEventListener('pointerup', (e) => { if (e.pointerId === movePointer) resetStick(); });\n    stickZone?.addEventListener('pointercancel', resetStick);\n    lookZone?.addEventListener('pointerdown', (e) => {\n      e.preventDefault(); lookPointer = e.pointerId; lookX = e.clientX; lookY = e.clientY;\n      lookZone.setPointerCapture(e.pointerId);\n    });\n    lookZone?.addEventListener('pointermove', (e) => {\n      if (e.pointerId !== lookPointer) return;\n      e.preventDefault(); this.mdx += e.clientX - lookX; this.mdy += e.clientY - lookY;\n      lookX = e.clientX; lookY = e.clientY;\n    });\n    const endLook = (e: PointerEvent) => { if (e.pointerId === lookPointer) lookPointer = -1; };\n    lookZone?.addEventListener('pointerup', endLook);\n    lookZone?.addEventListener('pointercancel', endLook);\n    const sprintOn = (e: PointerEvent) => { e.preventDefault(); this.touchSprint = true; sprintButton?.setPointerCapture(e.pointerId); };\n    const sprintOff = () => { this.touchSprint = false; };\n    sprintButton?.addEventListener('pointerdown', sprintOn);\n    sprintButton?.addEventListener('pointerup', sprintOff);\n    sprintButton?.addEventListener('pointercancel', sprintOff);\n    sprintButton?.addEventListener('pointerleave', sprintOff);\n    jumpButton?.addEventListener('pointerdown', (e) => { e.preventDefault(); this.pressed.add('Space'); });\n    window.addEventListener('blur', () => { resetStick(); this.touchSprint = false; lookPointer = -1; });",
"touch controls")
patch("src/player/Input.ts",
"    let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);\n    let my = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);",
"    let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + this.touchMoveX;\n    let my = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) + this.touchMoveY;",
"touch movement axes")
patch("src/player/Input.ts",
"    let sprint = k('ShiftLeft') || k('ShiftRight');",
"    let sprint = k('ShiftLeft') || k('ShiftRight') || this.touchSprint;",
"touch sprint")

# Rebrand the loading shell and make URLs relative for the /ILOX/ Pages path.
index = root / "index.html"
s = index.read_text(encoding="utf-8")
replacements = [
    ('<html lang="en">', '<html lang="es">'),
    ('<title>Island</title>', '<title>ILOX — Mundo natural</title>'),
    ('<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
     '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />\n    <meta name="theme-color" content="#101b16" />\n    <link rel="manifest" href="./manifest.webmanifest" />'),
    ('An open-world tropical island in the browser: beach, jungle, waterfall, fishing village and a lighthouse on the peak.',
     'ILOX: explorá un mundo natural 3D con bosques, acantilados, ríos y cascadas.'),
    ('<h1>ISLAND</h1>', '<h1>ILOX</h1>'),
    ('      <div class="bar">', '      <p class="line">Un mundo natural. Exploralo a tu manera.</p>\n      <div class="bar">'),
    ('<script type="module" src="/src/main.ts"></script>',
     '<div id="ilox-touch" aria-label="Controles táctiles">\n'
     '      <div id="ilox-look-zone" aria-label="Mirar alrededor"></div>\n'
     '      <div id="ilox-stick-zone" aria-label="Mover personaje"><div id="ilox-stick"></div></div>\n'
     '      <button class="ilox-action" id="ilox-sprint" type="button">CORRER</button>\n'
     '      <button class="ilox-action" id="ilox-jump" type="button">SALTAR</button>\n'
     '    </div>\n'
     '    <script type="module" src="./src/main.ts"></script>'),
]
for old, new in replacements:
    if old not in s:
        raise SystemExit("index patch missing: " + old[:80])
    s = s.replace(old, new, 1)

touch_css = """
      html, body, #app { width:100%; height:100%; height:100dvh; margin:0; overflow:hidden; background:#101b16; }
      body { overscroll-behavior:none; user-select:none; -webkit-user-select:none; }
      #app { position:fixed; inset:0; }
      #app canvas { display:block; width:100%; height:100%; touch-action:none; }
      #ilox-touch { display:none; position:fixed; inset:0; z-index:70; pointer-events:none; touch-action:none; }
      #ilox-look-zone { position:absolute; top:0; right:0; bottom:0; width:53%; pointer-events:auto; touch-action:none; }
      #ilox-stick-zone { position:absolute; left:max(22px,env(safe-area-inset-left)); bottom:max(22px,env(safe-area-inset-bottom)); width:132px; height:132px;
        border:1px solid rgba(255,255,255,.45); border-radius:50%; background:rgba(14,25,20,.26); pointer-events:auto; touch-action:none; }
      #ilox-stick { position:absolute; left:50%; top:50%; width:54px; height:54px; margin:-27px; border-radius:50%;
        border:1px solid rgba(255,255,255,.78); background:rgba(230,235,222,.35); }
      .ilox-action { position:absolute; right:max(22px,env(safe-area-inset-right)); width:68px; height:68px; border:1px solid rgba(255,255,255,.58);
        border-radius:50%; color:white; background:rgba(14,25,20,.4); font:600 10px system-ui; letter-spacing:.06em;
        pointer-events:auto; touch-action:none; text-shadow:0 1px 3px #000; }
      #ilox-jump { bottom:max(24px,env(safe-area-inset-bottom)); }
      #ilox-sprint { bottom:max(104px,calc(env(safe-area-inset-bottom) + 104px)); }
      @media (pointer:coarse) { #ilox-touch { display:block; } }
      @media (max-width:640px) { #loading .gpu { display:none; } }
"""
if "</style>" not in s:
    raise SystemExit("index style end missing")
s = s.replace("</style>", touch_css + "\n    </style>", 1)
index.write_text(s, encoding="utf-8")

license_text = """# Third-party licenses in ILOX

## Island world and engine
The natural-world engine and game code are adapted from
[StarKnightt/island](https://github.com/StarKnightt/island), pinned to commit
651d582f991a1ba0efc2cf358c890bb6bb29b76f. Copyright (c) 2026 Prasenjit.
Licensed under the MIT License; the full upstream license is published as
LICENSE-Island.txt.

## Character and animation
The player avatar is a Rocketbox character (MIT license) with Quaternius
animation clips (CC0). Their original licenses remain applicable.

## Environment assets
Photogrammetry textures and models from Poly Haven are CC0 1.0.
Audio assets are CC0 / public domain as identified by the upstream project.

The ILOX adaptation excludes the upstream village, buildings, docks, boats,
lighthouse and fantasy/combat content.
"""
(root / "public" / "THIRD_PARTY_LICENSES.md").write_text(license_text, encoding="utf-8")

# The natural-only scene never imports the village/lighthouse asset packs.
# Remove them from the published bundle, plus the unused alternate rock shelf.
for unused in [root / "public" / "assets" / "props", root / "public" / "assets" / "tex"]:
    shutil.rmtree(unused, ignore_errors=True)
unused_shelves = root / "public" / "assets" / "rocks" / "shelves.glb"
if unused_shelves.exists():
    unused_shelves.unlink()
print("ILOX natural-world adaptation prepared; unused built-structure assets removed.")
