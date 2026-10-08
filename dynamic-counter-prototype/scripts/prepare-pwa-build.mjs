import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const clientRoot = join(root, "dist", "client");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat();
}

// 预缓存清单写成相对路径（不带前导 /）：GitHub Pages 把应用挂在 /last-order/m/ 之类子路径下，
// 相对 URL 会按 service worker 自己的 scope 解析，根部署和子路径部署不用改生成器。
const files = (await listFiles(clientRoot))
  .filter((file) => !file.endsWith(`${sep}sw.js`))
  .map((file) => `./${relative(clientRoot, file).split(sep).join("/")}`)
  .sort();

const buildId = (await readFile(join(clientRoot, "index.html"), "utf8"))
  .match(/assets\/index-([^."]+)/)?.[1] ?? Date.now().toString(36);

const source = `const CACHE = "last-order-${buildId}";
const SHELL = ${JSON.stringify(files)};
const INDEX = new URL("./index.html", self.registration.scope);
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("last-order-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then(hit => hit || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => event.request.mode === "navigate" ? caches.match(INDEX, { ignoreVary: true }) : Response.error())));
});
`;

await writeFile(join(clientRoot, "sw.js"), source);
console.log(`Prepared PWA service worker with ${files.length} precached files.`);
