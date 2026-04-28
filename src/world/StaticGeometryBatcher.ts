import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface MeshBatch {
  material: THREE.Material;
  geometries: THREE.BufferGeometry[];
  castShadow: boolean;
  receiveShadow: boolean;
}

interface InstanceBatch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
  hasColors: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  name: string;
}

export function batchStaticMeshes(root: THREE.Group) {
  root.updateMatrixWorld(true);

  const rootInverse = root.matrixWorld.clone().invert();
  const batches = new Map<string, MeshBatch>();
  const meshesToRemove: THREE.Mesh[] = [];

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.InstancedMesh) return;
    if (Array.isArray(object.material)) return;
    if (object.userData.skipBatch === true) return;

    const geometry = object.geometry.index
      ? object.geometry.clone().toNonIndexed()
      : object.geometry.clone();
    const localMatrix = rootInverse.clone().multiply(object.matrixWorld);
    geometry.applyMatrix4(localMatrix);

    const key = object.material.uuid;
    const batch: MeshBatch = batches.get(key) ?? {
      material: object.material,
      geometries: [],
      castShadow: false,
      receiveShadow: false,
    };
    batch.geometries.push(geometry);
    batch.castShadow ||= object.castShadow;
    batch.receiveShadow ||= object.receiveShadow;
    batches.set(key, batch);
    meshesToRemove.push(object);
  });

  for (const mesh of meshesToRemove) {
    mesh.parent?.remove(mesh);
  }

  for (const [key, batch] of batches) {
    const merged = mergeGeometries(batch.geometries, false);
    if (!merged) continue;

    const mesh = new THREE.Mesh(merged, batch.material);
    mesh.name = `Static Batch ${key}`;
    mesh.castShadow = batch.castShadow;
    mesh.receiveShadow = batch.receiveShadow;
    root.add(mesh);
  }
}

export function batchInstancedMeshes(root: THREE.Group) {
  root.updateMatrixWorld(true);

  const rootInverse = root.matrixWorld.clone().invert();
  const batches = new Map<string, InstanceBatch>();
  const meshesToRemove: THREE.InstancedMesh[] = [];
  const instanceMatrix = new THREE.Matrix4();
  const instanceColor = new THREE.Color();

  root.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    if (Array.isArray(object.material)) return;
    if (object.userData.skipBatch === true) return;

    const key = `${object.name}:${object.material.uuid}`;
    const batch: InstanceBatch = batches.get(key) ?? {
      geometry: object.geometry,
      material: object.material,
      matrices: [],
      colors: [],
      hasColors: object.instanceColor !== null,
      castShadow: false,
      receiveShadow: false,
      name: object.name || 'Instanced Static Batch',
    };

    const meshToRoot = rootInverse.clone().multiply(object.matrixWorld);
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, instanceMatrix);
      batch.matrices.push(meshToRoot.clone().multiply(instanceMatrix));

      if (object.instanceColor) {
        object.getColorAt(i, instanceColor);
        batch.colors.push(instanceColor.clone());
        batch.hasColors = true;
      }
    }

    batch.castShadow ||= object.castShadow;
    batch.receiveShadow ||= object.receiveShadow;
    batches.set(key, batch);
    meshesToRemove.push(object);
  });

  for (const mesh of meshesToRemove) {
    mesh.parent?.remove(mesh);
  }

  for (const [key, batch] of batches) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    mesh.name = `Instanced Batch ${key}`;
    mesh.castShadow = batch.castShadow;
    mesh.receiveShadow = batch.receiveShadow;

    batch.matrices.forEach((matrix, index) => {
      mesh.setMatrixAt(index, matrix);
      if (batch.hasColors && batch.colors[index]) {
        mesh.setColorAt(index, batch.colors[index]);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (batch.hasColors && mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
}
