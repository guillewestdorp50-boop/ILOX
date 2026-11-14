#!/usr/bin/env python3
"""Adapt the pinned Island source into ILOX's natural-world exploration PWA."""
from pathlib import Path
import shutil
import sys
root = Path(sys.argv[1] if len(sys.argv) > 1 else "island-source")

# Add the original ILOX channel cheer without modifying or removing upstream audio.
cheer_asset = Path(__file__).parent / "assets" / "channel_cheer.ogg"
cheer_target = root / "public" / "assets" / "audio" / "channel_cheer.ogg"
cheer_target.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(cheer_asset, cheer_target)

def patch(path, old, new, label):
    p = root / path
    s = p.read_text(encoding="utf-8")
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected 1 match, found {n}")
    p.write_text(s.replace(old, new, 1), encoding="utf-8")

def patch_many(path, old, new, expected, label):
    p = root / path
    s = p.read_text(encoding="utf-8")
    n = s.count(old)
    if n != expected:
        raise SystemExit(f"{label}: expected {expected} matches, found {n}")
    p.write_text(s.replace(old, new), encoding="utf-8")

# Open plain performance mode: keep terrain and all freshwater, remove scattered foliage and boulders.
# Keep only the waterfall's gorge rock faces; remove coastal rock props and offshore stacks.
patch("src/main.ts",
"import { SPOTS, LIGHTHOUSE, HALF_WORLD, WORLD_SIZE } from './world/layout';",
"import { SPOTS, LIGHTHOUSE, HALF_WORLD } from './world/layout';",
"remove unused world dimensions imports")

patch("src/main.ts",
"  const rockPlan = planRocks(hf);",
"  const rockPlan = planRocks(hf).filter((p) => p.zone === 1);",
"keep only waterfall gorge rocks")

patch("src/main.ts",
"import { setPlantSkyMaps, loadVariants, rockMaterial } from './veg/glb';",
"",
"remove vegetation and rock asset imports")
patch("src/main.ts",
"import { Vegetation, vegU, type RockModel } from './veg/Vegetation';\nimport { buildCanopy } from './veg/Canopy';",
"import { Vegetation, vegU } from './veg/Vegetation';",
"remove canopy and rock model imports")
patch("src/main.ts",
"  setPlantSkyMaps(hf.mask0Tex, hf.heightTex, HALF_WORLD, WORLD_SIZE);\n  const veg = new Vegetation(hf, colliders);\n  const tv = performance.now();\n  veg.build();\n  // the plants (helpers' GLBs) load and scatter while the rest of the island comes up\n  const plantsReady = veg.buildGlb().then(() => {\n    console.log(`plants in ${(performance.now() - tv).toFixed(0)} ms`);\n    mark('plants');\n  }, (e) => console.warn('plants', e));\n  mark('vegetation built');\n  if (!skip.has('veg')) scene.add(veg.group);\n  if (!skip.has('canopy')) scene.add(buildCanopy(hf, renderer));\n  // rocks stream in with the props: the helper's jointed basalt blocks (the island's own dark volcanic rock, the cliff\n  // kit's palette), each set into the ground by its buried part rather than resting on its lowest point\n  const rocksReady = (async () => {\n    const set = await loadVariants('assets/rocks/boulders.glb');\n    const mats = new Map<THREE.Material, THREE.Material>();\n    const model = (name: string, big: boolean): RockModel | null => {\n      const v = set.get(name);\n      const near = v?.lods[0]?.[0], far = (v?.lods[1] ?? v?.lods[0])?.[0];\n      if (!v || !near || !far) return null;\n      let mat = mats.get(near.src);\n      if (!mat) mats.set(near.src, (mat = rockMaterial(near.src)));\n      for (const g of [near.geometry, far.geometry]) g.computeBoundingSphere();\n      return { geometry: near.geometry, far: far.geometry, material: mat, radius: Math.max(0.3, v.radius), big, sink: 0.4 };\n    };\n    const out = [model('basalt_a', false), model('basalt_b', false), model('basalt_c', true), model('basalt_d', true)].filter((m): m is RockModel => !!m);\n    veg.addRocks(out);\n    mark('rocks');\n  })().catch((e) => console.warn('rocks', e));\n  // cliff faces, sea stacks and the gorge of the falls\n  const kit = new RockKit(rockPlan, colliders);\n  if (!skip.has('rockkit')) scene.add(kit.group);\n  const kitReady = kit.load().then(() => mark('rock kit'), (e) => console.warn('rock kit', e));",
"  // Open plain: no grass, plants, tree canopy or scattered boulders are generated or loaded.\n  const veg = new Vegetation(hf, colliders);\n  const plantsReady = Promise.resolve();\n  const rocksReady = Promise.resolve();\n  mark('open plain: foliage and scattered rocks disabled');\n  // Keep the rock kit only for the natural waterfall gorge and cliff support.\n  const kit = new RockKit(rockPlan, colliders);\n  if (!skip.has('rockkit')) scene.add(kit.group);\n  const kitReady = kit.load().then(() => mark('waterfall gorge ready'), (e) => console.warn('waterfall gorge', e));",
"disable foliage canopy and scattered boulders")
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

# Cap the mobile camera horizon at 50 m: keep nearby homes and paths visible without
# spending rendering work on distant scenery. The live graphics control can extend it.
patch("src/core/Engine.ts",
"  readonly camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 30000);",
"  readonly camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, preset === 'low' ? 50 : 30000);",
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
"    if (!skip.has('oceansim')) {\n      oceanAccumulator += dt;\n      if (oceanAccumulator >= (new URLSearchParams(location.search).has('ocean20') ? 1 / 20 : 1 / 30)) {\n        ocean.update(renderer, camera, t, oceanAccumulator);\n        oceanAccumulator = 0;\n      }\n    }",
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
"  const spot = SPOTS.find((s) => s.name === (params.spot ?? 'village')) ?? SPOTS[0];",
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

# Minimal center reticle with live range-to-target readout.
patch("src/main.ts",
"  const fwd = new THREE.Vector3();",
"  const fwd = new THREE.Vector3();\n  const aimRay = new THREE.Raycaster();\n  const aimCenter = new THREE.Vector2(0, 0);\n  const aimDistance = document.getElementById('ilox-aim-distance');\n  const aimTargets = scene.children.filter((o) => o !== player.root && o !== player.shadows);\n  let aimCheckAt = 0;",
"center aim raycaster")
patch("src/main.ts",
"    camera.updateMatrixWorld();\n    terrain.update(camera, Q.shadowFar);",
"    camera.updateMatrixWorld();\n    if (aimDistance && performance.now() >= aimCheckAt) {\n      aimCheckAt = performance.now() + 180;\n      aimRay.setFromCamera(aimCenter, camera);\n      aimRay.far = camera.far;\n      const hit = aimRay.intersectObjects(aimTargets, true)[0];\n      if (hit) {\n        aimDistance.textContent = Math.round(hit.distance) + ' m';\n        aimDistance.style.display = 'block';\n      } else {\n        aimDistance.style.display = 'none';\n      }\n    }\n    terrain.update(camera, Q.shadowFar);",
"live center aim distance")
# Live graphics controls for device-side A/B testing (no reload required).
patch("src/veg/Vegetation.ts",
"  visible = 0;\n",
"  visible = 0;\n  renderDistanceScale = 1;\n",
"live vegetation distance control")
patch("src/veg/Vegetation.ts",
"      const maxD = sp.lods[nL - 1].maxDist;\n      const maxD2 = maxD * maxD;",
"      const rangeScale = this.renderDistanceScale;\n      const maxD = sp.lods[nL - 1].maxDist * rangeScale;\n      const maxD2 = maxD * maxD;",
"apply live vegetation distance")
patch("src/veg/Vegetation.ts",
"      const lim2 = sp.lods.map((l) => l.maxDist * l.maxDist);",
"      const lim2 = sp.lods.map((l) => l.maxDist * l.maxDist * rangeScale * rangeScale);",
"apply live vegetation LOD distance")
patch("src/main.ts",
"  const veg = new Vegetation(hf, colliders);",
"  const veg = new Vegetation(hf, colliders);\n  const graphicsPanel = document.getElementById('ilox-graphics');\n  const graphicsToggle = document.getElementById('ilox-graphics-toggle');\n  const rangeControl = document.getElementById('ilox-range') as HTMLInputElement | null;\n  const vegControl = document.getElementById('ilox-vegetation') as HTMLInputElement | null;\n  const resolutionControl = document.getElementById('ilox-resolution') as HTMLInputElement | null;\n  const shadowControl = document.getElementById('ilox-shadows') as HTMLInputElement | null;\n  const rangeValue = document.getElementById('ilox-range-value');\n  const vegValue = document.getElementById('ilox-vegetation-value');\n  const resolutionValue = document.getElementById('ilox-resolution-value');\n  graphicsToggle?.addEventListener('click', () => graphicsPanel?.classList.toggle('open'));\n  document.getElementById('ilox-graphics-close')?.addEventListener('click', () => graphicsPanel?.classList.remove('open'));\n  rangeControl?.addEventListener('input', () => { camera.far = Number(rangeControl.value); camera.updateProjectionMatrix(); if (rangeValue) rangeValue.textContent = rangeControl.value + ' m'; veg.update(camera, 60, true); });\n  vegControl?.addEventListener('input', () => { veg.renderDistanceScale = Number(vegControl.value) / 100; if (vegValue) vegValue.textContent = vegControl.value + '%'; veg.update(camera, 60, true); });\n  resolutionControl?.addEventListener('input', () => { engine.setRenderScale(Number(resolutionControl.value) / 100); if (resolutionValue) resolutionValue.textContent = resolutionControl.value + '%'; });\n  shadowControl?.addEventListener('change', () => { sunLight.castShadow = shadowControl.checked; sunLight.shadow.needsUpdate = true; });",
"live graphics panel wiring")
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
     '<div id="ilox-aim-dot" aria-hidden="true"></div>\n'
     '  <output id="ilox-aim-distance" aria-live="off"></output>\n'
     '<button id="ilox-graphics-toggle" type="button">GRÁFICOS</button>\n'
     '<section id="ilox-graphics" aria-label="Ajustes gráficos">\n'
     '  <header><strong>AJUSTES GRÁFICOS</strong><button id="ilox-graphics-close" type="button">×</button></header>\n'
     '  <label>Alcance del mundo <output id="ilox-range-value">50 m</output><input id="ilox-range" type="range" min="50" max="300" step="25" value="50"></label>\n'
     '  <label>Vegetación lejana <output id="ilox-vegetation-value">100%</output><input id="ilox-vegetation" type="range" min="10" max="100" step="5" value="100"></label>\n'
     '  <label>Resolución de render <output id="ilox-resolution-value">68%</output><input id="ilox-resolution" type="range" min="40" max="85" step="5" value="68"></label>\n'
     '  <label class="check"><input id="ilox-shadows" type="checkbox"> Sombras dinámicas</label>\n'
     '  <p>Los cambios se aplican en vivo.</p>\n'
     '</section>\n'
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
      #ilox-aim-dot { position:fixed; z-index:60; left:50%; top:50%; width:4px; height:4px; margin:-2px 0 0 -2px; border-radius:50%; background:rgba(255,255,245,.95); box-shadow:0 0 2px 1px rgba(0,0,0,.7); pointer-events:none; }\n      #ilox-aim-distance { display:none; position:fixed; z-index:60; left:50%; top:calc(50% + 13px); transform:translateX(-50%); padding:2px 5px; border-radius:4px; color:#fff; background:rgba(0,0,0,.48); font:600 11px system-ui; font-variant-numeric:tabular-nums; text-shadow:0 1px 2px #000; pointer-events:none; }\n      #ilox-graphics-toggle { position:fixed; z-index:90; top:max(14px,env(safe-area-inset-top)); right:max(14px,env(safe-area-inset-right)); padding:10px 13px; border:1px solid rgba(255,255,255,.35); border-radius:9px; color:#f3f0e7; background:rgba(9,19,16,.78); font:600 11px system-ui; letter-spacing:.08em; }
      #ilox-graphics { display:none; position:fixed; z-index:95; top:max(58px,calc(env(safe-area-inset-top) + 48px)); right:max(14px,env(safe-area-inset-right)); width:min(290px,calc(100vw - 32px)); padding:15px; border:1px solid rgba(220,230,218,.24); border-radius:13px; color:#f3f0e7; background:rgba(9,19,16,.94); box-shadow:0 12px 38px rgba(0,0,0,.4); font:12px system-ui; backdrop-filter:blur(12px); }
      #ilox-graphics.open { display:block; }
      #ilox-graphics header { display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; letter-spacing:.08em; }
      #ilox-graphics header button { color:white; background:transparent; border:0; font-size:22px; }
      #ilox-graphics label { display:block; margin:13px 0; color:rgba(245,245,235,.86); }
      #ilox-graphics output { float:right; color:#b7d9c4; font-variant-numeric:tabular-nums; }
      #ilox-graphics input[type=range] { display:block; width:100%; margin:9px 0 0; accent-color:#9fc8a9; }
      #ilox-graphics .check { display:flex; gap:9px; align-items:center; }
      #ilox-graphics p { margin:12px 0 0; color:rgba(245,245,235,.5); font-size:10px; }
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

# Experimental 2,000,000 m² world: a 1,414.2136 m square.
# Keep the original authored layout intact in source control, and apply one
# deterministic transform to its exported coordinates at build time.
patch("src/world/layout.ts",
"export const WORLD_SIZE = 2048;",
"export const WORLD_SIZE = Math.sqrt(2_000_000);",
"set 2 million square metre world")
patch("src/world/layout.ts",
"export const SPAWN = SPOTS[0];",
"""export const SPAWN = SPOTS[0];

// ILOX map experiment: uniformly compress all authored horizontal coordinates
// into the new world bounds. The source values above remain intact and auditable.
const ILOX_MAP_SCALE = WORLD_SIZE / 2048;
const scalePoint = (p: V2): V2 => [p[0] * ILOX_MAP_SCALE, p[1] * ILOX_MAP_SCALE];
for (const p of COAST) p.p = scalePoint(p.p);
for (const p of ISLETS) { p.c = scalePoint(p.c); p.rx *= ILOX_MAP_SCALE; p.rz *= ILOX_MAP_SCALE; }
PEAK.p = scalePoint(PEAK.p);
LIGHTHOUSE.p = scalePoint(LIGHTHOUSE.p);
LIGHTHOUSE.platformR *= ILOX_MAP_SCALE;
for (const p of HILLS) { p.p = scalePoint(p.p); p.r *= ILOX_MAP_SCALE; }
for (const p of RIVER) { p.p = scalePoint(p.p); p.w *= ILOX_MAP_SCALE; }
POOL.p = scalePoint(POOL.p);
POOL.r *= ILOX_MAP_SCALE;
for (const p of ESCARPMENT) p.p = scalePoint(p.p);
VILLAGE.center = scalePoint(VILLAGE.center);
VILLAGE.r *= ILOX_MAP_SCALE;
for (const path of PATHS) for (const p of path) { p[0] *= ILOX_MAP_SCALE; p[1] *= ILOX_MAP_SCALE; }
for (const spot of SPOTS) {
  spot.player[0] *= ILOX_MAP_SCALE;
  spot.player[1] *= ILOX_MAP_SCALE;
  if (spot.cam) {
    spot.cam.pos[0] *= ILOX_MAP_SCALE; spot.cam.pos[2] *= ILOX_MAP_SCALE;
    spot.cam.target[0] *= ILOX_MAP_SCALE; spot.cam.target[2] *= ILOX_MAP_SCALE;
  }
}""",
"scale all authored map coordinates")
# Match the fixed 128x128 quadtree leaf grid to the resized physical world.
patch("src/world/Terrain.ts",
"const LEAF = 16; // metres\nconst LEVELS = 8; // 16 m .. 2048 m nodes",
"const LEAF_CELLS = 16; // heightmap texels per leaf; physical size follows WORLD_SIZE\nconst LEVELS = 8; // 128 mappable leaf cells per side, across 8 levels",
"terrain leaf grid uses map texels")
patch("src/world/Terrain.ts",
"    let res = WORLD_SIZE / LEAF;",
"    let res = N / LEAF_CELLS;",
"terrain minmax grid resolution")
patch("src/world/Terrain.ts",
"      const step = LEAF;",
"      const step = LEAF_CELLS;",
"terrain minmax sample stride")
patch("src/world/Terrain.ts",
"      const size = LEAF * Math.pow(2, lod);",
"      const size = (WORLD_SIZE / (this.hf.n / LEAF_CELLS)) * Math.pow(2, lod);",
"terrain node physical size")
patch("src/world/Terrain.ts",
"    const rootSize = LEAF * Math.pow(2, top);",
"      const rootSize = (WORLD_SIZE / (this.hf.n / LEAF_CELLS)) * Math.pow(2, top);",
"terrain root physical size")
patch("src/world/Terrain.ts",
"      const res = WORLD_SIZE / size;",
"      const res = (this.hf.n / LEAF_CELLS) / Math.pow(2, lod);",
"terrain minmax lookup resolution")
# Height samples now use the actual sub-metre texel spacing.
patch("src/world/Heightfield.ts",
"    const fx = (x + HALF_WORLD) - 0.5, fz = (z + HALF_WORLD) - 0.5;",
"    const cell = WORLD_SIZE / N;\n    const fx = (x + HALF_WORLD) / cell - 0.5, fz = (z + HALF_WORLD) / cell - 0.5;",
"heightfield scaled texel coordinates")
# RockKit writes into the same resized heightmap using its real texel spacing.
patch_many("src/world/RockKit.ts",
"      const i = Math.round(x + HALF_WORLD - 0.5), j = Math.round(z + HALF_WORLD - 0.5);",
"      const i = Math.round((x + HALF_WORLD) / (WORLD_SIZE / N) - 0.5), j = Math.round((z + HALF_WORLD) / (WORLD_SIZE / N) - 0.5);",
3,
"rock kit heightmap coordinates")
# Tighten oriented-box broadphase bounds so long perimeter walls do not fill the entire collider grid.
patch("src/world/Colliders.ts",
"    const o: Obstacle = { kind: 'box', x, z, r: Math.hypot(hx, hz), hx, hz, c: Math.cos(rot), s: Math.sin(rot), y0, y1 };\n    for (const k of this.cells(x - o.r, x + o.r, z - o.r, z + o.r)) this.bucket(k).obs.push(o);",
"    const o: Obstacle = { kind: 'box', x, z, r: Math.hypot(hx, hz), hx, hz, c: Math.cos(rot), s: Math.sin(rot), y0, y1 };\n    const ex = Math.abs(o.c) * hx + Math.abs(o.s) * hz;\n    const ez = Math.abs(o.s) * hx + Math.abs(o.c) * hz;\n    for (const k of this.cells(x - ex, x + ex, z - ez, z + ez)) this.bucket(k).obs.push(o);",
"tight oriented box collider bounds")
# A real invisible perimeter keeps the player inside the 2,000,000 m² square.
patch("src/main.ts",
"  const colliders = new Colliders();",
"  const colliders = new Colliders();\n  const mapEdge = HALF_WORLD - 2;\n  // Four invisible, full-height perimeter walls; no visual props or branches are removed.\n  colliders.box(-mapEdge, 0, 2, HALF_WORLD, 0, -1000, 1000);\n  colliders.box(mapEdge, 0, 2, HALF_WORLD, 0, -1000, 1000);\n  colliders.box(0, -mapEdge, HALF_WORLD, 2, 0, -1000, 1000);\n  colliders.box(0, mapEdge, HALF_WORLD, 2, 0, -1000, 1000);",
"add invisible 2m world perimeter")


# Keep every graphics control at its lowest supported setting for the mobile test.
patch("index.html",
'  <label>Vegetación lejana <output id="ilox-vegetation-value">100%</output><input id="ilox-vegetation" type="range" min="10" max="100" step="5" value="100"></label>',
'  <label>Vegetación lejana <output id="ilox-vegetation-value">0%</output><input id="ilox-vegetation" type="range" min="0" max="100" step="5" value="0"></label>',
"set vegetation slider to minimum")
patch("index.html",
'  <label>Resolución de render <output id="ilox-resolution-value">68%</output><input id="ilox-resolution" type="range" min="40" max="85" step="5" value="68"></label>',
'  <label>Resolución de render <output id="ilox-resolution-value">40%</output><input id="ilox-resolution" type="range" min="40" max="85" step="5" value="40"></label>',
"set render scale to minimum")

# Mobile camera look stays under the player's finger; never auto-turn behind the avatar.
patch("src/player/Input.ts",
"  worldYaw?: number;\n}",
"  worldYaw?: number;\n  /** Mobile users steer the camera manually; do not auto-recenter. */\n  manualLook?: boolean;\n}",
"add manual look intent")
patch("src/player/Input.ts",
"  private touchSprint = false;",
"  private touchSprint = false;\n  private touchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;",
"detect touch device for manual camera")
patch("src/player/Input.ts",
"    const intent: Intent = { moveX: mx, moveY: my, lookX: lx, lookY: ly, sprint, jump, walk, zoom, up };",
"    const intent: Intent = { moveX: mx, moveY: my, lookX: lx, lookY: ly, sprint, jump, walk, zoom, up, manualLook: this.touchDevice };",
"mobile look stays manual")
patch("src/player/CameraRig.ts",
"    if (this.idleLook > 1.2 && playerSpeed > 0.6) {",
"    if (!intent.manualLook && this.idleLook > 1.2 && playerSpeed > 0.6) {",
"disable mobile automatic camera recenter")

# Bring run and sprint clip playback closer to the natural speed encoded in the animation metadata.
patch("src/player/Player.ts",
"const WALK = 1.35, RUN = 4.1, SPRINT = 6.6, SWIM = 1.35, SWIM_FAST = 2.1;",
"const WALK = 1.35, RUN = 5.0, SPRINT = 8.0, SWIM = 1.35, SWIM_FAST = 2.1;",
"match run speeds to locomotion clips")


# Anchor the waterfall lip to the actual pre-carve terrain crest.
# On the 2M map, the river-distance sampling can otherwise place the lip water
# above the escarpment, making the sheet appear to start in mid-air.
patch("tools/gen-island.ts",
"let poolLevel = 0, lipWater = 0;",
"let poolLevel = 0, lipWater = 0, lipGround = 0;",
"preserve waterfall lip ground height")
patch("tools/gen-island.ts",
"  lipWater = lipBed + 0.55;",
"  const lipPoint = RIVER[FALLS_INDEX].p;\n  lipGround = sampleRaw(lipPoint[0], lipPoint[1]);\n  lipWater = Math.min(lipBed + 0.55, lipGround - 1.65);",
"keep waterfall lip below the terrain crest")


patch("src/world/Heightfield.ts",
"falls: { lip: [number, number]; toward: [number, number]; s: number; top: number; bottom: number; width: number };",
"falls: { lip: [number, number]; toward: [number, number]; s: number; top: number; bottom: number; width: number; lipGround: number };",
"record waterfall lip terrain height")
patch("tools/gen-island.ts",
"falls: { lip, toward: below, s: sFalls, top: lipWater, bottom: poolLevel, width: RIVER[FALLS_INDEX].w },",
"falls: { lip, toward: below, s: sFalls, top: lipWater, bottom: poolLevel, width: RIVER[FALLS_INDEX].w, lipGround },",
"write waterfall lip terrain height into metadata")


# Reversible terrain A/B: retain the full original shader and add a cheaper
# five-layer path selectable with ?terrainlite=1. No original layers or features
# are deleted; the default remains the full-quality material.
patch("src/world/TerrainMaterial.ts",
"export function createTerrainMaterial(hf: Heightfield) {",
"""function createTerrainLiteMaterial(hf: Heightfield) {
  const m = new THREE.MeshPhysicalNodeMaterial();
  m.name = 'terrain-lite';
  const heightAt = heightLookup(hf);
  const maskUV = (p: N) => p.add(HALF_WORLD).div(WORLD_SIZE);
  const liteIndices = [0, 2, 3, 4, 5];
  const albedoPh = placeholderArray(liteIndices.map((i) => [...TARGET[i].map(toSrgb), 0.5]), true);
  const normalPh = placeholderArray(liteIndices.map((i) => [0.5, 0.5, ROUGH[i], 1]), false);
  const albedoNodes: N[] = [];
  const normalNodes: N[] = [];
  const sampleA = (layer: number, uvL: N) => {
    const t = texture(albedoPh, uvL).depth(int(layer));
    albedoNodes.push(t);
    return t;
  };
  const sampleN = (layer: number, uvL: N) => {
    const t = texture(normalPh, uvL).depth(int(layer));
    normalNodes.push(t);
    return t;
  };
  const p = positionWorld;
  const xz = p.xz;
  const n = normalize(vec3(
    heightAt(xz.sub(vec2(1, 0))).sub(heightAt(xz.add(vec2(1, 0)))),
    2,
    heightAt(xz.sub(vec2(0, 1))).sub(heightAt(xz.add(vec2(0, 1)))),
  ));
  const m0 = texture(hf.mask0Tex, maskUV(xz));
  const m1 = texture(hf.mask1Tex, maskUV(xz));
  const slope = float(1).sub(n.y);
  const rock = max(m1.x, smoothstep(0.42, 0.6, slope)
    .mul(float(1).sub(m0.x.mul(0.9)))
    .mul(smoothstep(1.5, 4.0, p.y)));
  // Preserve original mask semantics and base coverage while sampling five layers.
  // Fallback weights prevent uncovered mask pixels from becoming black.
  const h = heightAt(xz);
  const underwater = smoothstep(0.15, -0.5, h);
  const pool = hf.meta.pool;
  const dPool = length(xz.sub(vec2(pool.p[0], pool.p[1])));
  const poolBank = smoothstep(pool.r + 15, pool.r + 4, dPool)
    .mul(smoothstep(pool.level + 9, pool.level + 2, h));
  const notRock = float(1).sub(rock);
  const wBase = float(1).sub(max(max(m0.x, rock), max(max(m0.y, m0.z), m0.w))).clamp(0, 1);
  const noSand = float(1).sub(poolBank);
  const weights = [
    m0.x.mul(float(1).sub(underwater)).mul(noSand),
    m0.w.mul(float(1).sub(m0.x)).mul(notRock).add(wBase.mul(0.55)).add(poolBank.mul(0.55)),
    m0.y.mul(notRock).mul(float(1).sub(m0.x.mul(0.8))).add(wBase.mul(0.45)),
    m0.z.mul(float(1).sub(rock.mul(0.7))).mul(noSand),
    rock.mul(float(1).sub(m0.w.mul(0.5))).add(poolBank.mul(0.5)),
  ];
  const indices = [0, 2, 3, 4, 5];
  const scales = [SCALE[0], SCALE[2], SCALE[3], SCALE[4], SCALE[5]];
  let albedo: N = vec3(0);
  let rough: N = float(0);
  let detail: N = vec2(0);
  let total: N = float(0.0001);
  for (let i = 0; i < indices.length; i++) {
    const uvL = xz.div(scales[i]).add(indices[i] * 0.37);
    const a = sampleA(i, uvL);
    const t = sampleN(i, uvL);
    const w = max(weights[i], 0).mul(a.a.mul(1.4).add(0.3)).pow(2.0);
    albedo = albedo.add(a.rgb.mul(w));
    rough = rough.add(t.z.mul(w));
    detail = detail.add(t.xy.mul(2).sub(1).mul(w));
    total = total.add(w);
  }
  albedo = albedo.div(total);
  rough = rough.div(total);
  detail = detail.div(total);
  const finalN = normalize(vec3(n.x.add(detail.x.mul(0.65)), n.y, n.z.sub(detail.y.mul(0.65))));
  const damp = m1.y.mul(0.28).clamp(0, 0.28);
  albedo = albedo.mul(float(1).sub(damp));
  rough = mix(rough, float(0.48), damp);
  m.colorNode = vec4(albedo, 1);
  m.roughnessNode = rough;
  m.metalnessNode = float(0);
  m.specularIntensityNode = float(0.35);
  m.normalNode = transformNormalToView(finalN);
  m.aoNode = float(1);
  const loadLayers = async () => {
    const selected = liteIndices.map((i) => LAYERS[i]);
    const [albedos, normals] = await Promise.all([
      Promise.all(selected.map((l) => loadKTX2(`assets/terrain/${l}_a.ktx2`))),
      Promise.all(selected.map((l) => loadKTX2(`assets/terrain/${l}_n.ktx2`))),
    ]);
    const A = toArray(albedos, true), Nn = toArray(normals, false);
    for (const t of albedoNodes) t.value = A;
    for (const t of normalNodes) t.value = Nn;
  };
  return { material: m, loadLayers };
}

export function createTerrainMaterial(hf: Heightfield, lite = false) {
  // The original full shader remains the default and is never overwritten.
  if (lite) return createTerrainLiteMaterial(hf);""",
"add reversible five-layer terrain shader")
patch("src/main.ts",
"  const terrainM = createTerrainMaterial(hf);",
"  const terrainLite = new URLSearchParams(location.search).has('terrainlite');\n  const terrainM = createTerrainMaterial(hf, terrainLite);",
"select terrain A/B shader by URL")



# Reversible mobile water A/B: retain the full ocean material by default.
# ?waterlite=1 keeps animated FFT displacement and natural wave geometry, but
# skips costly per-pixel refraction, shoreline foam/noise, and multi-pass optics.
# Mobile FFT maps use 128² instead of 256² (4x fewer compute cells per cascade).
patch("src/water/oceanSim.ts",
"import { Rng } from '../core/noise';",
"import { Rng } from '../core/noise';\nimport { Q } from '../core/quality';",
"mobile ocean simulation quality import")
patch("src/water/oceanSim.ts",
"  resolution: 256,",
"  resolution: Q.oceanSegments <= 48 ? 128 : 256,",
"reduce mobile ocean FFT resolution")
patch("src/water/Ocean.ts",
"    const geo = polarGrid(Q.oceanSegments, 200, 26000);",
"    const geo = polarGrid(Q.oceanSegments, Q.oceanSegments <= 48 ? 112 : 200, 26000);",
"reduce mobile ocean grid rings")
patch("src/water/Ocean.ts",
"    // ---- fragment\n    const shade = (() => {",
"""    // ---- fragment
    // The original cinematic shader remains untouched and is still the default.
    // This reversible mobile path keeps spectral wave geometry and lit reflections,
    // while avoiding screen-space refraction, foam lace, shoreline noise and extra
    // depth/scene texture reads that dominate fragment cost when water fills the screen.
    if (new URLSearchParams(location.search).has('waterlite')) {
      const p = positionWorld;
      const xz = p.xz;
      const ground = heightAt(xz);
      const depth = max(ground.negate(), 0);
      let slope: N = vec2(0);
      const normalWeights = [1, 0.35, 0.12];
      for (let i = 0; i < 3; i++) {
        const der = sim.derivNodes[i].sample(xz.div(sim.patchLengths[i]));
        slope = slope.add(der.xy.mul(normalWeights[i]));
      }
      const N0 = normalize(vec3(slope.x.negate(), 1, slope.y.negate()));
      const V = normalize(cameraPosition.sub(p));
      const NdotV = clamp(dot(N0, V), 0.001, 1);
      const fresnel = float(0.02).add(float(0.98).mul(pow(float(1).sub(NdotV), 5)));
      const shallow = smoothstep(1.5, 24, depth);
      const base = mix(vec3(0.025, 0.24, 0.22), vec3(0.006, 0.035, 0.07), shallow);
      const color = mix(base, vec3(0.34, 0.48, 0.48), fresnel.mul(0.42));
      m.colorNode = vec4(color, 1);
      m.roughnessNode = float(0.16);
      m.metalnessNode = float(0);
      m.normalNode = transformNormalToView(N0);
      m.emissiveNode = base.mul(0.035);
      m.opacityNode = float(1);
      return m;
    }
    const shade = (() => {""",
"add reversible low-cost water fragment shader")


# Reversible sky-only A/B controls. The original atmosphere and cloud paths remain
# the default; each experiment can be enabled independently from the URL.
patch("src/sky/Atmosphere.ts",
"const S_W = 192, S_H = 128;",
"const ATMO_LITE = new URLSearchParams(location.search).has('atmolite');\nconst S_W = ATMO_LITE ? 144 : 192, S_H = ATMO_LITE ? 96 : 128;",
"add reversible lower-cost sky-view LUT")
patch("src/sky/Sky.ts",
"const CLOUD_RES = 1024;",
"const CLOUD_LITE = new URLSearchParams(location.search).has('cloudlite');\nconst CLOUD_RES = CLOUD_LITE ? 768 : 1024;",
"add reversible lower-cost cloud map")
patch("src/sky/Sky.ts",
"const STEPS = withSun ? Math.round(Q.cloudSteps * 1.5) : 9;",
"const STEPS = withSun ? Math.max(1, Math.round(Q.cloudSteps * (CLOUD_LITE ? 1 : 1.5))) : (CLOUD_LITE ? 6 : 9);",
"reduce cloud raymarch steps only in cloud A/B")
patch("src/sky/Sky.ts",
"    if (force || this.n % 3 === 0) renderAtmosphereLUTs(this.renderer);",
"    if (force || this.n % (new URLSearchParams(location.search).has('atmolite') ? 6 : 3) === 0) renderAtmosphereLUTs(this.renderer);",
"reduce sky LUT refresh cadence only in atmosphere A/B")


# Reversible ultra-light sky path. The original physically based atmosphere,
# cloud raymarch, rain shafts, moon/stars and environment path remain untouched.
# ?skylite=1 selects a compact gradient + one cloud-map lookup per sky pixel.
patch("src/sky/Sky.ts",
"const CLOUD_LITE = new URLSearchParams(location.search).has('cloudlite');\nconst CLOUD_RES = CLOUD_LITE ? 768 : 1024;",
"const SKY_LITE = new URLSearchParams(location.search).has('skylite');\nconst CLOUD_LITE = new URLSearchParams(location.search).has('cloudlite');\nconst CLOUD_RES = CLOUD_LITE ? 768 : 1024;",
"add reversible ultra-light sky mode")
patch("src/sky/Sky.ts",
"    const col = skyRadiance(above).toVar();",
"""    const col = skyRadiance(above).toVar();
    // This early branch deliberately avoids all per-pixel atmosphere LUT,
    // cloud-density raymarch, secondary cloud-light taps, rain shafts,
    // procedural stars and high-frequency moon calculations.
    if (SKY_LITE) {
      const h = max(dir.y, 0);
      const daySky = mix(vec3(0.58, 0.76, 0.91), vec3(0.12, 0.39, 0.76), smoothstep(0.0, 0.92, h));
      const greySky = mix(daySky, vec3(0.48, 0.57, 0.66), atmo.overcast.mul(0.78));
      const nightSky = mix(vec3(0.004, 0.009, 0.025), vec3(0.018, 0.035, 0.075), h);
      const simple = mix(greySky, nightSky, atmo.night).toVar();
      const cloudT = max(clouds.base.sub(cameraPosition.y).div(max(dir.y, 0.06)), 0);
      const cloudSample = cloudAt(cameraPosition.add(dir.mul(cloudT)).xz);
      const cloudAmount = cloudSample.x.mul(smoothstep(0.04, 0.32, cloudSample.y))
        .mul(float(1).sub(atmo.night)).mul(0.9);
      const cloudColor = mix(vec3(0.91, 0.95, 0.99), vec3(0.49, 0.56, 0.64), atmo.overcast.mul(0.72));
      simple.assign(mix(simple, cloudColor, cloudAmount));
      const sunDot = dot(dir, sun);
      const sunGlow = pow(max(sunDot, 0), 96).mul(0.18).add(smoothstep(0.99935, 0.99972, sunDot).mul(2.2));
      simple.addAssign(vec3(1.0, 0.72, 0.39).mul(sunGlow).mul(float(1).sub(atmo.night)));
      const moonDot = dot(dir, moon);
      simple.addAssign(vec3(0.72, 0.82, 1.0).mul(smoothstep(0.99945, 0.99972, moonDot)).mul(atmo.night).mul(0.8));
      return select(dir.y.lessThan(0), vec3(0.012, 0.035, 0.055), simple);
    }""",
"add simplified sky shader early return")


# Slightly reduce ocean FFT dispatch frequency only for the explicit 15 Hz A/B.
# Wave geometry, amplitude, current and every water material remain unchanged.
patch("src/main.ts",
"      if (oceanAccumulator >= (new URLSearchParams(location.search).has('ocean20') ? 1 / 20 : 1 / 30)) {",
"      const oceanRate = new URLSearchParams(location.search).has('ocean15') ? 1 / 15 : new URLSearchParams(location.search).has('ocean20') ? 1 / 20 : 1 / 30;\n      if (oceanAccumulator >= oceanRate) {",
"add reversible 15 Hz ocean simulation test")

# A dedicated ride state for the lower river, separate from ordinary swimming.
# It detects only the existing downstream channel after the plunge pool (sample 9+).
patch("src/player/Player.ts",
"  state: 'ground' | 'air' | 'swim' = 'ground';",
"  state: 'ground' | 'air' | 'swim' | 'ride' = 'ground';\n  private channelRide = false;\n  private rideEntryT = -1;\n  private rideTime = 0;\n  private rideArms: { bone: THREE.Object3D; side: number; forearm: boolean }[] = [];\n  private rideLegs: { bone: THREE.Object3D; kind: 'thigh' | 'calf' | 'foot' }[] = [];\n  private rideArmEuler = new THREE.Euler();\n  private rideArmOffset = new THREE.Quaternion();\n  private rideLegEuler = new THREE.Euler();\n  private rideLegOffset = new THREE.Quaternion();",
"add controllable channel ride state and arm pose")
patch("src/player/Player.ts",
"  onSplash: ((strength: number, pos: THREE.Vector3) => void) | null = null;",
"  onSplash: ((strength: number, pos: THREE.Vector3) => void) | null = null;\n  onChannelRide: (() => void) | null = null;",
"channel ride sound callback")
patch("src/player/Player.ts",
"    if (!this.ready) return;\n    const refYaw = intent.worldYaw ?? camYaw;",
"""    if (!this.ready) return;
    // Detect the lower river after the plunge pool. Entering it transfers control
    // to a grounded, seated water-slide state; the normal swim state is untouched.
    this.updateWater();
    let nr = this.hf.nearestRiver(this.pos.x, this.pos.z);
    let sample = this.hf.river[nr.i];
    const inLowerChannel = nr.i >= 9 && nr.i < this.hf.river.length - 1
      && nr.d < sample.w / 2 + 1.35 && sample.water > 0.05 && this.waterDepth > 0.18;
    if (!this.channelRide && inLowerChannel && this.state !== 'air') {
      this.channelRide = true;
      this.state = 'ride';
      this.rideEntryT = 0;
      this.rideTime = 0;
      this.vel.y = 0;
      this.onChannelRide?.();
    }
    if (this.channelRide) {
      // Jump is the explicit escape from the channel. Keep the player's momentum
      // and hand the next frame back to the ordinary airborne controller.
      if (intent.jump) {
        this.channelRide = false;
        this.rideEntryT = -1;
        this.state = 'air';
        this.vel.y = JUMP_V * 1.12;
        this.airTime = 0;
        this.jumpT = 0;
      } else {
        const i = Math.min(this.hf.river.length - 1, nr.i);
        if (i >= this.hf.river.length - 1 || sample.water <= 0.05) {
          this.channelRide = false;
          this.rideEntryT = -1;
          this.state = this.waterDepth > SWIM_DEPTH ? 'swim' : 'ground';
          if (this.state === 'swim') this.pos.y = this.waterLevel - SWIM_SINK;
          else this.pos.y = this.groundAt(this.pos.x, this.pos.z, 1e9).y;
        } else {
          const a = this.hf.river[Math.max(8, i - 1)];
          const b = this.hf.river[Math.min(this.hf.river.length - 1, i + 1)];
          const dx = b.x - a.x, dz = b.z - a.z;
          const len = Math.hypot(dx, dz) || 1;
          const vx = dx / len, vz = dz / len;
          const rx = -vz, rz = vx;
          const refYaw = intent.worldYaw ?? camYaw;
          const fx = Math.sin(refYaw) * intent.moveY + Math.cos(refYaw) * intent.moveX;
          const fz = -Math.cos(refYaw) * intent.moveY + Math.sin(refYaw) * intent.moveX;
          const along = fx * vx + fz * vz;
          const across = fx * rx + fz * rz;
          const forwardSpeed = THREE.MathUtils.clamp(5.2 + along * 3.4, -1.2, 8.6);
          const sideSpeed = across * 3.0;
          this.vel.set(vx * forwardSpeed + rx * sideSpeed, 0, vz * forwardSpeed + rz * sideSpeed);
          let nx = this.pos.x + this.vel.x * dt;
          let nz = this.pos.z + this.vel.z * dt;
          nr = this.hf.nearestRiver(nx, nz);
          sample = this.hf.river[nr.i];
          if (nr.i >= 9 && nr.i < this.hf.river.length - 1) {
            // Keep the full avatar inside the usable water margin while sliding.
            // This clamp is intentionally inside the non-jump ride branch: pressing
            // jump exits channelRide before reaching it, so airborne steering stays free.
            const maxOffset = Math.max(0.25, sample.w / 2 - 0.95);
            if (nr.d > maxOffset) {
              const k = maxOffset / Math.max(nr.d, 1e-4);
              nx = sample.x + (nx - sample.x) * k;
              nz = sample.z + (nz - sample.z) * k;
            }
          }
          this.pos.x = nx;
          this.pos.z = nz;
          this.moveA = Math.atan2(vx, -vz);
          let turn = this.moveA - this.heading;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          this.heading += turn * (1 - Math.exp(-dt * 7));
          const bed = this.hf.height(nx, nz);
          this.pos.y = bed + 0.035;
          this.updateWater();
          this.speed = Math.hypot(this.vel.x, this.vel.z);
          this.surface = 'water';
          this.wetness = Math.max(this.wetness, 0.95);
          this.rideTime += dt;
          this.rideEntryT += dt;
          playerU.wet.value = Math.max(this.wetness, this.rainWet);
          this.animate(dt);
          this.syncRoot();
          this.updateContact();
          return;
        }
      }
    }
    const refYaw = intent.worldYaw ?? camYaw;""",
"controllable seated channel ride with grounded exit")
patch("src/player/Player.ts",
"    if (this.state === 'swim') {\n      const m = THREE.MathUtils.smoothstep(sp, 0.2, 1.0);",
"""    if (this.state === 'ride') {
      const settled = THREE.MathUtils.smoothstep(this.rideEntryT, 0.08, 0.55);
      this.setW('fall', (1 - settled) * 0.72);
      this.setW('sit', settled * 0.9);
      this.setW('swim', settled * 0.18);
      this.phase += dt / (c.swim?.duration ?? 1.33);
    } else if (this.state === 'swim') {
      const m = THREE.MathUtils.smoothstep(sp, 0.2, 1.0);""",
"fall-to-sit entry and moving water-slide pose")

# Add a joyful Spanish cheer on channel entry using the device's available speech voice.
# No external audio assets or network requests are required.
patch("src/audio/Audio.ts",
"    for (const f of ['splash_big', 'splash_small', 'thunder_1', 'thunder_2', 'thunder_3', 'land_sand']) this.load(f);",
"    for (const f of ['splash_big', 'splash_small', 'thunder_1', 'thunder_2', 'thunder_3', 'land_sand', 'channel_cheer']) this.load(f);",
"load original channel cheer audio")
patch("src/audio/Audio.ts",
"  swimStroke(pos: THREE.Vector3) {\n    const list = STEP_FILES.water;\n    this.play(list[Math.floor(Math.random() * list.length)], 0.35, 0.9 + Math.random() * 0.2, 0, pos);\n  }",
"""  swimStroke(pos: THREE.Vector3) {
    const list = STEP_FILES.water;
    this.play(list[Math.floor(Math.random() * list.length)], 0.35, 0.9 + Math.random() * 0.2, 0, pos);
  }

  private fallsCheerArmed = true;
  private fallsCheerPending = false;

  /** Three spatialized childlike shouts as the listener enters the waterfall area. */
  fallsCheers(listener: THREE.Vector3) {
    const distance = listener.distanceTo(this.fallsPos);
    if (distance > 68) { this.fallsCheerArmed = true; return; }
    if (distance > 42 || !this.fallsCheerArmed || this.fallsCheerPending || this.muted) return;
    this.fallsCheerArmed = false; this.fallsCheerPending = true;
    const playCrowd = () => {
      const buffer = this.buffers.get('channel_cheer');
      let peak = 0;
      if (buffer) for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const samples = buffer.getChannelData(channel);
        for (let i = 0; i < samples.length; i += 16) peak = Math.max(peak, Math.abs(samples[i]));
      }
      if (peak < 0.001) { this.speakFallsCrowd(); this.fallsCheerPending = false; return; }
      const p = this.fallsPos;
      const voices = [
        { x: p.x - 4.5, y: p.y + 2, z: p.z - 2.5, gain: 0.72, rate: 0.88, delay: 0 },
        { x: p.x + 3.8, y: p.y + 3, z: p.z + 1.5, gain: 0.62, rate: 1.04, delay: 0.13 },
        { x: p.x + 0.5, y: p.y - 1, z: p.z - 4, gain: 0.66, rate: 1.14, delay: 0.27 },
      ];
      for (const v of voices) this.play('channel_cheer', v.gain, v.rate, v.delay, new THREE.Vector3(v.x, v.y, v.z));
      this.fallsCheerPending = false;
    };
    const attempt = (remaining: number) => {
      if (this.buffers.has('channel_cheer')) { playCrowd(); return; }
      if (remaining <= 0) { this.speakFallsCrowd(); this.fallsCheerPending = false; return; }
      void this.load('channel_cheer').then((buffer) => {
        if (buffer) playCrowd();
        else window.setTimeout(() => attempt(remaining - 1), 250);
      });
    };
    attempt(16);
  }

  private speakFallsCrowd() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const spanish = voices.find((v) => v.lang.toLowerCase().startsWith('es-ar'))
      ?? voices.find((v) => v.lang.toLowerCase().startsWith('es'));
    const shouts = [
      { text: '¡Aaaaaaaah!', pitch: 1.65, rate: 0.88 },
      { text: '¡Ooooooooh!', pitch: 1.85, rate: 0.98 },
      { text: '¡Yujuuuuu!', pitch: 2.0, rate: 1.08 },
    ];
    shouts.forEach((shout, index) => window.setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(shout.text);
      utterance.lang = 'es-AR'; utterance.pitch = shout.pitch; utterance.rate = shout.rate; utterance.volume = 0.95;
      if (spanish) utterance.voice = spanish;
      window.speechSynthesis.speak(utterance);
    }, index * 180));
  }

  cheer() { /* The celebration now belongs to the waterfall, not the avatar. */ }""",
"add joyful channel cheer")
patch("src/main.ts",
"  player.onSplash = (s, p) => audio.splash(s, p);",
"  player.onSplash = (s, p) => audio.splash(s, p);\n  player.onChannelRide = () => audio.cheer();",
"connect channel ride cheer")


print("ILOX natural-world adaptation prepared; mobile view distance defaults to 50 m.")


# Keep the avatar grounded at the channel bed, steerable in the current, and able to jump out.
patch("src/player/Player.ts",
"    this.model = g.scene;",
"""    this.model = g.scene;
    this.model.traverse((o) => {
      const n = o.name.replace(/[ _]/g, '').toLowerCase();
      const match = n.match(/^bip01([lr])(upperarm|forearm)$/);
      if (match) this.rideArms.push({
        bone: o, side: match[1] === 'l' ? -1 : 1,
        forearm: match[2] === 'forearm',
      });
      const leg = n.match(/^bip01[lr](thigh|calf|foot)$/);
      if (leg) this.rideLegs.push({ bone: o, kind: leg[1] as 'thigh' | 'calf' | 'foot' });
    });""",
"capture avatar arm bones for ride celebration")

patch("src/player/Player.ts",
"    this.mixer.update(0);",
"""    this.mixer.update(0);
    // Layer the ride pose over the current animation pose (not the bind pose).
    // This preserves each side's animated articulation and avoids a limp arm reset.
    if (this.state === 'ride') {
      const wave = Math.sin(this.rideTime * 5.4);
      for (const arm of this.rideArms) {
        const animated = arm.bone.quaternion.clone();
        const raise = arm.forearm ? 0.55 + wave * 0.28 : 1.12 + wave * 0.16;
        this.rideArmEuler.set(arm.forearm ? -0.82 : -0.12, 0, arm.side * raise);
        this.rideArmOffset.setFromEuler(this.rideArmEuler);
        arm.bone.quaternion.copy(animated).multiply(this.rideArmOffset);
      }
      // Experimental water-slide leg extension, layered only during the ride.
      for (const leg of this.rideLegs) {
        const animated = leg.bone.quaternion.clone();
        const angle = leg.kind === 'thigh' ? 0.42 : leg.kind === 'calf' ? -0.72 : 0.06;
        this.rideLegEuler.set(angle, 0, 0);
        this.rideLegOffset.setFromEuler(this.rideLegEuler);
        leg.bone.quaternion.copy(animated).multiply(this.rideLegOffset);
      }
    }""",
"procedural moving celebratory arms during channel ride")


# Waterfall crowd voices play at the falls, not on the avatar's channel-ride callback.
patch("src/main.ts",
"    audio.update(dt, camera, { night: tod.night, rain: weather.rain, wind: weather.wind, underwater: camera.position.y < player.waterLevel - 0.05 });",
"    audio.fallsCheers(camera.position);\n    audio.update(dt, camera, { night: tod.night, rain: weather.rain, wind: weather.wind, underwater: camera.position.y < player.waterLevel - 0.05 });",
"trigger waterfall crowd voices on approach")

# A readable wooden wayfinding sign beside the waterfall approach.
patch("src/main.ts",
"  const river = new River(hf);",
"""  const river = new River(hf);
  if (!skip.has('river')) scene.add(river.group);
  const fallsSign = new THREE.Group();
  const signCanvas = document.createElement('canvas'); signCanvas.width = 512; signCanvas.height = 160;
  const signCtx = signCanvas.getContext('2d')!;
  signCtx.fillStyle = '#263c2d'; signCtx.fillRect(0,0,512,160);
  signCtx.strokeStyle = '#d9c28d'; signCtx.lineWidth = 10; signCtx.strokeRect(7,7,498,146);
  signCtx.fillStyle = '#f7efd9'; signCtx.font = 'bold 58px system-ui'; signCtx.textAlign = 'center'; signCtx.fillText('CASCADA',240,101);
  signCtx.strokeStyle = '#f7efd9'; signCtx.lineWidth = 12; signCtx.lineCap = 'round';
  signCtx.beginPath(); signCtx.moveTo(395,80); signCtx.lineTo(465,80); signCtx.lineTo(438,53); signCtx.moveTo(465,80); signCtx.lineTo(438,107); signCtx.stroke();
  const signMap = new THREE.CanvasTexture(signCanvas); signMap.colorSpace = THREE.SRGBColorSpace;
  const signWood = new THREE.MeshStandardMaterial({color:0x64462c,roughness:0.9});
  const signFace = new THREE.MeshStandardMaterial({map:signMap,roughness:0.85});
  const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.18,2.8,0.18),signWood); signPost.position.y=1.4; fallsSign.add(signPost);
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(4.4,1.45,0.2),signWood); signBoard.position.y=2.55; fallsSign.add(signBoard);
  const signFront = new THREE.Mesh(new THREE.PlaneGeometry(4.22,1.28),signFace); signFront.position.set(0,2.55,0.111); fallsSign.add(signFront);
  const lip = hf.meta.falls.lip; let fallsIndex=0, fallsBest=Infinity;
  for(let i=0;i<hf.river.length;i++){const d=Math.hypot(hf.river[i].x-lip[0],hf.river[i].z-lip[1]);if(d<fallsBest){fallsBest=d;fallsIndex=i;}}
  const upstream=hf.river[Math.max(0,fallsIndex-3)], downstream=hf.river[Math.min(hf.river.length-1,fallsIndex+2)];
  const tx=downstream.x-upstream.x,tz=downstream.z-upstream.z,tl=Math.hypot(tx,tz)||1;
  const tangentX=tx/tl,tangentZ=tz/tl,side=(hf.river[fallsIndex]?.w??8)/2+3.5;
  const signX=upstream.x-tangentX*5-tangentZ*side,signZ=upstream.z-tangentZ*5+tangentX*side;
  fallsSign.position.set(signX,hf.height(signX,signZ),signZ); fallsSign.rotation.y=Math.atan2(-tangentX,-tangentZ); scene.add(fallsSign);""",
"add waterfall wayfinding sign")

# Ask the browser to lock landscape after its first permitted user gesture; the PWA manifest also declares landscape.
patch("src/main.ts",
"  setTimeout(() => loading.done(), 250);",
"  setTimeout(() => { loading.done(); document.body.classList.add('ilox-game-ready'); }, 250);",
"reveal controls only after loading completes")

patch("src/main.ts",
"  const startAudio = () => audio.start();",
"""  const startAudio = () => {
    audio.start();
    try { const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> }; void orientation?.lock?.('landscape').catch(() => {}); }
    catch { /* The installable PWA manifest also requests landscape. */ }
  };""",
"request landscape orientation")



# Functional quad bike: reuses the same movement intent, with a faster vehicle mode.
patch("src/player/Player.ts",
"  heading = 0;",
"  heading = 0;\n  vehicleMode = false;",
"add vehicle driving state")
patch("src/player/Player.ts",
"    let top = swim ? (intent.sprint ? SWIM_FAST : SWIM) : intent.sprint ? SPRINT : intent.walk ? WALK : RUN;",
"    let top = this.vehicleMode ? (intent.sprint ? 16 : intent.walk ? 5 : 10) : swim ? (intent.sprint ? SWIM_FAST : SWIM) : intent.sprint ? SPRINT : intent.walk ? WALK : RUN;",
"vehicle speed uses existing movement controls")
patch("src/player/Player.ts",
"    if (!swim && mag < 0.55 && !intent.sprint) top = THREE.MathUtils.lerp(WALK, RUN, Math.max(0, mag - 0.2) / 0.35);",
"    if (!this.vehicleMode && !swim && mag < 0.55 && !intent.sprint) top = THREE.MathUtils.lerp(WALK, RUN, Math.max(0, mag - 0.2) / 0.35);",
"preserve vehicle throttle speed")

patch("src/main.ts",
"  rig.snapBehind(spot.yaw);",
"""  rig.snapBehind(spot.yaw);

  // ILOX functional quad: parked beside the village spawn; player input drives it when mounted.
  const quadBike = new THREE.Group();
  quadBike.name = 'ilox-quad-bike';
  const quadFrame = new THREE.MeshStandardMaterial({ color: 0x344b35, roughness: 0.72, metalness: 0.12 });
  const quadRubber = new THREE.MeshStandardMaterial({ color: 0x171a18, roughness: 0.96 });
  const quadMetal = new THREE.MeshStandardMaterial({ color: 0x737b70, roughness: 0.45, metalness: 0.65 });
  const quadSeat = new THREE.MeshStandardMaterial({ color: 0x282622, roughness: 0.92 });
  const quadPart = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; quadBike.add(mesh); return mesh;
  };
  quadPart(new THREE.BoxGeometry(0.82, 0.22, 1.35), quadFrame, 0, 0.66, 0);
  quadPart(new THREE.BoxGeometry(0.48, 0.18, 0.62), quadSeat, 0, 0.88, 0.12);
  quadPart(new THREE.BoxGeometry(0.58, 0.16, 0.42), quadFrame, 0, 0.79, -0.56);
  quadPart(new THREE.BoxGeometry(0.64, 0.12, 0.38), quadFrame, 0, 0.78, 0.58);
  quadPart(new THREE.CylinderGeometry(0.055, 0.055, 0.82, 10), quadMetal, 0, 1.02, -0.64).rotation.z = Math.PI / 2;
  quadPart(new THREE.BoxGeometry(0.48, 0.08, 0.12), quadMetal, 0, 1.02, -0.64);
  quadPart(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf3dca1, emissive: 0x665020 }), 0, 0.83, -0.73);
  const quadWheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.19, 14);
  quadWheelGeo.rotateZ(Math.PI / 2);
  for (const x of [-0.58, 0.58]) for (const z of [-0.68, 0.68]) {
    const wheel = quadPart(quadWheelGeo, quadRubber, x, 0.34, z);
    const hub = quadPart(new THREE.CylinderGeometry(0.12, 0.12, 0.205, 10), quadMetal, x, 0.34, z);
    hub.rotation.z = Math.PI / 2;
    void wheel;
  }
  quadBike.position.set(spot.player[0] + 3, hf.height(spot.player[0] + 3, spot.player[1] + 3), spot.player[1] + 3);
  quadBike.rotation.y = spot.yaw;
  scene.add(quadBike);
  let quadMounted = false;
  const quadButton = document.getElementById('ilox-vehicle-toggle');
  const toggleQuad = () => {
    if (quadMounted) {
      quadMounted = false; player.vehicleMode = false;
      if (quadButton) quadButton.textContent = 'SUBIR ATV';
      return;
    }
    if (Math.hypot(player.pos.x - quadBike.position.x, player.pos.z - quadBike.position.z) > 5.5) {
      if (quadButton) quadButton.textContent = 'ACERCATE AL ATV';
      window.setTimeout(() => { if (quadButton && !quadMounted) quadButton.textContent = 'SUBIR ATV'; }, 1500);
      return;
    }
    quadMounted = true; player.vehicleMode = true;
    if (quadButton) quadButton.textContent = 'BAJAR ATV';
  };
  quadButton?.addEventListener('click', toggleQuad);""",
"add drivable quad bike and mount interaction")
patch("src/main.ts",
"    const intent = input.read(dt);",
"    const intent = input.read(dt);\n    if (input.hit('KeyE')) toggleQuad();",
"keyboard mount and dismount")
patch("src/main.ts",
"    player.update(dt, playerIntent, rig.yaw);\n    rig.update(dt,",
"    player.update(dt, playerIntent, rig.yaw);\n    if (quadMounted) {\n      quadBike.position.set(player.pos.x, player.pos.y, player.pos.z);\n      quadBike.rotation.y = player.heading;\n      player.root.position.y += 0.48;\n    }\n    rig.update(dt,",
"drive quad with player movement and camera follow")



# ILOX corrective pass: keep the ATV cheap to render, seat its rider, and use
# the common 42 m construction plane with a practical tolerance.
# These are additive repairs to the generated source; water, sky and terrain
# rendering/performance systems are deliberately untouched.
patch("src/main.ts",
"  const quadMetal = new THREE.MeshStandardMaterial({ color: 0x737b70, roughness: 0.45, metalness: 0.65 });\n  const quadSeat = new THREE.MeshStandardMaterial({ color: 0x282622, roughness: 0.92 });",
"  const quadMetal = quadFrame;\n  const quadSeat = quadRubber;",
"reuse ATV materials to reduce shader variants")
patch("src/main.ts",
"    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; quadBike.add(mesh); return mesh;",
"    mesh.position.set(x, y, z); mesh.castShadow = false; mesh.receiveShadow = false; quadBike.add(mesh); return mesh;",
"disable unnecessary ATV shadow passes")
patch("src/main.ts",
"new THREE.MeshStandardMaterial({ color: 0xf3dca1, emissive: 0x665020 })",
"quadMetal",
"reuse ATV headlight material")
patch("src/main.ts",
"  for (const x of [-0.58, 0.58]) for (const z of [-0.68, 0.68]) {",
"  const quadWheels: THREE.Mesh[] = [];\n  for (const x of [-0.58, 0.58]) for (const z of [-0.68, 0.68]) {",
"track ATV wheels for rotation")
patch("src/main.ts",
"    const wheel = quadPart(quadWheelGeo, quadRubber, x, 0.34, z);\n    const hub = quadPart(new THREE.CylinderGeometry(0.12, 0.12, 0.205, 10), quadMetal, x, 0.34, z);",
"    const wheel = quadPart(quadWheelGeo, quadRubber, x, 0.34, z);\n    quadWheels.push(wheel);\n    const hub = quadPart(new THREE.CylinderGeometry(0.12, 0.12, 0.205, 10), quadMetal, x, 0.34, z);",
"rotate the quad wheels")
patch("src/main.ts",
"  quadBike.rotation.y = spot.yaw;\n  scene.add(quadBike);",
"  quadBike.rotation.y = spot.yaw;\n  const quadRider = new THREE.Group();\n  const riderPart = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => {\n    const mesh = new THREE.Mesh(geometry, material);\n    mesh.position.set(x, y, z); mesh.rotation.set(rx, 0, rz); mesh.castShadow = false; mesh.receiveShadow = false;\n    quadRider.add(mesh);\n  };\n  riderPart(new THREE.CylinderGeometry(0.15, 0.21, 0.48, 8), quadFrame, 0, 1.17, 0.16, -0.32);\n  riderPart(new THREE.SphereGeometry(0.14, 10, 8), quadFrame, 0, 1.53, 0.04);\n  riderPart(new THREE.SphereGeometry(0.155, 10, 8), quadRubber, 0, 1.59, 0.04);\n  riderPart(new THREE.CylinderGeometry(0.045, 0.055, 0.46, 7), quadFrame, -0.22, 1.25, -0.17, -0.85, -0.48);\n  riderPart(new THREE.CylinderGeometry(0.045, 0.055, 0.46, 7), quadFrame, 0.22, 1.25, -0.17, -0.85, 0.48);\n  riderPart(new THREE.CylinderGeometry(0.07, 0.085, 0.42, 7), quadRubber, -0.12, 0.87, -0.13, -1.05);\n  riderPart(new THREE.CylinderGeometry(0.07, 0.085, 0.42, 7), quadRubber, 0.12, 0.87, -0.13, -1.05);\n  quadRider.visible = false;\n  quadBike.add(quadRider);\n  scene.add(quadBike);",
"add seated low-poly rider without extra shadow cost")
patch("src/main.ts",
"    if (quadMounted) {\n      quadMounted = false; player.vehicleMode = false;\n      if (quadButton) quadButton.textContent = 'SUBIR ATV';",
"    if (quadMounted) {\n      quadMounted = false; player.vehicleMode = false; player.root.visible = true; quadRider.visible = false;\n      if (quadButton) quadButton.textContent = 'SUBIR ATV';",
"restore avatar on ATV dismount")
patch("src/main.ts",
"    quadMounted = true; player.vehicleMode = true;\n    if (quadButton) quadButton.textContent = 'BAJAR ATV';",
"    quadMounted = true; player.vehicleMode = true; player.root.visible = false; quadRider.visible = true;\n    if (quadButton) quadButton.textContent = 'BAJAR ATV';",
"seat rider and hide walking avatar while mounted")
patch("src/main.ts",
"      quadBike.position.set(player.pos.x, player.pos.y, player.pos.z);\n      quadBike.rotation.y = player.heading;\n      player.root.position.y += 0.48;",
"      quadBike.position.set(player.pos.x, player.pos.y, player.pos.z);\n      quadBike.rotation.y = player.heading;\n      for (const wheel of quadWheels) wheel.rotation.x += player.speed * dt / 0.34;",
"move quad, rotate wheels, and do not drag the walking avatar")


# Compact bottom game menu and a first usable construction loop for mobile testing.
index_path = root / "index.html"
index_html = index_path.read_text(encoding="utf-8")
jump_marker = '      <button class="ilox-action" id="ilox-jump" type="button">SALTAR</button>\n'
game_markup = """      <nav id="ilox-toolbar" aria-label="Menú del juego">
        <button type="button" data-game-panel="backpack"><span>🎒</span><small>MOCHILA</small></button>
        <button type="button" data-game-panel="inventory"><span>▦</span><small>INVENTARIO</small></button>
        <button type="button" data-game-panel="build"><span>⌂</span><small>CONSTRUIR</small></button>
        <button type="button" id="ilox-vehicle-toggle">SUBIR ATV</button>
      </nav>
      <section id="ilox-game-panel" aria-live="polite"><header><strong id="ilox-game-title">ILOX</strong><button id="ilox-game-close" type="button">×</button></header><div id="ilox-game-content"></div></section>
      <output id="ilox-build-status">Elegí una herramienta para comenzar</output>
"""
if jump_marker not in index_html:
    raise SystemExit("ILOX game toolbar insertion point missing")
index_html = index_html.replace(jump_marker, jump_marker + game_markup, 1)
landscape_marker = '    </div>\n    <script type="module" src="./src/main.ts"></script>'
if landscape_marker not in index_html:
    raise SystemExit("ILOX landscape overlay insertion point missing")
index_html = index_html.replace(landscape_marker, '    </div>\n    <div id="ilox-landscape-block"><div><strong>ILOX</strong><p>Iniciando en horizontal…</p><span>Si el teléfono no gira automáticamente, rotalo para jugar</span></div></div>\n    <script>\n      (() => {\n        const updateOrientation = () => {\n          const landscape = window.matchMedia ? window.matchMedia("(orientation: landscape)").matches : window.innerWidth >= window.innerHeight;\n          document.body.classList.toggle("ilox-landscape", landscape);\n        };\n        updateOrientation();\n        window.addEventListener("resize", updateOrientation, { passive: true });\n        window.addEventListener("orientationchange", updateOrientation, { passive: true });\n        try { screen.orientation?.addEventListener?.("change", updateOrientation); } catch {}\n        try { window.matchMedia("(orientation: landscape)").addEventListener("change", updateOrientation); } catch {}\n      })();\n    </script>\n    <script type="module" src="./src/main.ts"></script>', 1)
game_css = """
      body:not(.ilox-game-ready) #ilox-touch, body:not(.ilox-game-ready) #ilox-toolbar, body:not(.ilox-game-ready) #ilox-game-panel, body:not(.ilox-game-ready) #ilox-build-status, body:not(.ilox-game-ready) #ilox-graphics-toggle, body:not(.ilox-game-ready) #ilox-aim-dot, body:not(.ilox-game-ready) #ilox-aim-distance { display:none !important; }
      #ilox-toolbar { position:absolute; left:50%; bottom:max(8px,env(safe-area-inset-bottom)); transform:translateX(-50%); display:flex; gap:6px; pointer-events:auto; }
      #ilox-toolbar button { width:54px; height:54px; padding:4px 2px; border:1px solid rgba(235,240,225,.38); border-radius:9px; color:#f7f4e9; background:rgba(9,20,16,.82); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; box-shadow:0 2px 10px rgba(0,0,0,.25); }
      #ilox-vehicle-toggle { min-width:74px; font-size:9px !important; font-weight:700 !important; border-color:rgba(222,194,115,.7) !important; }\n      #ilox-toolbar span { font-size:20px; line-height:22px; } #ilox-toolbar small { font:600 7px system-ui; letter-spacing:.03em; }
      #ilox-game-panel { display:none; position:absolute; left:50%; bottom:72px; transform:translateX(-50%); width:min(340px,calc(100vw - 24px)); max-height:min(48vh,330px); overflow:auto; padding:12px; border:1px solid rgba(235,240,225,.25); border-radius:12px; color:#f4efe3; background:rgba(8,18,15,.94); box-shadow:0 8px 28px rgba(0,0,0,.42); pointer-events:auto; font:12px system-ui; backdrop-filter:blur(10px); }
      #ilox-game-panel.open { display:block; } #ilox-game-panel header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; letter-spacing:.08em; }
      #ilox-game-panel header button { color:white; background:transparent; border:0; font-size:22px; }
      #ilox-game-content { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; }
      #ilox-game-content p { grid-column:1/-1; margin:2px 0 6px; color:rgba(245,245,235,.78); line-height:1.4; }
      #ilox-game-content button { min-height:48px; border:1px solid rgba(235,240,225,.25); border-radius:8px; color:#f7f4e9; background:rgba(75,100,76,.55); font:600 10px system-ui; }
      #ilox-game-content button.selected { border-color:#e4cf91; background:rgba(117,105,57,.75); }
      #ilox-build-status { display:none; position:fixed; z-index:88; left:50%; bottom:136px; transform:translateX(-50%); max-width:90vw; padding:7px 10px; border-radius:7px; color:#fff; background:rgba(0,0,0,.76); font:600 11px system-ui; text-align:center; pointer-events:none; }
      body.ilox-landscape #ilox-landscape-block { display:none !important; }\n      #ilox-landscape-block { display:none; position:fixed; inset:0; z-index:200; align-items:center; justify-content:center; text-align:center; color:#f7f4e9; background:#101b16; font:14px system-ui; }
      #ilox-landscape-block strong { font:300 32px Georgia,serif; letter-spacing:.3em; } #ilox-landscape-block p { margin:16px 0 8px; font-size:17px; }
      body.ilox-building .ilox-action { pointer-events:none !important; }
      @media (orientation:portrait) and (pointer:coarse) { #ilox-landscape-block { display:flex; } #ilox-touch { display:none !important; } }
"""
if "</style>" not in index_html:
    raise SystemExit("ILOX style insertion point missing")
index_html = index_html.replace("</style>", game_css + "\n    </style>", 1)
index_path.write_text(index_html, encoding="utf-8")

patch("src/world/Heightfield.ts",
"  /** unit normal (x, y, z) from central differences over " + chr(96) + "e" + chr(96) + " metres */",
"  /** Gently levels a 4 m building footprint without digging; a soft outer falloff blends it into the landscape. */\n  flattenArea(x: number, z: number, radius = 3.8) {\n    const N=this.n, h=this.heights, cell=WORLD_SIZE/N, target=this.height(x,z);\n    const fx=(x+HALF_WORLD)/cell-0.5, fz=(z+HALF_WORLD)/cell-0.5;\n    const reach=radius/cell;\n    const i0=Math.max(0,Math.floor(fx-reach)), i1=Math.min(N-1,Math.ceil(fx+reach));\n    const j0=Math.max(0,Math.floor(fz-reach)), j1=Math.min(N-1,Math.ceil(fz+reach));\n    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++) {\n      const px=(i+0.5)*cell-HALF_WORLD,pz=(j+0.5)*cell-HALF_WORLD,d=Math.hypot(px-x,pz-z);\n      if(d>radius) continue;\n      const blend=d<=radius-0.8?1:Math.max(0,Math.min(1,(radius-d)/0.8));\n      const k=j*N+i; h[k]=h[k]+(target-h[k])*blend;\n    }\n    if(this.heightTex) this.heightTex.needsUpdate=true;\n  }\n\n  /** unit normal (x, y, z) from central differences over e metres */",
"add gentle terrain leveling method")

patch("src/main.ts",
"  const hud = new Hud(false); // ILOX keeps the natural world unobstructed.",
"""  const hud = new Hud(false); // ILOX keeps the natural world unobstructed.
  const gamePanel = document.getElementById('ilox-game-panel');
  const gameTitle = document.getElementById('ilox-game-title');
  const gameContent = document.getElementById('ilox-game-content');
  const buildStatus = document.getElementById('ilox-build-status') as HTMLOutputElement | null;
  const buildGroup = new THREE.Group(); scene.add(buildGroup);
  const builtFloors: { x: number; z: number; y: number }[] = [];
  let activeBuild: 'flatten' | 'floor' | 'wall' | 'roof' | 'door' | 'window' | 'stairs' | null = null;
  const stock = { boards: 60, placed: 0 };
  let statusTimer = 0;
  const showBuildStatus = (message: string) => {
    if (!buildStatus) return;
    buildStatus.textContent = message; buildStatus.style.display = 'block';
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { buildStatus.style.display = 'none'; }, 2400);
  };
  const closeGamePanel = () => { gamePanel?.classList.remove('open'); activeBuild = null; document.body.classList.remove('ilox-building'); };
  const openGamePanel = (kind: string) => {
    gamePanel?.classList.add('open');
    if (!gameContent || !gameTitle) return;
    activeBuild = null; document.body.classList.remove('ilox-building');
    if (kind === 'backpack') {
      gameTitle.textContent = 'MOCHILA';
      gameContent.innerHTML = '<p>Herramientas disponibles en esta prueba.</p><button type="button" disabled>🔨 MARTILLO</button><button type="button" disabled>📐 PLANO</button><button type="button" disabled>🪓 HACHA</button>';
    } else if (kind === 'inventory') {
      gameTitle.textContent = 'INVENTARIO';
      gameContent.innerHTML = '<p>Material de prueba: '+stock.boards+' tablas · Piezas colocadas: '+stock.placed+'</p><button type="button" disabled>🪵 TABLAS</button><button type="button" disabled>🪟 VENTANAS</button><button type="button" disabled>🚪 PUERTAS</button>';
    } else {
      gameTitle.textContent = 'CONSTRUCCIÓN';
      gameContent.innerHTML = '<p>Antes de colocar un piso, nivelá el terreno con la pala. Luego elegí la pieza.</p><button data-build="flatten">🪏 APLANAR</button><button data-build="floor">▰ PISO</button><button data-build="wall">▥ PARED</button><button data-build="roof">▱ TECHO</button><button data-build="door">🚪 PUERTA</button><button data-build="window">▣ VENTANA</button><button data-build="stairs">▤ ESCALERA</button>';
      gameContent.querySelectorAll<HTMLButtonElement>('[data-build]').forEach((button) => button.addEventListener('click', () => {
        activeBuild = button.dataset.build as typeof activeBuild;
        document.body.classList.add('ilox-building');
        gameContent.querySelectorAll('button').forEach((b) => b.classList.toggle('selected', b === button));
        gamePanel?.classList.remove('open');
        showBuildStatus(activeBuild === 'flatten' ? 'Tocá el terreno: la pala lo va a nivelar' : activeBuild === 'floor' ? 'Mové el piso fantasma; verde significa que encaja' : 'Elegí un lado de un piso existente');
      }));
    }
  };
  document.querySelectorAll<HTMLButtonElement>('[data-game-panel]').forEach((button) => button.addEventListener('click', () => openGamePanel(button.dataset.gamePanel ?? 'backpack')));
  document.getElementById('ilox-game-close')?.addEventListener('click', closeGamePanel);
  const buildRay = new THREE.Raycaster(), buildPointer = new THREE.Vector2();
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x9a7045, roughness: 0.88 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x8bc9d8, roughness: 0.18, metalness: 0.08, transparent: true, opacity: 0.72 });
  const addBuildBox = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, material = woodMaterial) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; buildGroup.add(mesh); stock.placed++; return mesh;
  };
  const spendBoards = (amount: number) => {
    if (stock.boards < amount) { showBuildStatus('No quedan tablas suficientes'); return false; }
    stock.boards -= amount; return true;
  };
  const floorPreviewMaterial = new THREE.MeshBasicMaterial({ color: 0x35df68, transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide });
  const floorPreview = new THREE.Mesh(new THREE.BoxGeometry(4,0.10,4), floorPreviewMaterial);
  floorPreview.visible = false; floorPreview.renderOrder = 20; scene.add(floorPreview);
  let floorPreviewValid = false;
  const updateFloorPreview = (event: PointerEvent) => {
    if (activeBuild !== 'floor') { floorPreview.visible = false; return; }
    const rect=renderer.domElement.getBoundingClientRect();
    buildPointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    buildRay.setFromCamera(buildPointer,camera);
    const p=new THREE.Vector3(); let hit: THREE.Vector3|null=null;
    for(let d=1;d<=120;d+=0.5){buildRay.ray.at(d,p);const y=hf.height(p.x,p.z);if(p.y<=y+0.08){hit=new THREE.Vector3(p.x,y,p.z);break;}}
    if(!hit){floorPreview.visible=false;floorPreviewValid=false;return;}
    const x=Math.round(hit.x/4)*4,z=Math.round(hit.z/4)*4;
    const hs=[hf.height(x-2,z-2),hf.height(x+2,z-2),hf.height(x-2,z+2),hf.height(x+2,z+2)];
    const spread=Math.max(...hs)-Math.min(...hs);
    floorPreviewValid=spread<=0.16&&!builtFloors.some((f)=>Math.hypot(f.x-x,f.z-z)<3.5);
    floorPreviewMaterial.color.setHex(floorPreviewValid?0x35df68:0xf04444);
    floorPreview.position.set(x,hs.reduce((a,b)=>a+b,0)/4+0.06,z); floorPreview.visible=true;
  };
  renderer.domElement.addEventListener('pointermove', updateFloorPreview);
  const placeBuildPiece = (event: PointerEvent) => {
    if (!activeBuild || event.button !== 0) return;
    const rect = renderer.domElement.getBoundingClientRect();
    buildPointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    buildRay.setFromCamera(buildPointer,camera);
    // The terrain is shader-displaced and instanced, so use the real heightfield for placement.
    let groundHit: THREE.Vector3 | null = null;
    const samplePoint = new THREE.Vector3();
    for (let distance = 1; distance <= 120; distance += 0.5) {
      buildRay.ray.at(distance, samplePoint);
      const groundY = hf.height(samplePoint.x, samplePoint.z);
      if (samplePoint.y <= groundY + 0.08) { groundHit = new THREE.Vector3(samplePoint.x, groundY, samplePoint.z); break; }
    }
    if (!groundHit) { showBuildStatus('No hay terreno válido en ese punto'); return; }
    if (activeBuild === 'flatten') {
      hf.flattenArea(groundHit.x,groundHit.z,3.8);
      activeBuild='floor'; floorPreview.visible=false;
      showBuildStatus('Terreno nivelado. Mové el piso fantasma hasta verlo verde');
      return;
    }
    if (activeBuild === 'floor') {
      if (!floorPreviewValid) { showBuildStatus('El piso está rojo: movelo o usá APLANAR'); return; }
      floorPreview.visible=false;
      const x=Math.round(groundHit.x/4)*4,z=Math.round(groundHit.z/4)*4;
      if (builtFloors.some((f)=>Math.hypot(f.x-x,f.z-z)<3.5)) { showBuildStatus('Ya hay un piso en ese lugar'); return; }
      if (!spendBoards(4)) return;
      const y=hf.height(x,z);
      addBuildBox(new THREE.BoxGeometry(4,0.22,4),x,y+0.11,z);
      builtFloors.push({x,z,y:y+0.22});
      colliders.platform(x,z,2,2,0,y+0.22,'wood');
      showBuildStatus('Piso colocado. Ya podés construir sobre él'); return;
    }
    const floor = builtFloors.reduce<{x:number;z:number;y:number;d:number}|null>((best,f)=>{
      const d=Math.hypot(f.x-groundHit.x,f.z-groundHit.z);
      return d<3.2&&(!best||d<best.d)?{...f,d}:best;
    },null);
    if (!floor) { showBuildStatus('Primero necesitás colocar un piso'); return; }
    const dx=groundHit.x-floor.x,dz=groundHit.z-floor.z;
    const alongX=Math.abs(dx)>=Math.abs(dz);
    const edgeX=floor.x+(dx>=0?2:-2),edgeZ=floor.z+(dz>=0?2:-2);
    const cx=alongX?edgeX:floor.x,cz=alongX?floor.z:edgeZ;
    if (activeBuild === 'roof') {
      if (!spendBoards(4)) return;
      addBuildBox(new THREE.BoxGeometry(4,0.2,4),floor.x,floor.y+3.1,floor.z);
      showBuildStatus('Techo colocado'); return;
    }
    if (activeBuild === 'stairs') {
      if (!spendBoards(5)) return;
      for(let i=0;i<5;i++){
        const rise=0.24*(i+1), z0=floor.z+(dz>=0?1.55:-1.55)+(dz>=0?-i*0.62:i*0.62);
        addBuildBox(new THREE.BoxGeometry(3.2,rise,0.62),floor.x,floor.y+rise/2,z0);
        colliders.platform(floor.x,z0,1.6,0.31,0,floor.y+rise,'wood');
      }
      showBuildStatus('Escalera colocada'); return;
    }
    if (activeBuild === 'door') {
      if (!spendBoards(3)) return;
      if (alongX) {
        addBuildBox(new THREE.BoxGeometry(0.22,3,0.22),cx,floor.y+1.5,cz-1.9);
        addBuildBox(new THREE.BoxGeometry(0.22,3,0.22),cx,floor.y+1.5,cz+1.9);
        addBuildBox(new THREE.BoxGeometry(0.22,0.35,4),cx,floor.y+2.82,cz);
        colliders.box(cx,cz-1.9,0.11,0.11,0,floor.y,floor.y+3); colliders.box(cx,cz+1.9,0.11,0.11,0,floor.y,floor.y+3);
      } else {
        addBuildBox(new THREE.BoxGeometry(0.22,3,0.22),cx-1.9,floor.y+1.5,cz);
        addBuildBox(new THREE.BoxGeometry(0.22,3,0.22),cx+1.9,floor.y+1.5,cz);
        addBuildBox(new THREE.BoxGeometry(4,0.35,0.22),cx,floor.y+2.82,cz);
        colliders.box(cx-1.9,cz,0.11,0.11,0,floor.y,floor.y+3); colliders.box(cx+1.9,cz,0.11,0.11,0,floor.y,floor.y+3);
      }
      showBuildStatus('Marco de puerta colocado'); return;
    }
    if (activeBuild === 'window') {
      if (!spendBoards(4)) return;
      if (alongX) {
        addBuildBox(new THREE.BoxGeometry(0.2,0.75,4),cx,floor.y+0.38,cz);
        addBuildBox(new THREE.BoxGeometry(0.2,0.75,4),cx,floor.y+2.62,cz);
        addBuildBox(new THREE.BoxGeometry(0.2,1.5,0.55),cx,floor.y+1.5,cz-1.72);
        addBuildBox(new THREE.BoxGeometry(0.2,1.5,0.55),cx,floor.y+1.5,cz+1.72);
        addBuildBox(new THREE.BoxGeometry(0.05,1.5,2.85),cx+0.02,floor.y+1.5,cz,glassMaterial);
      } else {
        addBuildBox(new THREE.BoxGeometry(4,0.75,0.2),cx,floor.y+0.38,cz);
        addBuildBox(new THREE.BoxGeometry(4,0.75,0.2),cx,floor.y+2.62,cz);
        addBuildBox(new THREE.BoxGeometry(0.55,1.5,0.2),cx-1.72,floor.y+1.5,cz);
        addBuildBox(new THREE.BoxGeometry(0.55,1.5,0.2),cx+1.72,floor.y+1.5,cz);
        addBuildBox(new THREE.BoxGeometry(2.85,1.5,0.05),cx,floor.y+1.5,cz+0.02,glassMaterial);
      }
      showBuildStatus('Ventana colocada'); return;
    }
    if (!spendBoards(4)) return;
    if (alongX) {
      addBuildBox(new THREE.BoxGeometry(0.18,3,4),cx,floor.y+1.5,cz);
      colliders.box(cx,cz,0.09,2,0,floor.y,floor.y+3);
    } else {
      addBuildBox(new THREE.BoxGeometry(4,3,0.18),cx,floor.y+1.5,cz);
      colliders.box(cx,cz,2,0.09,0,floor.y,floor.y+3);
    }
    showBuildStatus('Pared colocada');
  };
  renderer.domElement.addEventListener('pointerup', placeBuildPiece);""",
"add mobile game menu and initial building pieces")


# Construction repair: reliable terrain leveling, free camera, and explicit exit.
patch("index.html",
'      <button type="button" data-game-panel="build"><span>⌂</span><small>CONSTRUIR</small></button>',
'      <button type="button" data-game-panel="build"><span>⌂</span><small>CONSTRUIR</small></button>\n      <button type="button" id="ilox-exit-build" style="display:none"><span>↩</span><small>SALIR</small></button>',
"add construction exit control")
patch("index.html",
'      body.ilox-building .ilox-action { pointer-events:none !important; }',
'      #ilox-exit-build { width:66px; height:54px; padding:4px 2px; border:1px solid rgba(235,240,225,.48); border-radius:9px; color:#fff; background:rgba(115,48,38,.92); display:none; flex-direction:column; align-items:center; justify-content:center; gap:2px; pointer-events:auto; }\n      #ilox-exit-build span { font-size:20px; line-height:22px; } #ilox-exit-build small { font:700 7px system-ui; }\n      body.ilox-building .ilox-action { pointer-events:none !important; }',
"style construction exit control")
patch("src/main.ts",
"  const closeGamePanel = () => { gamePanel?.classList.remove('open'); activeBuild = null; document.body.classList.remove('ilox-building'); };",
"  const buildExitButton = document.getElementById('ilox-exit-build') as HTMLButtonElement | null;\n  const closeGamePanel = () => {\n    gamePanel?.classList.remove('open'); activeBuild = null; floorPreview.visible = false;\n    document.body.classList.remove('ilox-building');\n    if (buildExitButton) buildExitButton.style.display = 'none';\n    if (rig.mode === 'free') { rig.set('follow'); rig.snapBehind(player.heading); }\n  };",
"restore player controls when leaving construction")
patch("src/main.ts",
"    activeBuild = null; document.body.classList.remove('ilox-building');",
"    activeBuild = null; document.body.classList.remove('ilox-building');\n    if (buildExitButton) buildExitButton.style.display = 'none';\n    if (rig.mode === 'free') { rig.set('follow'); rig.snapBehind(player.heading); }",
"leave construction before opening another game panel")
patch("src/main.ts",
"        activeBuild = button.dataset.build as typeof activeBuild;\n        document.body.classList.add('ilox-building');",
"        activeBuild = button.dataset.build as typeof activeBuild;\n        rig.set('free'); // freeze the avatar and let the camera fly independently\n        if (buildExitButton) buildExitButton.style.display = 'flex';\n        document.body.classList.add('ilox-building');",
"freeze avatar and enable free camera during construction")
patch("src/main.ts",
"  document.getElementById('ilox-game-close')?.addEventListener('click', closeGamePanel);",
"  document.getElementById('ilox-game-close')?.addEventListener('click', closeGamePanel);\n  buildExitButton?.addEventListener('click', closeGamePanel);",
"wire construction exit button")
patch("src/main.ts",
"    if (activeBuild === 'flatten') {\n      hf.flattenArea(groundHit.x,groundHit.z,3.8);\n      activeBuild='floor'; floorPreview.visible=false;\n      showBuildStatus('Terreno nivelado. Mové el piso fantasma hasta verlo verde');\n      return;\n    }",
"    if (activeBuild === 'flatten') {\n      // Level exactly the same 4 x 4 m grid cell used by the floor preview.\n      const fx=Math.round(groundHit.x/4)*4, fz=Math.round(groundHit.z/4)*4;\n      hf.flattenArea(fx,fz,3.8);\n      const hs=[hf.height(fx-2,fz-2),hf.height(fx+2,fz-2),hf.height(fx-2,fz+2),hf.height(fx+2,fz+2)];\n      const spread=Math.max(...hs)-Math.min(...hs);\n      activeBuild='floor'; floorPreview.visible=false;\n      updateFloorPreview(event);\n      showBuildStatus(spread<=0.16 ? 'Terreno aplanado. El piso debería verse VERDE' : 'Aplanando terreno… diferencia actual '+spread.toFixed(2)+' m');\n      return;\n    }",
"align leveling footprint with floor grid and verify result")
patch("src/main.ts",
"    if (!activeBuild || event.button !== 0) return;\n    const rect = renderer.domElement.getBoundingClientRect();",
"    if (!activeBuild || event.button !== 0) return;\n    if (activeBuild === 'floor') updateFloorPreview(event);\n    const rect = renderer.domElement.getBoundingClientRect();",
"refresh floor ghost on release before placement")
patch("src/main.ts",
"    for(let d=1;d<=120;d+=0.5){buildRay.ray.at(d,p);const y=hf.height(p.x,p.z);if(p.y<=y+0.08){hit=new THREE.Vector3(p.x,y,p.z);break;}}",
"    for(let d=0.2;d<=120;d+=0.2){buildRay.ray.at(d,p);const y=hf.height(p.x,p.z);if(y>-60 && p.y<=y+0.04){hit=new THREE.Vector3(p.x,y,p.z);break;}}",
"improve terrain ray sampling for preview")
patch("src/main.ts",
"    for (let distance = 1; distance <= 120; distance += 0.5) {\n      buildRay.ray.at(distance, samplePoint);\n      const groundY = hf.height(samplePoint.x, samplePoint.z);\n      if (samplePoint.y <= groundY + 0.08) { groundHit = new THREE.Vector3(samplePoint.x, groundY, samplePoint.z); break; }\n    }",
"    for (let distance = 0.2; distance <= 120; distance += 0.2) {\n      buildRay.ray.at(distance, samplePoint);\n      const groundY = hf.height(samplePoint.x, samplePoint.z);\n      if (groundY > -60 && samplePoint.y <= groundY + 0.04) { groundHit = new THREE.Vector3(samplePoint.x, groundY, samplePoint.z); break; }\n    }",
"improve placement terrain ray sampling")
patch("src/main.ts",
"  renderer.domElement.addEventListener('pointermove', updateFloorPreview);",
"  window.addEventListener('pointermove', (event) => { if (activeBuild === 'floor') updateFloorPreview(event); }, true);",
"track floor preview across mobile touch surfaces")
patch("src/main.ts",
"  renderer.domElement.addEventListener('pointerup', placeBuildPiece);",
"  window.addEventListener('pointerup', (event) => {\n    if (!activeBuild || (event.target as Element | null)?.closest('button, input, textarea, select')) return;\n    placeBuildPiece(event);\n  }, true);",
"handle construction taps reliably on touch devices");


# Dedicated four-way camera controls on the right side during construction.
patch("index.html",
'      <button type="button" id="ilox-exit-build" style="display:none"><span>↩</span><small>SALIR</small></button>',
'      <button type="button" id="ilox-exit-build" style="display:none"><span>↩</span><small>SALIR</small></button>\n      <div id="ilox-build-camera" aria-label="Mover cámara libre"><button type="button" data-build-camera="up" aria-label="Subir cámara">▲</button><div><button type="button" data-build-camera="left" aria-label="Mover cámara a la izquierda">◀</button><button type="button" data-build-camera="right" aria-label="Mover cámara a la derecha">▶</button></div><button type="button" data-build-camera="down" aria-label="Bajar cámara">▼</button></div>',
"add four-way free camera controls")
patch("index.html",
'      body.ilox-building .ilox-action { pointer-events:none !important; }',
'      #ilox-build-camera { position:fixed; z-index:80; right:max(14px,env(safe-area-inset-right)); top:50%; transform:translateY(-50%); display:none; flex-direction:column; align-items:center; gap:8px; pointer-events:none; }\n      #ilox-build-camera div { display:flex; gap:8px; }\n      #ilox-build-camera button { width:54px; height:54px; border:1px solid rgba(235,240,225,.58); border-radius:13px; color:#fff; background:rgba(20,38,32,.84); font:700 24px system-ui; touch-action:none; user-select:none; -webkit-user-select:none; pointer-events:auto; box-shadow:0 2px 12px rgba(0,0,0,.28); }\n      body.ilox-building #ilox-build-camera { display:flex; }\n      body.ilox-building #ilox-look-zone { display:none !important; }\n      body.ilox-building .ilox-action { pointer-events:none !important; }',
"style four-way free camera controls")
patch("src/player/Input.ts",
'  private keys = new Set<string>();',
'  private keys = new Set<string>();\n  private buildCameraKeys = new Set<string>();',
"track construction camera buttons")
patch("src/player/Input.ts",
'    this.canvas = canvas;',
'    this.canvas = canvas;\n    document.querySelectorAll<HTMLButtonElement>("[data-build-camera]").forEach((button) => {\n      const direction = button.dataset.buildCamera ?? "";\n      const start = (event: PointerEvent) => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); this.buildCameraKeys.add(direction); };\n      const stop = () => this.buildCameraKeys.delete(direction);\n      button.addEventListener("pointerdown", start); button.addEventListener("pointerup", stop);\n      button.addEventListener("pointercancel", stop); button.addEventListener("lostpointercapture", stop);\n    });',
"wire held camera movement buttons")
patch("src/player/Input.ts",
'    this.mdx = 0;',
'    if (document.body.classList.contains("ilox-building")) {\n      mx += Number(this.buildCameraKeys.has("right")) - Number(this.buildCameraKeys.has("left"));\n      up += Number(this.buildCameraKeys.has("up")) - Number(this.buildCameraKeys.has("down"));\n    }\n    this.mdx = 0;',
"apply construction camera movement intent")

# Keep mobile camera gestures available in construction mode; placement uses the open center area.
patch("index.html",
'      body.ilox-building .ilox-action { pointer-events:none !important; }',
'      body.ilox-building .ilox-action { pointer-events:none !important; }',
"allow free-camera touch controls while building")
patch("src/main.ts",
"  window.addEventListener('pointermove', (event) => { if (activeBuild === 'floor') updateFloorPreview(event); }, true);",
"  window.addEventListener('pointermove', (event) => {\n    if (activeBuild === 'floor' && !(event.target as Element | null)?.closest('#ilox-look-zone, #ilox-stick-zone, button')) updateFloorPreview(event);\n  }, true);",
"do not move floor preview while adjusting free camera")
patch("src/main.ts",
"    if (!activeBuild || (event.target as Element | null)?.closest('button, input, textarea, select')) return;",
"    if (!activeBuild || (event.target as Element | null)?.closest('button, input, textarea, select, #ilox-look-zone, #ilox-stick-zone')) return;",
"reserve touch zones for free-camera gestures")


# Real, progressive 4 x 4 m building plots: the shovel and floor share one exact footprint.
patch("src/world/Heightfield.ts",
"  /** unit normal (x, y, z) from central differences over e metres */",
"  /** Applies one real shovel stroke to the exact square building footprint and returns its remaining height spread. */\n  flattenFootprintStep(x: number, z: number, size: number, targetY: number, strength = 0.34) {\n    const N=this.n, h=this.heights, cell=WORLD_SIZE/N, half=size/2;\n    const i0=Math.max(0,Math.ceil((x-half+HALF_WORLD)/cell-0.5));\n    const i1=Math.min(N-1,Math.floor((x+half+HALF_WORLD)/cell-0.5));\n    const j0=Math.max(0,Math.ceil((z-half+HALF_WORLD)/cell-0.5));\n    const j1=Math.min(N-1,Math.floor((z+half+HALF_WORLD)/cell-0.5));\n    let min=Infinity,max=-Infinity;\n    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++) {\n      const k=j*N+i;\n      h[k] += (targetY-h[k])*strength;\n      min=Math.min(min,h[k]); max=Math.max(max,h[k]);\n    }\n    if(this.heightTex) this.heightTex.needsUpdate=true;\n    return max-min;\n  }\n\n  /** unit normal (x, y, z) from central differences over e metres */",
"add progressive square-footprint terrain leveling")
patch("src/main.ts",
"  const builtFloors: { x: number; z: number; y: number }[] = [];",
"  const builtFloors: { x: number; z: number; y: number }[] = [];\n  const preparedPlots = new Set<string>();\n  const flattenWork = new Map<string, { targetY: number; hits: number }>();\n  const plotKey = (x: number, z: number) => x.toFixed(2)+':'+z.toFixed(2);",
"track real prepared construction plots")
patch("src/main.ts",
"  floorPreview.visible = false; floorPreview.renderOrder = 20; scene.add(floorPreview);\n  let floorPreviewValid = false;",
"  floorPreview.visible = false; floorPreview.renderOrder = 20; scene.add(floorPreview);\n  const flattenPreviewGroup = new THREE.Group(); scene.add(flattenPreviewGroup);\n  const flattenDotGeometry = new THREE.SphereGeometry(0.045,6,6);\n  const flattenDotMaterial = new THREE.MeshBasicMaterial({color:0xf0d58c,depthTest:false});\n  const flattenReadyMaterial = new THREE.MeshBasicMaterial({color:0x35df68,depthTest:false});\n  const flattenDots: THREE.Mesh[] = [];\n  for(let i=0;i<=10;i++) {\n    const t=-2+i*0.4;\n    for(const [dx,dz] of [[t,-2],[t,2],[-2,t],[2,t]]) {\n      const dot=new THREE.Mesh(flattenDotGeometry,flattenDotMaterial); dot.renderOrder=30;\n      dot.userData.offset=[dx,dz]; flattenPreviewGroup.add(dot); flattenDots.push(dot);\n    }\n  }\n  const shovelMarker = new THREE.Group();\n  const shovelHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.026,0.62,7),woodMaterial);\n  shovelHandle.position.set(0,0.34,0); shovelHandle.rotation.z=-0.32; shovelMarker.add(shovelHandle);\n  const shovelBlade = new THREE.Mesh(new THREE.BoxGeometry(0.20,0.055,0.24),new THREE.MeshStandardMaterial({color:0x9aa5a4,metalness:0.65,roughness:0.42}));\n  shovelBlade.position.set(0,0.04,0.13); shovelBlade.rotation.x=-0.18; shovelMarker.add(shovelBlade);\n  const shovelGrip = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.055,0.07),woodMaterial);\n  shovelGrip.position.set(0,0.65,0); shovelMarker.add(shovelGrip); flattenPreviewGroup.add(shovelMarker);\n  const updateFlattenPreview = (event: PointerEvent) => {\n    if(activeBuild!=='flatten') { flattenPreviewGroup.visible=false; return; }\n    const rect=renderer.domElement.getBoundingClientRect();\n    buildPointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);\n    buildRay.setFromCamera(buildPointer,camera);\n    const p=new THREE.Vector3(); let hit:THREE.Vector3|null=null;\n    for(let d=0.2;d<=120;d+=0.2) { buildRay.ray.at(d,p); const y=hf.height(p.x,p.z); if(y>-60&&p.y<=y+0.04){hit=new THREE.Vector3(p.x,y,p.z);break;} }\n    if(!hit){flattenPreviewGroup.visible=false;return;}\n    const x=Math.round(hit.x/4)*4,z=Math.round(hit.z/4)*4,key=plotKey(x,z);\n    const ready=preparedPlots.has(key);\n    for(const dot of flattenDots) {\n      const [dx,dz]=dot.userData.offset as [number,number];\n      dot.position.set(x+dx,hf.height(x+dx,z+dz)+0.07,z+dz);\n      dot.material=ready?flattenReadyMaterial:flattenDotMaterial;\n    }\n    shovelMarker.position.set(x,hf.height(x,z)+0.10,z); shovelMarker.visible=!ready;\n    flattenPreviewGroup.visible=true;\n  };\n  let floorPreviewValid = false;",
"show dotted 4m footprint and shovel marker")
patch("src/main.ts",
"    floorPreviewValid=spread<=0.16&&!builtFloors.some((f)=>Math.hypot(f.x-x,f.z-z)<3.5);",
"    floorPreviewValid=preparedPlots.has(plotKey(x,z))&&!builtFloors.some((f)=>Math.hypot(f.x-x,f.z-z)<3.5);\n    floorPreviewMaterial.opacity=0.48-Math.min(spread,4)*0.03;",
"require completed matching plot before floor turns green")
patch("src/main.ts",
"    if (activeBuild === 'flatten') {\n      // Level exactly the same 4 x 4 m grid cell used by the floor preview.\n      const fx=Math.round(groundHit.x/4)*4, fz=Math.round(groundHit.z/4)*4;\n      hf.flattenArea(fx,fz,3.8);\n      const hs=[hf.height(fx-2,fz-2),hf.height(fx+2,fz-2),hf.height(fx-2,fz+2),hf.height(fx+2,fz+2)];\n      const spread=Math.max(...hs)-Math.min(...hs);\n      activeBuild='floor'; floorPreview.visible=false;\n      updateFloorPreview(event);\n      showBuildStatus(spread<=0.16 ? 'Terreno aplanado. El piso debería verse VERDE' : 'Aplanando terreno… diferencia actual '+spread.toFixed(2)+' m');\n      return;\n    }",
"    if (activeBuild === 'flatten') {\n      const fx=Math.round(groundHit.x/4)*4, fz=Math.round(groundHit.z/4)*4, key=plotKey(fx,fz);\n      if(preparedPlots.has(key)) { showBuildStatus('Esta parcela de 4 × 4 m ya está lista. Elegí PISO'); updateFlattenPreview(event); return; }\n      let job=flattenWork.get(key);\n      if(!job) {\n        let total=0,count=0;\n        for(let iz=0;iz<8;iz++) for(let ix=0;ix<8;ix++) { total+=hf.height(fx-1.75+ix*0.5,fz-1.75+iz*0.5); count++; }\n        job={targetY:total/count,hits:0}; flattenWork.set(key,job);\n      }\n      const spread=hf.flattenFootprintStep(fx,fz,4,job.targetY,0.34);\n      job.hits++;\n      updateFlattenPreview(event);\n      if(spread<=0.12) {\n        preparedPlots.add(key); flattenWork.delete(key);\n        updateFlattenPreview(event);\n        showBuildStatus('¡Parcela 4 × 4 m preparada! Ahora el piso estará VERDE');\n      } else {\n        showBuildStatus('Palada '+job.hits+' · nivelando parcela 4 × 4 m · desnivel '+spread.toFixed(2)+' m');\n      }\n      return;\n    }",
"make each shovel tap progressively flatten and register the exact 4m plot")
patch("src/main.ts",
"  window.addEventListener('pointermove', (event) => {\n    if (activeBuild === 'floor' && !(event.target as Element | null)?.closest('#ilox-look-zone, #ilox-stick-zone, button')) updateFloorPreview(event);\n  }, true);",
"  window.addEventListener('pointermove', (event) => {\n    if ((event.target as Element | null)?.closest('#ilox-look-zone, #ilox-stick-zone, button')) return;\n    if (activeBuild === 'floor') updateFloorPreview(event);\n    if (activeBuild === 'flatten') updateFlattenPreview(event);\n  }, true);",
"track both floor and shovel footprint under camera aiming")
patch("src/main.ts",
"  const closeGamePanel = () => {\n    gamePanel?.classList.remove('open'); activeBuild = null; floorPreview.visible = false;\n    document.body.classList.remove('ilox-building');",
"  const closeGamePanel = () => {\n    gamePanel?.classList.remove('open'); activeBuild = null; floorPreview.visible = false; flattenPreviewGroup.visible = false;\n    document.body.classList.remove('ilox-building');",
"hide build footprint when exiting construction")
patch("src/main.ts",
"        showBuildStatus(activeBuild === 'flatten' ? 'Tocá el terreno: la pala lo va a nivelar' : activeBuild === 'floor' ? 'Mové el piso fantasma; verde significa que encaja' : 'Elegí un lado de un piso existente');",
"        showBuildStatus(activeBuild === 'flatten' ? 'La parcela punteada mide 4 × 4 m. Tocá varias veces con la pala' : activeBuild === 'floor' ? 'El piso solo estará verde sobre una parcela preparada' : 'Elegí un lado de un piso existente');",
"explain repeated shovel taps and floor compatibility")


# First-person construction mode: preserve the player's movement joystick and
# the proven 4x4 m plot workflow, but replace the free-flying camera with an
# eye-level camera driven only by direct touch drags.
patch("src/player/CameraRig.ts",
"export type CamMode = 'follow' | 'orbit' | 'free' | 'pose';",
"export type CamMode = 'follow' | 'orbit' | 'free' | 'pose' | 'first';",
"add first-person camera mode")
patch("src/player/CameraRig.ts",
"      if (m === 'free') {",
"      if (m === 'free' || m === 'first') {",
"preserve view direction when entering first person")
patch("src/player/CameraRig.ts",
"    if (this.mode === 'free') {\n      // smoothed fly camera (photo mode): velocity eases toward the wish so recordings glide",
"    if (this.mode === 'first') {\n      // Eye-level camera follows the actual avatar position; touch look changes only yaw/pitch.\n      const forward = tmp.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));\n      cam.position.copy(playerPos).add(tmp2.set(0, 1.62, 0));\n      cam.lookAt(tmp.copy(cam.position).add(forward));\n      return;\n    }\n    if (this.mode === 'free') {\n      // smoothed fly camera (photo mode): velocity eases toward the wish so recordings glide",
"implement grounded first-person camera")

patch("src/player/Input.ts",
"    let movePointer = -1, lookPointer = -1, lookX = 0, lookY = 0;",
"    let movePointer = -1, lookPointer = -1, lookX = 0, lookY = 0, lookStartX = 0, lookStartY = 0;",
"track look gesture movement")
patch("src/player/Input.ts",
"      e.preventDefault(); lookPointer = e.pointerId; lookX = e.clientX; lookY = e.clientY;\n      lookZone.setPointerCapture(e.pointerId);",
"      e.preventDefault(); lookPointer = e.pointerId; lookX = lookStartX = e.clientX; lookY = lookStartY = e.clientY;\n      lookZone.dataset.lookDragged = '0';\n      lookZone.setPointerCapture(e.pointerId);",
"distinguish a look swipe from a construction tap")
patch("src/player/Input.ts",
"      e.preventDefault(); this.mdx += e.clientX - lookX; this.mdy += e.clientY - lookY;\n      lookX = e.clientX; lookY = e.clientY;",
"      e.preventDefault(); this.mdx += e.clientX - lookX; this.mdy += e.clientY - lookY;\n      if (Math.hypot(e.clientX - lookStartX, e.clientY - lookStartY) > 8) lookZone.dataset.lookDragged = '1';\n      lookX = e.clientX; lookY = e.clientY;",
"mark camera drags without blocking taps")
patch("src/player/Input.ts",
"    const endLook = (e: PointerEvent) => { if (e.pointerId === lookPointer) lookPointer = -1; };",
"    const endLook = (e: PointerEvent) => { if (e.pointerId === lookPointer) { lookPointer = -1; lookZone!.dataset.lookDragged = '0'; } };",
"reset look gesture after release")

patch("src/main.ts",
"  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x9a7045, roughness: 0.88 });",
"  let buildViewModel: THREE.Group | null = null;\n  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x9a7045, roughness: 0.88 });\n  // A light first-person viewmodel: sleeves, hands and a readable construction blueprint.\n  buildViewModel = new THREE.Group(); buildViewModel.visible = false; camera.add(buildViewModel);\n  const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x455d50, roughness: 0.92 });\n  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xc58f6b, roughness: 0.88 });\n  const addForearm = (x: number, zRot: number) => {\n    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.105, 0.48, 10), sleeveMaterial);\n    sleeve.position.set(x, -0.57, -0.72); sleeve.rotation.set(-0.34, 0, zRot); sleeve.frustumCulled = false; buildViewModel!.add(sleeve);\n    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skinMaterial);\n    hand.position.set(x * 0.48, -0.405, -0.91); hand.scale.set(1.05, 0.78, 1.25); hand.frustumCulled = false; buildViewModel!.add(hand);\n  };\n  addForearm(-0.39, -0.62); addForearm(0.39, 0.62);\n  const blueprintCanvas = document.createElement('canvas'); blueprintCanvas.width = 512; blueprintCanvas.height = 340;\n  const bp = blueprintCanvas.getContext('2d')!;\n  bp.fillStyle = '#173b55'; bp.fillRect(0, 0, 512, 340);\n  bp.strokeStyle = 'rgba(206,231,238,.22)'; bp.lineWidth = 1;\n  for (let x = 0; x <= 512; x += 24) { bp.beginPath(); bp.moveTo(x, 0); bp.lineTo(x, 340); bp.stroke(); }\n  for (let y = 0; y <= 340; y += 24) { bp.beginPath(); bp.moveTo(0, y); bp.lineTo(512, y); bp.stroke(); }\n  bp.strokeStyle = '#e5f0e9'; bp.lineWidth = 5; bp.strokeRect(100, 74, 312, 190);\n  bp.lineWidth = 3; bp.strokeRect(132, 105, 248, 128); bp.beginPath(); bp.moveTo(256, 105); bp.lineTo(256, 233); bp.moveTo(132, 169); bp.lineTo(380, 169); bp.stroke();\n  bp.fillStyle = '#e5f0e9'; bp.font = 'bold 22px system-ui'; bp.fillText('ILOX · PLANO', 20, 34);\n  bp.font = '16px system-ui'; bp.fillText('4 × 4 m', 20, 316);\n  const blueprintTexture = new THREE.CanvasTexture(blueprintCanvas); blueprintTexture.colorSpace = THREE.SRGBColorSpace;\n  const blueprint = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.37), new THREE.MeshBasicMaterial({ map: blueprintTexture, side: THREE.DoubleSide, depthTest: false }));\n  blueprint.position.set(0, -0.46, -0.94); blueprint.rotation.set(-0.22, 0, 0); blueprint.renderOrder = 1000; blueprint.frustumCulled = false; buildViewModel.add(blueprint);",
"add first-person hands and blueprint viewmodel")
patch("src/main.ts",
"        rig.set('free'); // freeze the avatar and let the camera fly independently",
"        rig.set('first'); // eye-level view; the avatar keeps walking under the movement joystick.\n        player.root.visible = false;\n        if (buildViewModel) buildViewModel.visible = true;",
"enter grounded first-person construction")
patch_many("src/main.ts",
"    if (rig.mode === 'free') { rig.set('follow'); rig.snapBehind(player.heading); }",
"    if (rig.mode === 'free' || rig.mode === 'first') { rig.set('follow'); rig.snapBehind(player.heading); }\n    player.root.visible = true;\n    if (buildViewModel) buildViewModel.visible = false;",
2,
"restore avatar and follow camera on both construction exit paths")
patch_many("src/main.ts",
"buildPointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);",
"if (rig.mode === 'first') buildPointer.set(0,0); else buildPointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);",
3,
"aim construction previews and placement from the first-person screen center")
patch("src/main.ts",
"    if (!activeBuild || (event.target as Element | null)?.closest('button, input, textarea, select, #ilox-look-zone, #ilox-stick-zone')) return;",
"    const target = event.target as Element | null;\n    const lookSurface = target?.closest<HTMLElement>('#ilox-look-zone');\n    if (!activeBuild || target?.closest('button, input, textarea, select, #ilox-stick-zone') || (lookSurface?.dataset.lookDragged === '1')) return;",
"allow taps to build while swipes only turn the camera")
patch("src/main.ts",
"  window.addEventListener('pointermove', (event) => {\n    if ((event.target as Element | null)?.closest('#ilox-look-zone, #ilox-stick-zone, button')) return;\n    if (activeBuild === 'floor') updateFloorPreview(event);\n    if (activeBuild === 'flatten') updateFlattenPreview(event);\n  }, true);",
"  window.addEventListener('pointermove', (event) => {\n    if (rig.mode === 'first') return;\n    if ((event.target as Element | null)?.closest('#ilox-look-zone, #ilox-stick-zone, button')) return;\n    if (activeBuild === 'floor') updateFloorPreview(event);\n    if (activeBuild === 'flatten') updateFlattenPreview(event);\n  }, true);",
"keep first-person previews fixed to the center reticle")
patch("src/main.ts",
"    rig.update(dt, rig.mode === 'follow' || rig.mode === 'free' ? intent : { ...intent, lookX: 0, lookY: 0 }, player.pos, player.speed, player.heading);",
"    rig.update(dt, rig.mode === 'follow' || rig.mode === 'free' || rig.mode === 'first' ? intent : { ...intent, lookX: 0, lookY: 0 }, player.pos, player.speed, player.heading);\n    if (rig.mode === 'first') {\n      if (activeBuild === 'floor') updateFloorPreview({} as PointerEvent);\n      if (activeBuild === 'flatten') updateFlattenPreview({} as PointerEvent);\n    }",
"refresh first-person ghost previews at the reticle every frame")

patch("index.html",
"      body.ilox-building #ilox-build-camera { display:flex; }\n      body.ilox-building #ilox-look-zone { display:none !important; }",
"      body.ilox-building #ilox-build-camera { display:none !important; }\n      body.ilox-building #ilox-look-zone { display:block !important; pointer-events:auto !important; }",
"remove camera arrows and restore swipe-to-look in construction")

# Repair first-person construction aiming from the player's actual forward direction.
# Enter construction at eye level immediately, with a controlled downward work angle
# so the centre reticle meets the ground about one metre ahead instead of inheriting
# the third-person camera's downward/backward view.
patch("src/main.ts",
"      gameTitle.textContent = 'CONSTRUCCIÓN';",
"      gameTitle.textContent = 'CONSTRUCCIÓN';\n      rig.set('first');\n      rig.yaw = player.heading;\n      rig.pitch = -0.95;\n      player.root.visible = false;\n      if (buildViewModel) buildViewModel.visible = true;",
"enter first-person immediately on opening construction");



# Independent player camera selector — third person / first person.
# This is deliberately separate from construction, previews, terrain and building tools.
# First-person look uses a distinct target vector: never alias the forward vector with
# the temporary vector used to calculate the look-at point (that caused a fixed view).
patch("src/player/CameraRig.ts",
"      cam.lookAt(tmp.copy(cam.position).add(forward));",
"      cam.lookAt(tmp2.copy(cam.position).add(forward));",
"keep first-person look direction independent from its look-at target")

# Construction must not force the player into first-person; the camera selector owns
# the mode. Preserve the previous free-camera construction behavior until separately tested.
patch("src/main.ts",
"        rig.set('first'); // eye-level view; the avatar keeps walking under the movement joystick.\n        player.root.visible = false;\n        if (buildViewModel) buildViewModel.visible = true;",
"        rig.set('free'); // keep construction camera independent from the player camera selector.",
"keep construction camera separate from first-person selector")
patch("src/main.ts",
"      gameTitle.textContent = 'CONSTRUCCIÓN';\n      rig.set('first');\n      rig.yaw = player.heading;\n      rig.pitch = -0.95;\n      player.root.visible = false;\n      if (buildViewModel) buildViewModel.visible = true;",
"      gameTitle.textContent = 'CONSTRUCCIÓN';",
"do not change camera when opening construction")

# Add a persistent camera mode button to the main game UI.
patch("index.html",
'<button id="ilox-graphics-toggle" type="button">GRÁFICOS</button>',
'<button id="ilox-camera-toggle" type="button" aria-pressed="false">CÁMARA: TERCERA PERSONA</button>\n<button id="ilox-graphics-toggle" type="button">GRÁFICOS</button>',
"add third-person and first-person selector")
patch("index.html",
"      #ilox-graphics-toggle {",
"      #ilox-camera-toggle { position:fixed; z-index:90; top:max(14px,env(safe-area-inset-top)); left:max(14px,env(safe-area-inset-left)); padding:10px 13px; border:1px solid rgba(255,255,255,.35); border-radius:9px; color:#f3f0e7; background:rgba(9,19,16,.78); font:600 11px system-ui; letter-spacing:.06em; }\n      #ilox-camera-toggle[aria-pressed=true] { border-color:rgba(167,220,184,.85); background:rgba(26,76,54,.88); }\n      #ilox-graphics-toggle {",
"style camera mode selector")

# Wire the selector after the rig and player exist. First-person follows the avatar
# at eye height; third-person returns to the normal follow camera behind the heading.
patch("src/main.ts",
"  let photo = false;\n  const setPhoto = (on: boolean) => {",
"  const cameraModeButton = document.getElementById('ilox-camera-toggle') as HTMLButtonElement | null;\n  let firstPersonMode = false;\n  const setPlayerCameraMode = (firstPerson: boolean) => {\n    firstPersonMode = firstPerson;\n    if (firstPerson) {\n      rig.set('first');\n      player.root.visible = false;\n    } else {\n      rig.set('follow');\n      rig.snapBehind(player.heading);\n      player.root.visible = true;\n    }\n    if (cameraModeButton) {\n      cameraModeButton.textContent = firstPerson ? 'CÁMARA: PRIMERA PERSONA' : 'CÁMARA: TERCERA PERSONA';\n      cameraModeButton.setAttribute('aria-pressed', String(firstPerson));\n    }\n  };\n  cameraModeButton?.addEventListener('click', () => setPlayerCameraMode(!firstPersonMode));\n  let photo = false;\n  const setPhoto = (on: boolean) => {",
"wire independent player camera selector")


# ILOX world layout v2: a broad default plain with the natural perimeter retained.
# Keep the river corridor and the escarpment that forms the waterfall gorge untouched.
# The old shovel implementation remains in the build, but is no longer required or exposed.
patch("src/world/Heightfield.ts",
"    this.heights = heights;\n    this.mask0 = new Uint8Array(m0);",
"    // Flatten the central construction/play area at load time, before the height texture is uploaded.\n    // A smooth outer fade preserves the mountainous perimeter as the map's natural walls.\n    const flatCenterX = 0, flatCenterZ = 0, flatLevel = 42;\n    const flatRadius = 410, fadeRadius = 120, outerRadius = flatRadius + fadeRadius;\n    const riverLine = meta.river;\n    const gorgeLine = [[190,150],[165,60],[150,-10],[146,-56],[160,-130],[200,-210],[260,-280]];\n    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));\n    const segmentDistanceSq = (x: number, z: number, a: number[], b: number[]) => {\n      const vx=b[0]-a[0], vz=b[1]-a[1], len=vx*vx+vz*vz;\n      const t=len>0?clamp01(((x-a[0])*vx+(z-a[1])*vz)/len):0;\n      const dx=x-(a[0]+vx*t), dz=z-(a[1]+vz*t); return dx*dx+dz*dz;\n    };\n    for (let j=0;j<N;j++) for (let i=0;i<N;i++) {\n      const x=i-HALF_WORLD+0.5, z=j-HALF_WORLD+0.5;\n      const radial=Math.hypot(x-flatCenterX,z-flatCenterZ);\n      if(radial>=outerRadius) continue;\n      let preserve=false;\n      for(let r=0;r<riverLine.length-1;r++) {\n        const a=riverLine[r], b=riverLine[r+1];\n        const width=Math.max(a[4]||0,b[4]||0);\n        const keep=Math.max(32,width*2+14);\n        if(segmentDistanceSq(x,z,a,b)<keep*keep) { preserve=true; break; }\n      }\n      if(!preserve) for(let r=0;r<gorgeLine.length-1;r++) {\n        if(segmentDistanceSq(x,z,gorgeLine[r],gorgeLine[r+1])<32*32) { preserve=true; break; }\n      }\n      if(preserve) continue;\n      const t=clamp01((outerRadius-radial)/fadeRadius);\n      const blend=radial<=flatRadius?1:t*t*(3-2*t);\n      const k=j*N+i; heights[k] += (flatLevel-heights[k])*blend;\n    }\n    this.heights = heights;\n    this.mask0 = new Uint8Array(m0);",
"create broad flat central world and preserve river waterfall gorge");
patch("src/main.ts",
"      gameContent.innerHTML = '<p>Antes de colocar un piso, nivelá el terreno con la pala. Luego elegí la pieza.</p><button data-build=\"flatten\">🪏 APLANAR</button><button data-build=\"floor\">▰ PISO</button><button data-build=\"wall\">▥ PARED</button><button data-build=\"roof\">▱ TECHO</button><button data-build=\"door\">🚪 PUERTA</button><button data-build=\"window\">▣ VENTANA</button><button data-build=\"stairs\">▤ ESCALERA</button>';",
"      gameContent.innerHTML = '<p>El terreno central ya está preparado. Elegí la pieza que querés construir.</p><button data-build=\"floor\">▰ PISO</button><button data-build=\"wall\">▥ PARED</button><button data-build=\"roof\">▱ TECHO</button><button data-build=\"door\">🚪 PUERTA</button><button data-build=\"window\">▣ VENTANA</button><button data-build=\"stairs\">▤ ESCALERA</button>';",
"remove shovel from construction menu while retaining its code");
patch("src/main.ts",
"    floorPreviewValid=preparedPlots.has(plotKey(x,z))&&!builtFloors.some((f)=>Math.hypot(f.x-x,f.z-z)<3.5);\n    floorPreviewMaterial.opacity=0.48-Math.min(spread,4)*0.03;",
"    floorPreviewValid=spread<=0.16&&!builtFloors.some((f)=>Math.hypot(f.x-x,f.z-z)<3.5);\n    floorPreviewMaterial.opacity=0.48-Math.min(spread,4)*0.03;",
"allow floor placement on naturally flat ground without shovel");
patch("src/main.ts",
"if (!floorPreviewValid) { showBuildStatus('El piso está rojo: movelo o usá APLANAR'); return; }",
"if (!floorPreviewValid) { showBuildStatus('El piso está rojo: buscá una superficie más pareja'); return; }",
"remove shovel dependency from floor placement message");
patch("src/main.ts",
"        rig.set('free'); // keep construction camera independent from the player camera selector.",
"        // Keep the currently selected camera rig and its live look controls while building.",
"do not switch camera mode on construction");
patch_many("src/main.ts",
"    if (rig.mode === 'free' || rig.mode === 'first') { rig.set('follow'); rig.snapBehind(player.heading); }",
"    if (rig.mode === 'free') { rig.set('follow'); rig.snapBehind(player.heading); }",
2,
"preserve selected camera mode when leaving construction");
patch_many("src/main.ts",
"if (rig.mode === 'first') buildPointer.set(0,0); else buildPointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);",
"buildPointer.set(0,0);",
3,
"aim all construction actions and previews from the live camera-centre reticle");


# Keep the centre-reticle ray independent of pointer coordinates; no stale rect locals.
patch_many("src/main.ts",
"    const rect=renderer.domElement.getBoundingClientRect();\n    buildPointer.set(0,0);",
"    buildPointer.set(0,0);",
2,
"remove unused pointer rectangles from centred preview rays");
patch("src/main.ts",
"    const rect = renderer.domElement.getBoundingClientRect();\n    buildPointer.set(0,0);",
"    buildPointer.set(0,0);",
"remove unused pointer rectangle from centred placement ray");


# Apply the floor tolerance after the original construction code has been generated.
patch("src/main.ts",
"    floorPreviewValid=spread<=0.16&&!builtFloors.some((f)=>Math.hypot(f.x-x,f.z-z)<3.5);",
"    };\n    floorPreviewValid=spread<=0.45&&Math.abs(hs.reduce((a,b)=>a+b,0)/4-42)<=0.55&&Math.abs(hf.height(x,z)-42)<=0.55&&hf.water(x,z)<0.05&&!builtFloors.some((f)=>Math.hypot(f.x-x,f.z-z)<3.5);",
"allow small ground imperfections on the shared construction plane")
patch("src/main.ts",
"    floorPreview.position.set(x,hs.reduce((a,b)=>a+b,0)/4+0.06,z); floorPreview.visible=true;",
"    floorPreview.position.set(x,42.06,z); floorPreview.visible=true;",
"align floor preview to the common 42m plane")
patch("src/main.ts",
"      const y=hf.height(x,z);\n      addBuildBox(new THREE.BoxGeometry(4,0.22,4),x,y+0.11,z);",
"      const y=42;\n      addBuildBox(new THREE.BoxGeometry(4,0.22,4),x,y+0.11,z);",
"place every adjacent floor tile on the exact common plane")


# Repair the extra closing brace introduced before floor-preview validation.
patch("src/main.ts",
"    const spread=Math.max(...hs)-Math.min(...hs);\n    };\n    floorPreviewValid=spread<=0.45&&Math.abs(hs.reduce((a,b)=>a+b,0)/4-42)<=0.55&&Math.abs(hf.height(x,z)-42)<=0.55&&hf.water(x,z)<0.05&&!builtFloors.some((f)=>Math.hypot(f.x-x,f.z-z)<3.5);",
"    const spread=Math.max(...hs)-Math.min(...hs);\n    floorPreviewValid=spread<=0.45&&Math.abs(hs.reduce((a,b)=>a+b,0)/4-42)<=0.55&&Math.abs(hf.height(x,z)-42)<=0.55&&hf.water(x,z)<0.05&&!builtFloors.some((f)=>Math.hypot(f.x-x,f.z-z)<3.5);",
"remove stray floor preview closure")


# Replace the procedural placeholder ATV with the real CC0 Scavenger Quad Bike GLB.
# The original procedural implementation remains above as a reversible historical
# build step; this final adapter changes only the generated vehicle visual/runtime.
patch("src/main.ts",
"import * as THREE from 'three/webgpu';",
"import * as THREE from 'three/webgpu';\nimport { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
"load real CC0 quad model with Three.js GLTFLoader")

main_path = root / "src/main.ts"
main_source = main_path.read_text(encoding="utf-8")
quad_start = "  // ILOX functional quad: parked beside the village spawn; player input drives it when mounted."
quad_end = "  quadButton?.addEventListener('click', toggleQuad);"
if main_source.count(quad_start) != 1 or main_source.count(quad_end) != 1:
    raise SystemExit("real quad replacement: expected one existing ATV block")
a = main_source.index(quad_start)
b = main_source.index(quad_end, a) + len(quad_end)
real_quad = """  // Real imported Scavenger Quad Bike (CC0), not procedural geometry.
  const quadBike = new THREE.Group();
  quadBike.name = 'ilox-quad-bike';
  scene.add(quadBike);
  const quadButton = document.getElementById('ilox-vehicle-toggle');
  let quadMounted = false;
  let quadLoaded = false;
  let quadMixer: THREE.AnimationMixer | null = null;
  quadBike.position.set(spot.player[0] + 3, hf.height(spot.player[0] + 3, spot.player[1] + 3), spot.player[1] + 3);
  quadBike.rotation.y = spot.yaw;
  const quadLoader = new GLTFLoader();
  quadLoader.load(
    'https://cdn.3dassets.dev/assets/32681/v1/model.glb',
    (gltf) => {
      const importedQuad = gltf.scene;
      importedQuad.name = 'scavenger-quad-bike-model';
      // The source model is metre-scaled, +Y up, +Z forward, origin at ground centre.
      // Turn it to the game's -Z forward convention and avoid extra shadow passes.
      importedQuad.rotation.y = Math.PI;
      importedQuad.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = false;
          object.receiveShadow = false;
          object.frustumCulled = true;
        }
      });
      quadBike.add(importedQuad);
      if (gltf.animations.length) {
        quadMixer = new THREE.AnimationMixer(importedQuad);
        for (const clip of gltf.animations) quadMixer.clipAction(clip).play();
      }
      quadLoaded = true;
      if (quadButton && !quadMounted) quadButton.textContent = 'SUBIR ATV';
      console.info('ILOX: Scavenger Quad Bike loaded', gltf.animations.length, 'animations');
    },
    undefined,
    (error) => {
      console.error('ILOX: no se pudo cargar el modelo Scavenger Quad Bike', error);
      if (quadButton) quadButton.textContent = 'ATV NO DISPONIBLE';
    },
  );
  const toggleQuad = () => {
    if (quadMounted) {
      quadMounted = false;
      player.vehicleMode = false;
      player.root.visible = true;
      if (quadButton) quadButton.textContent = 'SUBIR ATV';
      return;
    }
    if (!quadLoaded) {
      if (quadButton) quadButton.textContent = 'CARGANDO ATV…';
      return;
    }
    if (Math.hypot(player.pos.x - quadBike.position.x, player.pos.z - quadBike.position.z) > 5.5) {
      if (quadButton) quadButton.textContent = 'ACERCATE AL ATV';
      window.setTimeout(() => { if (quadButton && !quadMounted) quadButton.textContent = 'SUBIR ATV'; }, 1500);
      return;
    }
    quadMounted = true;
    player.vehicleMode = true;
    player.root.visible = false;
    if (quadButton) quadButton.textContent = 'BAJAR ATV';
  };
  quadButton?.addEventListener('click', toggleQuad);"""
main_source = main_source[:a] + real_quad + main_source[b:]
main_path.write_text(main_source, encoding="utf-8")

patch("src/main.ts",
"    if (quadMounted) {\n      quadBike.position.set(player.pos.x, player.pos.y, player.pos.z);\n      quadBike.rotation.y = player.heading;\n      for (const wheel of quadWheels) wheel.rotation.x += player.speed * dt / 0.34;\n    }",
"    if (quadMounted) {\n      quadBike.position.set(player.pos.x, player.pos.y, player.pos.z);\n      quadBike.rotation.y = player.heading;\n    }\n    quadMixer?.update(dt);",
"drive imported quad and advance its real wheel-roll animation")


# Surface-first mobile profile: retain the complete heightfield and mountain silhouettes,
# but use a lighter terrain material and coarser distant LOD on touch devices.
# The original full terrain shader remains available with ?terrainfull=1.
patch("src/main.ts",
"  const terrainLite = new URLSearchParams(location.search).has('terrainlite');",
"  const terrainParams = new URLSearchParams(location.search);\n  const terrainLite = terrainParams.has('terrainlite') || (Q.renderScale < 0.7 && !terrainParams.has('terrainfull'));",
"enable reversible lite terrain shader automatically on mobile")

patch("src/world/TerrainMaterial.ts",
"  const liteIndices = [0, 2, 3, 4, 5];",
"  const liteIndices = [0, 3, 4, 5];",
"reduce terrain material from five layers to four")

patch("src/world/TerrainMaterial.ts",
"""  const weights = [
    m0.x.mul(float(1).sub(underwater)).mul(noSand),
    m0.w.mul(float(1).sub(m0.x)).mul(notRock).add(wBase.mul(0.55)).add(poolBank.mul(0.55)),
    m0.y.mul(notRock).mul(float(1).sub(m0.x.mul(0.8))).add(wBase.mul(0.45)),
    m0.z.mul(float(1).sub(rock.mul(0.7))).mul(noSand),
    rock.mul(float(1).sub(m0.w.mul(0.5))).add(poolBank.mul(0.5)),
  ];""",
"""  const weights = [
    m0.x.mul(float(1).sub(underwater)).mul(noSand),
    m0.y.mul(notRock).mul(float(1).sub(m0.x.mul(0.8))).add(wBase.mul(0.45)),
    m0.z.mul(float(1).sub(rock.mul(0.7))).mul(noSand).add(m0.w.mul(0.24)),
    rock.mul(float(1).sub(m0.w.mul(0.5))).add(poolBank.mul(0.5)),
  ];""",
"reduce green forest coverage and blend more neutral earth into the surface")

patch("src/world/TerrainMaterial.ts",
"  albedo = albedo.div(total);\n  rough = rough.div(total);\n  detail = detail.div(total);",
"  albedo = albedo.div(total).mul(vec3(1.03, 0.94, 0.84));\n  rough = rough.div(total);\n  detail = detail.div(total);",
"mute saturated green terrain tint for a more natural matte earth palette")

patch("src/core/quality.ts",
"lodScale: 0.36",
"lodScale: 0.95",
"reduce excessive terrain patch density on mobile while retaining heightmap relief")


# Restore visible island terrain on mobile and keep the construction clearing local.
# A 50 m camera far plane clipped almost the entire island while the ocean remained visible.
patch("src/core/Engine.ts",
"  readonly camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, preset === 'low' ? 50 : 30000);",
"  readonly camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 30000);",
"restore full island visibility on mobile")
# Keep a useful building plateau without flattening the summit and most of the island.
patch("src/world/Heightfield.ts",
"    const flatRadius = 410, fadeRadius = 120, outerRadius = flatRadius + fadeRadius;",
"    const flatRadius = 85, fadeRadius = 55, outerRadius = flatRadius + fadeRadius;",
"confine flat construction plateau and restore surrounding mountains")
# Use the original full terrain material by default; the lite material remains available
# for deliberate A/B testing with ?terrainlite=1.
patch("src/main.ts",
"  const terrainLite = terrainParams.has('terrainlite') || (Q.renderScale < 0.7 && !terrainParams.has('terrainfull'));",
"  const terrainLite = terrainParams.has('terrainlite') && !terrainParams.has('terrainfull');",
"restore full terrain material by default")
