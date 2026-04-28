import * as THREE from 'three';

export interface InstanceTransform {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  color?: number;
}

interface InstancedMeshOptions {
  name?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  frustumCulled?: boolean;
}

const _object = new THREE.Object3D();
const _color = new THREE.Color();

export function createInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: InstanceTransform[],
  options: InstancedMeshOptions = {}
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = options.name ?? 'InstancedMesh';
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? false;
  mesh.frustumCulled = options.frustumCulled ?? true;

  let usesInstanceColor = false;
  transforms.forEach((transform, index) => {
    const [x, y, z] = transform.position;
    const [rx, ry, rz] = transform.rotation ?? [0, 0, 0];
    const [sx, sy, sz] = transform.scale ?? [1, 1, 1];

    _object.position.set(x, y, z);
    _object.rotation.set(rx, ry, rz);
    _object.scale.set(sx, sy, sz);
    _object.updateMatrix();
    mesh.setMatrixAt(index, _object.matrix);

    if (transform.color !== undefined) {
      mesh.setColorAt(index, _color.set(transform.color));
      usesInstanceColor = true;
    }
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (usesInstanceColor && mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();

  return mesh;
}
