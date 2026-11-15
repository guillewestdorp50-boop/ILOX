import * as THREE from 'three';

export type AvatarKind = 'boy' | 'girl' | 'man' | 'woman';

/** Personaje ILOX visible en tercera persona, con articulaciones animables. */
export class ILOXAvatar {
  readonly group = new THREE.Group();
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Group[] = [];
  private walkTime = 0;

  constructor(kind: AvatarKind = 'man') {
    const adult = kind === 'man' || kind === 'woman';
    const female = kind === 'woman' || kind === 'girl';
    const jacket = new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.92 });
    const pants = new THREE.MeshStandardMaterial({ color: kind === 'girl' ? 0x4a5360 : 0x555b50, roughness: 1 });
    const skin = new THREE.MeshStandardMaterial({ color: female ? 0xc98d68 : kind === 'girl' ? 0xd9a27d : 0xd49a76, roughness: 0.95 });
    const hair = new THREE.MeshStandardMaterial({ color: female ? 0x33251e : kind === 'girl' ? 0x493026 : 0x30251f, roughness: 1 });
    const canvas = new THREE.MeshStandardMaterial({ color: 0x887957, roughness: 1 });
    const canvasLight = new THREE.MeshStandardMaterial({ color: 0xa18d68, roughness: 1 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x49382a, roughness: 1 });
    const boots = new THREE.MeshStandardMaterial({ color: 0x302820, roughness: 1 });
    const buckle = new THREE.MeshStandardMaterial({ color: 0xb49a61, metalness: 0.25, roughness: 0.7 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.52, 5, 12), jacket);
    torso.position.y = 1.36;
    this.group.add(torso);

    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.78), jacket);
    hood.position.set(0, 1.99, 0.105);
    hood.scale.set(1, 1.04, 0.82);
    this.group.add(hood);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.18, 12), skin);
    neck.position.y = 1.79;
    this.group.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.255, 20, 16), skin);
    head.position.set(0, 2.02, -0.015);
    head.scale.set(0.9, 1.08, 0.94);
    this.group.add(head);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.265, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
    hairCap.position.set(0, 2.12, -0.025);
    this.group.add(hairCap);
    if (female) {
      const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), hair);
      hairBack.position.set(0, 1.91, -0.16);
      hairBack.scale.set(0.95, 1.12, 0.72);
      this.group.add(hairBack);
    }

    for (const side of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.43, 1.64, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.48, 4, 10), jacket);
      arm.position.y = -0.25;
      armPivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), skin);
      hand.position.set(side * 0.035, -0.59, -0.005);
      armPivot.add(hand);
      this.group.add(armPivot);
      this.arms.push(armPivot);

      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.18, 1.0, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.53, 4, 10), pants);
      leg.position.y = -0.39;
      legPivot.add(leg);
      const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.13, 3, 8), boots);
      boot.position.set(0, -0.87, -0.055);
      boot.scale.set(1.05, 0.72, 1.45);
      legPivot.add(boot);
      this.group.add(legPivot);
      this.legs.push(legPivot);

      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.69, 0.07), leather);
      strap.position.set(side * 0.20, 1.34, 0.18);
      this.group.add(strap);
      const buckleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 0.025), buckle);
      buckleMesh.position.set(side * 0.20, 1.40, 0.145);
      this.group.add(buckleMesh);
    }

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.66, 0.27), canvas);
    pack.position.set(0, 1.31, 0.34);
    pack.rotation.x = -0.06;
    this.group.add(pack);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.16, 0.30), canvasLight);
    flap.position.set(0, 1.68, 0.34);
    this.group.add(flap);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.10), canvasLight);
    pocket.position.set(0, 1.22, 0.51);
    this.group.add(pocket);
    for (const side of [-1, 1]) {
      const sidePocket = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.22, 10), canvas);
      sidePocket.rotation.z = Math.PI / 2;
      sidePocket.position.set(side * 0.31, 1.31, 0.34);
      this.group.add(sidePocket);
    }

    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 512;
    logoCanvas.height = 128;
    const ctx = logoCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = '#e7d29a';
      ctx.font = '900 82px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ILOX', 256, 67);
    }
    const logoTexture = new THREE.CanvasTexture(logoCanvas);
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.12),
      new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true, side: THREE.DoubleSide })
    );
    logo.position.set(0, 1.83, 0.285);
    this.group.add(logo);

    this.group.scale.setScalar(adult ? 1 : 0.79);
    this.group.userData.avatarKind = kind;
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  updateAnimation(dt: number, horizontalSpeed: number): void {
    const amount = THREE.MathUtils.clamp(horizontalSpeed / 4.2, 0, 1.35);
    this.walkTime += dt * (4.8 + horizontalSpeed * 1.25);
    const swing = Math.sin(this.walkTime) * 0.58 * amount;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.72;
    this.arms[1].rotation.x = swing * 0.72;
    this.group.position.y += Math.sin(this.walkTime * 2) * 0.018 * amount;
  }
}
