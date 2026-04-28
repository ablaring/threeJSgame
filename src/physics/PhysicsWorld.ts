import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsWorld {
  world!: RAPIER.World;
  private initialized = false;

  async init() {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.initialized = true;
  }

  step(delta: number) {
    if (!this.initialized) return;
    this.world.timestep = delta;
    this.world.step();
  }

  createFixedCuboid(
    x: number, y: number, z: number,
    hx: number, hy: number, hz: number
  ): RAPIER.RigidBody {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
    this.world.createCollider(colliderDesc, body);
    return body;
  }

  createFixedCuboidRotated(
    x: number, y: number, z: number,
    hx: number, hy: number, hz: number,
    rotation: { x: number; y: number; z: number; w: number }
  ): RAPIER.RigidBody {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x, y, z)
      .setRotation(rotation);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
    this.world.createCollider(colliderDesc, body);
    return body;
  }

  createDynamicCapsule(
    x: number, y: number, z: number,
    halfHeight: number, radius: number
  ): RAPIER.RigidBody {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .lockRotations(); // prevent player from tipping over
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius)
      .setFriction(0.5);
    this.world.createCollider(colliderDesc, body);
    return body;
  }

  createDynamicCuboid(
    x: number, y: number, z: number,
    hx: number, hy: number, hz: number,
    mass: number = 1
  ): RAPIER.RigidBody {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setAdditionalMass(mass);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
    this.world.createCollider(colliderDesc, body);
    return body;
  }

  castRay(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxToi: number
  ): number | null {
    const ray = new RAPIER.Ray(origin, direction);
    const hit = this.world.castRay(ray, maxToi, true);
    return hit ? hit.toi : null;
  }
}
