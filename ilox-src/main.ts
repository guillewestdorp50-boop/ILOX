import { Engine } from './core/Engine';

const overlay = document.getElementById('overlay')!;
const playBtn = document.getElementById('play') as HTMLButtonElement;
const loadFill = document.getElementById('loadfill')!;
const loadText = document.getElementById('loadtext')!;
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

async function boot(): Promise<void> {
  const engine = new Engine(document.getElementById('app')!);

  await engine.build((fraction, label) => {
    loadFill.style.width = `${Math.round(fraction * 100)}%`;
    loadText.textContent = label;
  });

  playBtn.disabled = false;
  playBtn.textContent = 'ENTRAR AL MUNDO';
  loadText.textContent = 'Listo para explorar';

  const canvas = engine.renderer.domElement;
  let lookPointer: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let joyPointer: number | null = null;

  playBtn.addEventListener('click', () => {
    engine.startAudio();
    engine.setPlaying(true);
    overlay.classList.add('hidden');
    document.body.classList.add('playing');
    if (!coarsePointer) canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    if (coarsePointer) return;
    const locked = document.pointerLockElement === canvas;
    engine.setPlaying(locked);
    overlay.classList.toggle('hidden', locked);
    document.body.classList.toggle('playing', locked);
    if (!locked) playBtn.textContent = 'VOLVER AL MUNDO';
  });

  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === canvas) engine.look(event.movementX, event.movementY);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (!coarsePointer || !document.body.classList.contains('playing')) return;
    if (joystick?.contains(event.target as Node)) return;
    lookPointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== lookPointer) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    engine.look(dx, dy);
  });
  const endLook = (event: PointerEvent) => {
    if (event.pointerId === lookPointer) lookPointer = null;
  };
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);

  const updateJoystick = (event: PointerEvent) => {
    if (!joystick || event.pointerId !== joyPointer) return;
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * 0.34;
    let x = event.clientX - (rect.left + rect.width / 2);
    let y = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(x, y);
    if (length > radius) {
      x = x / length * radius;
      y = y / length * radius;
    }
    if (stick) stick.style.transform = `translate(${x}px,${y}px)`;
    engine.setMoveInput(x / radius, y / radius);
  };

  joystick?.addEventListener('pointerdown', (event) => {
    if (!document.body.classList.contains('playing')) return;
    event.preventDefault();
    event.stopPropagation();
    joyPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  joystick?.addEventListener('pointermove', updateJoystick);
  const endJoystick = (event: PointerEvent) => {
    if (event.pointerId !== joyPointer) return;
    joyPointer = null;
    engine.setMoveInput(0, 0);
    if (stick) stick.style.transform = 'translate(0px,0px)';
  };
  joystick?.addEventListener('pointerup', endJoystick);
  joystick?.addEventListener('pointercancel', endJoystick);
  joystick?.addEventListener('lostpointercapture', endJoystick);

  engine.start();
  (window as unknown as { __engine: Engine }).__engine = engine;
}

boot().catch((error) => {
  loadText.textContent = 'No se pudo iniciar el mundo. Revisá la conexión y volvé a intentar.';
  console.error(error);
});
