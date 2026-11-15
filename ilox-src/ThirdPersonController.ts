import * as THREE from 'three';
import { Heightfield, SPAWN, WORLD_SIZE } from '../world/heightfield';
import { Collider } from '../world/Trees';
import { ILOXAvatar } from './ILOXAvatar';

const WALK_SPEED = 4.2;
const RUN_SPEED = 7.2;

/** Movimiento real del avatar con cámara de seguimiento en tercera persona. */
export class ThirdPersonController {
  private readonly position = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private enabled = false;
  private yaw = 0;
  private pitch = 0.22;
  private moveX = 0;
  private moveY = 0;
  private readonly cameraTarget = new THREE.Vector3();
  private readonly desiredCamera = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly field: Heightfield,
    private readonly colliders: Collider[],
    private readonly avatar: ILOXAvatar
  ) {
    this.position.set(SPAWN.x, field.sampleHeight(SPAWN.x, SPAWN.z), SPAWN.z);
    this.avatar.group.position.copy(this.position);
    this.camera.position.set(this.position.x, this.position.y + 4.2, this.position.z + 8.5);
    this.camera.lookAt(this.position.x, this.position.y + 1.3, this.position.z);

    window.addEventListener('keydown', (event) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        this.keys.add(event.code);
      }
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.moveX = 0;
      this.moveY = 0;
    }
  }

  setMoveInput(x: number, y: number): void {
    this.moveX = THREE.MathUtils.clamp(x, -1, 1);
    this.moveY = THREE.MathUtils.clamp(y, -1, 1);
  }

  look(deltaX: number, deltaY: number): void {
    if (!this.enabled) return;
    this.yaw -= deltaX * 0.004;
    this.pitch = THREE.MathUtils.clamp(this.pitch + deltaY * 0.002, -0.08, 0.72);
  }

  update(dt: number): void {
    const forwardInput = this.enabled
      ? this.moveY * -1 + (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0)
        - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
      : 0;
    const sideInput = this.enabled
      ? this.moveX + (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
        - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0)
      : 0;

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const direction = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(sideInput));
    if (direction.lengthSq() > 1) direction.normalize();

    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = sprinting ? RUN_SPEED : WALK_SPEED;
    const targetX = direction.x * speed;
    const targetZ = direction.z * speed;
    const response = 1 - Math.exp(-12 * dt);
    this.velocity.x += (targetX - this.velocity.x) * response;
    this.velocity.z += (targetZ - this.velocity.z) * response;

    const previousX = this.position.x;
    const previousZ = this.position.z;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    const edge = WORLD_SIZE / 2 - 5;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -edge, edge);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -edge, edge);

    for (const collider of this.colliders) {
      const dx = this.position.x - collider.x;
      const dz = this.position.z - collider.z;
      const minDistance = collider.r + 0.48;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < minDistance * minDistance) {
        if (distanceSq > 1e-5) {
          const distance = Math.sqrt(distanceSq);
          this.position.x = collider.x + dx / distance * minDistance;
          this.position.z = collider.z + dz / distance * minDistance;
        } else {
          this.position.x = previousX;
          this.position.z = previousZ;
        }
      }
    }

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.position.y = this.field.sampleHeight(this.position.x, this.position.z);
    this.avatar.group.position.set(this.position.x, this.position.y, this.position.z);
    if (horizontalSpeed > 0.18) {
      this.avatar.group.rotation.y = Math.atan2(this.velocity.x, -this.velocity.z);
    }
    this.avatar.updateAnimation(dt, horizontalSpeed);

    const cameraDistance = 7.8;
    this.desiredCamera.set(
      this.position.x + Math.sin(this.yaw) * cameraDistance,
      this.position.y + 3.5 + this.pitch * 4.1,
      this.position.z + Math.cos(this.yaw) * cameraDistance
    );
    this.camera.position.lerp(this.desiredCamera, 1 - Math.exp(-7.5 * dt));
    this.cameraTarget.set(this.position.x, this.position.y + 1.28, this.position.z);
    this.camera.lookAt(this.cameraTarget);
  }
}
