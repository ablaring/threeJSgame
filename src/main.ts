import * as THREE from 'three';
import { Renderer } from './core/Renderer';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { Environment } from './world/Environment';
import { BuildingFactory } from './world/BuildingFactory';
import { EmpireStateBuilding } from './world/EmpireStateBuilding';
import { TrumpTower } from './world/TrumpTower';
import { CentralPark } from './world/CentralPark';
import { Prison } from './world/Prison';
import { AlleyFactory } from './world/AlleyFactory';
import { TreeFactory } from './world/TreeFactory';
import { Player } from './entities/Player';
import { RemotePlayer } from './entities/RemotePlayer';
import { Vehicle } from './entities/Vehicle';
import { RocketPickup } from './entities/RocketPickup';
import { PoliceManager } from './entities/PoliceManager';
import { SpawnBotManager } from './entities/SpawnBots';
import { FugitiveArrestMission } from './entities/FugitiveArrestMission';
import { Debug } from './utils/Debug';
import { Hud } from './utils/Hud';
import { CombatFx } from './utils/CombatFx';
import { NetworkClient } from './network/NetworkClient';
import { WEAPON_AK47, WEAPON_PISTOL, WEAPON_ROCKET_LAUNCHER, WeaponId } from './network/types';
import { AudioManager } from './audio/AudioManager';
import { WalletManager, shortAddress } from './web3/WalletManager';
import { ConnectScreen } from './web3/ConnectScreen';
import { Inventory } from './web3/Inventory';
import { SolanaPaymentService } from './web3/SolanaPayments';
import { ShopScreen } from './web3/ShopScreen';

async function main() {
  // --- Wallet gate (Phantom required to play) ---
  const wallet = new WalletManager();
  const connectScreen = new ConnectScreen(wallet);
  const walletPubkey = await connectScreen.waitForConnection();
  console.log('[wallet] connected:', walletPubkey);

  // --- Core ---
  const { renderer, scene, camera } = new Renderer();
  const input = new InputManager(renderer.domElement);
  const physics = new PhysicsWorld();
  await physics.init();

  // --- Debug ---
  const debug = new Debug(scene);

  // --- World ---
  new Environment(scene, physics);
  const buildingFactory = new BuildingFactory();
  buildingFactory.placeCity(scene, physics);
  const alleyFactory = new AlleyFactory();
  alleyFactory.placeAlleys(scene, physics);
  const empireState = new EmpireStateBuilding(95, 60, scene, physics);
  const trumpTower = new TrumpTower(-105, 84, scene, physics);
  const centralPark = new CentralPark(0, 165, scene, physics);
  const prison = new Prison(80, -126, scene, physics);
  const policeObstacles = [
    ...buildingFactory.getVehicleObstacles(),
    trumpTower.getObstacle(),
    prison.getObstacle(),
  ];
  const treeFactory = new TreeFactory();
  treeFactory.placeStreetTrees(scene, physics);

  // --- Player ---
  const player = new Player(scene, physics, camera);
  const spawnBots = new SpawnBotManager(scene);

  // --- Vehicles ---
  const vehicles: Vehicle[] = [
    new Vehicle(10, 5, 0xCC2222, scene, physics),    // Red car near spawn
    new Vehicle(-15, -10, 0x2222CC, scene, physics),  // Blue car
    new Vehicle(45, 5, 0x22CC22, scene, physics),     // Green car
  ];

  let currentVehicle: Vehicle | null = null;

  // --- Weapon pickups ---
  const rocketPickups: RocketPickup[] = [
    new RocketPickup(20, -15.8, scene, 0.35),
    new RocketPickup(-20, -20.8, scene, -0.65),
    new RocketPickup(55, 14.2, scene, 1.25),
    new RocketPickup(-50, 54.2, scene, -1.1),
    new RocketPickup(-55, -25.6, scene, 0.8),
  ];

  // --- Inventory + Shop ---
  const inventory = new Inventory(walletPubkey);
  const payments = new SolanaPaymentService(wallet);
  const shop = new ShopScreen(inventory, payments);

  // Map inventory item IDs (string) → in-game weapon IDs (number).
  const ITEM_TO_WEAPON: Record<string, WeaponId> = {
    'ak47': WEAPON_AK47,
    'rocket-launcher': WEAPON_ROCKET_LAUNCHER,
  };

  function refreshInventoryHud() {
    const owned = [
      true, // pistol always
      player.ownsWeapon(WEAPON_AK47),
      player.ownsWeapon(WEAPON_ROCKET_LAUNCHER),
    ];
    const active =
      player.getWeapon() === WEAPON_AK47 ? 1 :
      player.getWeapon() === WEAPON_ROCKET_LAUNCHER ? 2 :
      0;
    hud.setInventory(active, owned);
    hud.setWeapon(player.getWeaponLabel());
  }

  // B toggles the shop, Esc closes it. Listen at the document level so it
  // works whether or not pointer lock is active.
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyB') {
      e.preventDefault();
      shop.toggle();
      return;
    }
    if (e.code === 'Escape' && shop.isVisible()) {
      shop.close();
      return;
    }
    // Weapon switching is handled here (rather than in Player.update) so that
    // the keystroke is registered immediately, regardless of game-loop timing
    // or whether the player update happens to run on this frame.
    if (shop.isVisible()) return;
    if (e.code === 'Digit1') player.setWeapon(WEAPON_PISTOL);
    else if (e.code === 'Digit2') player.setWeapon(WEAPON_AK47);
    else if (e.code === 'Digit3') player.setWeapon(WEAPON_ROCKET_LAUNCHER);
  });

  // --- HUD + FX + Audio ---
  const hud = new Hud();
  hud.setWallet(shortAddress(walletPubkey));
  const fugitiveMission = new FugitiveArrestMission(spawnBots, prison, scene, hud);
  const fx = new CombatFx(scene);
  const audio = new AudioManager();
  audio.attachCamera(camera);

  // Browsers block AudioContext until a user gesture. Unlock on first canvas click.
  renderer.domElement.addEventListener('click', () => audio.unlock(), { once: false });

  // Hook player audio events
  player.onJump = () => audio.playJump();

  // Restore previously-purchased weapons from inventory and keep HUD in sync.
  for (const itemId of inventory.list()) {
    const weaponId = ITEM_TO_WEAPON[itemId];
    if (weaponId !== undefined) player.unlockWeapon(weaponId);
  }
  player.onWeaponChanged = () => refreshInventoryHud();
  player.onWeaponUnlocked = () => refreshInventoryHud();
  shop.onPurchased = (itemId) => {
    const weaponId = ITEM_TO_WEAPON[itemId];
    if (weaponId !== undefined) player.unlockWeapon(weaponId);
  };
  refreshInventoryHud();

  // --- Networking ---
  const serverUrl = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'ws://localhost:2567';
  const network = new NetworkClient(serverUrl);
  const remotePlayers = new Map<string, RemotePlayer>();

  // Reused scratch vectors
  const _muzzlePos = new THREE.Vector3();
  const _hitPoint = new THREE.Vector3();

  function applyLocalPlayerDamage(damage: number) {
    if (player.dead) return;
    if (network.isConnected()) {
      network.sendSelfDamage(damage);
      return;
    }
    const nextHealth = Math.max(0, player.health - damage);
    const dead = nextHealth <= 0;
    hud.setHealth(nextHealth, dead);
    player.applyDamage(nextHealth, dead);
    if (dead) {
      audio.playDeath();
      window.setTimeout(() => {
        player.respawn(0, 1.5, 0);
        hud.setHealth(100, false);
      }, 3000);
    } else {
      audio.playDamage();
    }
  }

  const police = new PoliceManager(
    scene,
    policeObstacles,
    (level) => hud.setWantedLevel(level),
    (event) => {
      fx.spawnTracer(event.origin, event.end);
      fx.spawnImpact(event.end);
      audio.playGunshot(event.origin);
      if (event.hitPlayer) applyLocalPlayerDamage(event.damage);
    }
  );

  // Raycast against remote players (server validates anyway)
  player.raycastTargets = (origin, dir, maxDist) => {
    const raycaster = new THREE.Raycaster(origin, dir, 0, maxDist);
    const meshes: THREE.Object3D[] = [];
    for (const rp of remotePlayers.values()) {
      if (!rp.dead) meshes.push(rp.mesh);
    }
    let bestHit: { sessionId: string; point: THREE.Vector3; distance: number } | null = null;
    if (meshes.length > 0) {
      const hits = raycaster.intersectObjects(meshes, true);
      if (hits.length > 0) {
        const hit = hits[0];
        // Walk up to find which RemotePlayer was hit
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          for (const rp of remotePlayers.values()) {
            if (rp.mesh === obj) {
              bestHit = {
                sessionId: rp.sessionId,
                point: hit.point.clone(),
                distance: hit.point.distanceTo(origin),
              };
              break;
            }
          }
          if (bestHit) break;
          obj = obj.parent;
        }
      }
    }

    const policeHit = police.raycast(origin, dir, maxDist);
    if (policeHit && (!bestHit || policeHit.distance < bestHit.distance)) {
      return { sessionId: `police:${policeHit.id}`, point: policeHit.point };
    }

    return bestHit ? { sessionId: bestHit.sessionId, point: bestHit.point } : null;
  };

  // Local fire → spawn tracer + send to server + play sound
  player.onFire = (weapon, origin, dir, hitTargetId, hitPoint) => {
    police.reportPlayerShot(weapon, player.getPosition());

    const muzzle = player.getMuzzleWorldPosition(_muzzlePos);
    const endPoint = hitPoint ?? origin.clone().add(dir.clone().multiplyScalar(100));
    const hitPoliceId = hitTargetId?.startsWith('police:') ? hitTargetId.slice('police:'.length) : null;

    if (weapon === WEAPON_ROCKET_LAUNCHER) {
      fx.spawnRocketShot(muzzle, endPoint);
      audio.playRocketLaunch();
      const explosionPoint = endPoint.clone();
      window.setTimeout(() => audio.playExplosion(explosionPoint), 350);
      police.damagePoliceInExplosion(endPoint);
      if (hitTargetId && !hitPoliceId) police.reportSeriousCrime(player.getPosition(), 3);
    } else {
      fx.spawnTracer(muzzle, endPoint);
      if (hitPoint) fx.spawnImpact(hitPoint);
      audio.playGunshot(); // local: non-positional
      if (hitPoliceId) police.damagePolice(hitPoliceId);
      else if (hitTargetId) police.reportSeriousCrime(player.getPosition(), 2);
    }

    network.sendFire({
      weapon,
      ox: origin.x, oy: origin.y, oz: origin.z,
      dx: dir.x, dy: dir.y, dz: dir.z,
      hitTargetId: hitPoliceId ? null : hitTargetId,
      hpx: endPoint.x, hpy: endPoint.y, hpz: endPoint.z,
    });
  };

  network.setCallbacks({
    onAdd: (sessionId, snap) => {
      const rp = new RemotePlayer(sessionId, scene);
      rp.applySnapshot(snap);
      rp.applyHealth(snap.health, snap.dead);
      remotePlayers.set(sessionId, rp);
    },
    onChange: (sessionId, snap) => {
      const rp = remotePlayers.get(sessionId);
      if (!rp) return;
      rp.applySnapshot(snap);
      rp.applyHealth(snap.health, snap.dead);
    },
    onRemove: (sessionId) => {
      const rp = remotePlayers.get(sessionId);
      if (rp) {
        rp.dispose(scene);
        remotePlayers.delete(sessionId);
      }
    },
    onShot: (event) => {
      const rp = remotePlayers.get(event.sessionId);
      if (!rp) return;
      rp.setWeapon(event.weapon);
      const muzzle = rp.getMuzzleWorldPosition(_muzzlePos);
      _hitPoint.set(event.hpx, event.hpy, event.hpz);
      if (event.weapon === WEAPON_ROCKET_LAUNCHER) {
        fx.spawnRocketShot(muzzle, _hitPoint);
      } else {
        fx.spawnTracer(muzzle, _hitPoint);
        fx.spawnImpact(_hitPoint);
      }
      rp.showMuzzleFlash();
      const soundOrigin = new THREE.Vector3(event.ox, event.oy, event.oz);
      if (event.weapon === WEAPON_ROCKET_LAUNCHER) {
        audio.playRocketLaunch(soundOrigin);
        const explosionPoint = _hitPoint.clone();
        window.setTimeout(() => audio.playExplosion(explosionPoint), 350);
      } else {
        // Positional gunshot at the shooter's origin so direction is audible
        audio.playGunshot(soundOrigin);
      }
    },
    onSelfHealth: (health, dead) => {
      const wasAlive = !player.dead;
      const tookDamage = health < player.health;
      hud.setHealth(health, dead);
      player.applyDamage(health, dead);
      if (tookDamage && !dead) audio.playDamage();
      if (dead && wasAlive) {
        police.clearWanted();
        audio.playDeath();
      }
    },
    onRespawn: (event) => {
      player.respawn(event.x, event.y, event.z);
    },
  });

  network.connect()
    .then(() => network.sendWallet(walletPubkey))
    .catch((err) => {
      console.warn('[net] connection failed, running offline:', err);
    });

  // --- Camera mode toggle (F1) ---
  let f1WasDown = false;
  function handleCameraToggle() {
    const f1Down = input.isKeyDown('F1');
    if (f1Down && !f1WasDown) {
      player.toggleFirstPerson();
    }
    f1WasDown = f1Down;
  }

  // --- Interaction with F key (weapons first, then vehicles) ---
  let fKeyWasDown = false;
  function handleInteraction() {
    const fDown = input.isKeyDown('KeyF');
    if (fDown && !fKeyWasDown) {
      if (currentVehicle) {
        // Exit vehicle
        const exitPos = currentVehicle.exit();
        player.teleport(exitPos.x, exitPos.y, exitPos.z);
        player.setVisible(true);
        currentVehicle = null;
      } else {
        const playerPos = player.getPosition();
        let pickedUpWeapon = false;
        for (const pickup of rocketPickups) {
          if (pickup.canPickup(playerPos) && pickup.pickup()) {
            player.pickupRocketLauncher();
            hud.setWeapon(player.getWeaponLabel());
            audio.playPickup();
            pickedUpWeapon = true;
            break;
          }
        }
        if (!pickedUpWeapon) {
          // Try to enter nearest vehicle
          for (const v of vehicles) {
            if (!v.isOccupied() && v.canEnter(playerPos)) {
              v.enter();
              currentVehicle = v;
              player.setVisible(false);
              break;
            }
          }
        }
      }
    }
    fKeyWasDown = fDown;
  }

  function handleWeaponShortcuts() {
    if (shop.isVisible()) return;

    let nextWeapon: WeaponId | null = null;
    if (input.isKeyDown('Digit1')) nextWeapon = WEAPON_PISTOL;
    else if (input.isKeyDown('Digit2')) nextWeapon = WEAPON_AK47;
    else if (input.isKeyDown('Digit3')) nextWeapon = WEAPON_ROCKET_LAUNCHER;

    if (nextWeapon !== null && player.setWeapon(nextWeapon)) {
      hud.setWeapon(player.getWeaponLabel());
    }
  }

  // --- Game Loop ---
  const gameLoop = new GameLoop((delta) => {
    debug.beginFrame();

    input.update();
    handleCameraToggle();
    handleInteraction();
    handleWeaponShortcuts();

    for (const pickup of rocketPickups) pickup.update(delta);

    // Physics step
    physics.step(delta);

    // Update entities. Skip player input + vehicle driving while the shop
    // modal is open so the player can interact with the UI uninterrupted.
    const shopOpen = shop.isVisible();
    if (currentVehicle) {
      if (!shopOpen) currentVehicle.update(delta, input, camera);
      // Still update other vehicles (sync mesh)
      for (const v of vehicles) {
        if (v !== currentVehicle) v.update(delta, input, camera);
      }
    } else {
      if (!shopOpen) player.update(delta, input, physics);
      for (const v of vehicles) v.update(delta, input, camera);
    }

    // Sync local player to network + interpolate remote players
    if (network.isConnected() && !currentVehicle) {
      network.sendInput(player.getNetworkState());
    }
    for (const rp of remotePlayers.values()) rp.update(delta);
    spawnBots.update(delta);
    fugitiveMission.update(delta, player.getPosition(), input);
    police.update(delta, player.getPosition(), player.dead);
    fx.update();

    // Footstep cadence (grounded + moving + outside vehicle)
    if (!currentVehicle && player.lastMoving && player.isGroundedNow && !player.dead) {
      audio.tryPlayFootstep(player.lastSprinting);
    }

    // Render
    renderer.render(scene, camera);

    debug.endFrame();
  });

  // Expose for debug screenshots
  (window as any).__GAME__ = {
    camera, player, scene, renderer, gameLoop, network, remotePlayers, rocketPickups, police, policeObstacles, fx, hud, THREE,
    buildingFactory, empireState, trumpTower, centralPark, prison, treeFactory,
    alleyFactory, spawnBots, fugitiveMission,
    renderOnce() {
      renderer.render(scene, camera);
    },
  };

  gameLoop.start();
}

main().catch(console.error);
