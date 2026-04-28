import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5173';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));

await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__GAME__?.renderer && window.__GAME__?.scene);
await new Promise(r => setTimeout(r, 1500));

const report = await page.evaluate(() => {
  const g = window.__GAME__;
  g.gameLoop.stop();
  g.renderer.render(g.scene, g.camera);

  let objects = 0;
  let meshes = 0;
  let instancedMeshes = 0;
  let pointLights = 0;
  const roots = [];
  g.scene.traverse((obj) => {
    objects += 1;
    if (obj.isMesh) meshes += 1;
    if (obj.isInstancedMesh) instancedMeshes += 1;
    if (obj.isPointLight) pointLights += 1;
  });
  for (const child of g.scene.children) {
    let childObjects = 0;
    let childMeshes = 0;
    let childInstanced = 0;
    child.traverse((obj) => {
      childObjects += 1;
      if (obj.isMesh) childMeshes += 1;
      if (obj.isInstancedMesh) childInstanced += 1;
    });
    roots.push({
      name: child.name || child.type,
      type: child.type,
      objects: childObjects,
      meshes: childMeshes,
      instancedMeshes: childInstanced,
    });
  }
  roots.sort((a, b) => b.meshes - a.meshes);

  const info = g.renderer.info;
  return {
    objects,
    meshes,
    instancedMeshes,
    pointLights,
    calls: info.render.calls,
    triangles: info.render.triangles,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    treeCount: g.treeFactory?.treeCount ?? null,
    roots: roots.slice(0, 12),
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
