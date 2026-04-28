# CLAUDE.md — GTA-like Three.js · Part 1 : Engine & World

> **Scope de ce fichier** : Semaines 1–2 uniquement — rendu, boucle de jeu, personnage, physique, premiers bâtiments.
> La partie crypto/token est dans `CLAUDE_CRYPTO.md` (semaines 3–4).

---

## Stack technique

| Couche | Lib | Version |
|---|---|---|
| Rendu | Three.js | ^0.169 |
| Physique | Rapier.js (WASM) | ^0.14 |
| Build | Vite | ^5 |
| Langage | TypeScript | ^5.4 |
| Modèles | GLTF/GLB | via `GLTFLoader` |
| Contrôles | Pointer Lock API | natif |

---

## Structure du projet

```
src/
  core/
    GameLoop.ts          # requestAnimationFrame, delta time
    Renderer.ts          # WebGLRenderer, resize, antialiasing
    InputManager.ts      # clavier, souris, pointer lock
  world/
    Environment.ts       # sol, skybox, lumières
    BuildingFactory.ts   # blocs modulaires réutilisables
    WorldChunk.ts        # chargement par zones
  entities/
    Player.ts            # mesh + physique + caméra
    Vehicle.ts           # voiture pilotable
    NPC.ts               # PNJ basique
  physics/
    PhysicsWorld.ts      # wrapper Rapier
    Colliders.ts         # helpers pour créer des colliders
  utils/
    AssetLoader.ts       # GLTF, textures, audio
    Debug.ts             # stats, wireframe mode
public/
  models/                # fichiers .glb
  textures/
  audio/
CLAUDE.md                # ce fichier
```

---

## ⚠️ RÈGLE ABSOLUE — BOUCLE DE FEEDBACK VISUEL 3D

> **Claude est mauvais en modélisation 3D intuitive.**
> Chaque fois qu'un objet 3D est créé ou modifié, Claude DOIT prendre un screenshot et l'analyser avant de continuer.
> Ne jamais supposer qu'un modèle est correct visuellement sans l'avoir vu.

### Protocole obligatoire après toute création/modification 3D

```
ÉTAPE 1 — Créer ou modifier le code 3D
ÉTAPE 2 — Lancer le serveur de preview (voir commande ci-dessous)
ÉTAPE 3 — Prendre un screenshot automatique via le script dédié
ÉTAPE 4 — Analyser l'image : proportions, collisions, position, échelle
ÉTAPE 5 — Corriger si nécessaire, répéter depuis ÉTAPE 3
ÉTAPE 6 — Valider uniquement quand l'analyse visuelle confirme le résultat
```

### Ce qui DÉCLENCHE obligatoirement le protocole

- Création d'un nouveau mesh (bâtiment, véhicule, PNJ, terrain)
- Modification d'échelle, rotation ou position d'un objet
- Ajout ou changement de matériau/texture
- Modification de lumières (position, intensité, couleur)
- Tout changement dans la caméra (FOV, position, near/far)
- Ajout d'un collider Rapier sur un objet visible

### Ce qui NE déclenche PAS le protocole (pas de visuel)

- Refactoring TypeScript pur (types, interfaces, classes)
- Modification de la physique sans impact visuel direct
- Changements dans `InputManager.ts` ou `GameLoop.ts`
- Modification du système de build (Vite config)

---

## Setup du feedback visuel — 2 options

### Option A — Puppeteer headless (recommandé en CI / sans écran)

**Installation (une seule fois) :**
```bash
npm install --save-dev puppeteer
```

**Script `scripts/screenshot.mjs` à créer :**
```javascript
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const PORT = process.env.PORT || 5173;
const OUT  = process.argv[2] || 'screenshot.png';
const WAIT = parseInt(process.argv[3] || '2000'); // ms pour que Three.js charge

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page    = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, WAIT));  // attend le rendu WebGL
await page.screenshot({ path: OUT, fullPage: false });
await browser.close();
console.log(`Screenshot saved: ${OUT}`);
```

**Commandes à utiliser :**
```bash
# Terminal 1 — serveur de dev
npm run dev

# Terminal 2 — screenshot
node scripts/screenshot.mjs debug/scene_$(date +%s).png 3000

# Puis Claude analyse l'image générée dans debug/
```

### Option B — MCP Puppeteer (si installé dans l'environnement Claude Code)

Si le MCP `puppeteer` est disponible dans l'environnement :
```
mcp__puppeteer__puppeteer_screenshot({
  url: "http://localhost:5173",
  width: 1280,
  height: 720
})
```
→ L'image est retournée directement dans le contexte de Claude, pas besoin de la sauvegarder.

### Option C — Export PNG statique depuis Three.js (fallback sans browser)

Ajouter dans `Debug.ts` :
```typescript
export function captureFrame(renderer: THREE.WebGLRenderer, filename = 'frame.png') {
  renderer.render(scene, camera); // force un rendu
  const dataURL = renderer.domElement.toDataURL('image/png');
  // En dev : ouvre dans un nouvel onglet pour inspection visuelle rapide
  const win = window.open();
  win?.document.write(`<img src="${dataURL}" style="max-width:100%">`);
}
```
Appeler `captureFrame()` dans la console du browser, puis copier-coller le screenshot dans le contexte Claude.

---

## Checklist d'analyse visuelle — ce que Claude doit vérifier sur chaque screenshot

Après chaque screenshot, Claude vérifie systématiquement :

```
PROPORTIONS
□ Le personnage fait environ 1.8u de hauteur (référence : largeur d'une porte = 1u)
□ Les véhicules sont 2–3x plus larges que le personnage
□ Les bâtiments ont des portes de taille cohérente avec le joueur
□ Pas d'objet à une échelle aberrante (x0.001 ou x1000)

POSITION & ORIGINE
□ Tous les objets reposent sur le sol (y ≥ 0 pour la base du mesh)
□ Pas d'objet qui "flotte" ou qui est à moitié enterré
□ L'origine du mesh correspond au centre ou à la base, pas à un coin bizarre
□ La caméra n'est pas à l'intérieur d'un objet au démarrage

MATÉRIAUX & LUMIÈRE
□ Pas de face complètement noire (problème de normales inversées)
□ Les ombres tombent dans la bonne direction
□ Pas de z-fighting (scintillement entre deux faces coplanaires)
□ Les textures ne sont pas étirées ou répétées de façon incohérente

PHYSIQUE / COLLIDERS
□ Le personnage ne traverse pas le sol
□ Les colliders sont visibles en wireframe mode et alignés avec le mesh
□ Pas de "tunneling" (objet rapide qui traverse une paroi)

CAMÉRA
□ Le FOV est entre 60–90° (75° par défaut)
□ Le near plane ne coupe pas le personnage (near = 0.1 minimum)
□ La caméra suit le personnage sans tremblements
```

---

## Conventions de code

### Nommage
```typescript
// Classes : PascalCase
class BuildingFactory {}

// Méthodes/variables : camelCase
const playerMesh = new THREE.Mesh();

// Constantes globales : UPPER_SNAKE
const GRAVITY = -9.81;
const PLAYER_HEIGHT = 1.8;  // toujours en "unités Three.js" (1u ≈ 1 mètre)

// Fichiers : PascalCase pour classes, camelCase pour utils
// Player.ts, BuildingFactory.ts, gameLoop.ts
```

### Unités
> **1 unité Three.js = 1 mètre réel**
> Toujours commenter les dimensions dans les constantes.

```typescript
const BUILDING_HEIGHT   = 10;   // 10m
const ROAD_WIDTH        = 8;    // 8m (2 voies)
const PLAYER_HEIGHT     = 1.8;  // 1.80m
const CAR_LENGTH        = 4.5;  // 4.5m
const CAR_WIDTH         = 2.0;  // 2m
```

### Structure d'un objet 3D — pattern obligatoire
```typescript
// Toujours séparer mesh et collider dans des méthodes distinctes
class Building {
  mesh: THREE.Group;
  collider: RAPIER.Collider;

  createMesh(): THREE.Group {
    // Pure Three.js — pas de physique ici
  }

  createCollider(world: RAPIER.World): RAPIER.Collider {
    // Pure Rapier — pas de Three.js ici
  }

  syncMeshToPhysics(): void {
    // Appelé dans la game loop pour synchroniser les positions
    const pos = this.collider.translation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
  }
}
```

---

## Boucle de jeu — architecture

```typescript
// GameLoop.ts
export class GameLoop {
  private lastTime = 0;

  start() {
    requestAnimationFrame(this.tick.bind(this));
  }

  private tick(timestamp: number) {
    const delta = Math.min((timestamp - this.lastTime) / 1000, 0.05); // cap à 50ms
    this.lastTime = timestamp;

    // Ordre obligatoire à chaque frame :
    // 1. Input (lire les touches)
    // 2. Physics step (Rapier)
    // 3. Sync meshes (position physique → position Three.js)
    // 4. Update entities (IA, animations)
    // 5. Render

    InputManager.update();
    physicsWorld.step(delta);
    EntityManager.syncAll();
    EntityManager.updateAll(delta);
    renderer.render(scene, camera);

    requestAnimationFrame(this.tick.bind(this));
  }
}
```

---

## Commandes disponibles

```bash
npm run dev          # Vite dev server avec HMR
npm run build        # Build de production
npm run preview      # Preview du build prod local
npm run typecheck    # tsc --noEmit (pas de transpile, juste les types)
npm run screenshot   # node scripts/screenshot.mjs debug/latest.png 3000
npm run debug:physics # Lance avec wireframe colliders activés (FLAG=debug)
```

---

## Debug — outils intégrés

### Activer le mode debug
```typescript
// Passer ?debug=true dans l'URL
// ou FLAG=debug npm run dev
const DEBUG = new URLSearchParams(window.location.search).has('debug')
           || import.meta.env.VITE_DEBUG === 'true';
```

### Ce que le mode debug affiche
- Stats.js (FPS, MS, MB) en haut à gauche
- Wireframe des colliders Rapier en jaune
- Axes helper sur tous les objets (RGB = XYZ)
- Grid helper au sol (1u = 1m)
- Console.log des positions player à chaque frame

---

## Problèmes fréquents et solutions

### Modèle GLTF invisible après import
```
Causes possibles (dans l'ordre à vérifier) :
1. Matériau double-face manquant → material.side = THREE.DoubleSide
2. Normales inversées dans Blender → recalculer les normales avant export
3. Échelle incorrecte → model.scale.setScalar(0.01) si exporté en cm
4. Pas de lumière ambiante → ajouter AmbientLight(0xffffff, 0.5)
→ PRENDRE UN SCREENSHOT pour diagnostiquer
```

### Personnage qui traverse le sol
```
Causes possibles :
1. Collider Rapier pas encore créé → vérifier PhysicsWorld.addBody()
2. Gravity pas activée → world.gravity = { x: 0, y: -9.81, z: 0 }
3. Delta time trop grand (lag spike) → cap delta à 0.05s dans GameLoop
4. Sol physique manquant → ajouter un RigidBodyDesc.fixed() pour le ground
→ ACTIVER LE MODE DEBUG pour voir les colliders
```

### Performance < 30 FPS
```
1. Trop de draw calls → utiliser InstancedMesh pour les bâtiments identiques
2. Textures non compressées → KTX2 via `npx gltf-transform compress`
3. Ombres trop coûteuses → réduire shadowMap.mapSize à 1024
4. Physique trop fine → réduire le nombre de substeps Rapier
→ PRENDRE UN SCREENSHOT des stats pour documenter le problème
```

---

## Workflow Git

```bash
# Une branche par feature de la roadmap
git checkout -b feature/week1-renderer
git checkout -b feature/week1-game-loop
git checkout -b feature/week2-player
git checkout -b feature/week2-physics
git checkout -b feature/week2-buildings

# Commit après chaque tâche cochée dans la roadmap
# Format : type(scope): description
git commit -m "feat(renderer): add WebGL renderer with resize handler"
git commit -m "feat(player): add WASD movement with pointer lock"
git commit -m "fix(physics): prevent player from falling through floor"

# Screenshot dans le commit quand c'est un changement visuel
git add debug/screenshot_XXXX.png
git commit -m "feat(buildings): add modular building blocks [visual: debug/screenshot_XXXX.png]"
```

---

## Objectifs de fin de semaine 2 — critères de validation

Pour considérer la Part 1 comme terminée, ces critères DOIVENT être confirmés **par screenshot analysé** :

```
□ FPS stable ≥ 60 sur une machine de dev standard
□ Personnage se déplace en WASD, sprint avec Shift
□ Caméra third-person suit le joueur sans clip
□ Personnage ne traverse pas le sol ni les bâtiments
□ Au moins 5 bâtiments différents placés sur la map
□ Voiture pilotable avec entrée/sortie (touche F)
□ Pas d'erreurs dans la console TypeScript
□ Build de production < 5MB (sans les assets)
```

---

*Prochaine étape → `CLAUDE_CRYPTO.md` : smart contract ERC-20 sur Base testnet, wallet connect, transactions in-game.*
