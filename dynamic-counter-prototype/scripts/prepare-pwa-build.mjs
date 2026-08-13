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

const files = (await listFiles(clientRoot))
  .filter((file) => !file.endsWith(`${sep}sw.js`))
  .map((file) => `/${relative(clientRoot, file).split(sep).join("/")}`)
  .sort();

const buildId = (await readFile(join(clientRoot, "index.html"), "utf8"))
  .match(/assets\/index-([^."]+)/)?.[1] ?? Date.now().toString(36);

const source = `const CACHE = "last-order-${buildId}";
const SHELL = ${JSON.stringify(files)};
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("last-order-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then(hit => hit || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => event.request.mode === "navigate" ? caches.match("/index.html", { ignoreVary: true }) : Response.error())));
});
`;

await writeFile(join(clientRoot, "sw.js"), source);
console.log(`Prepared PWA service worker with ${files.length} precached files.`);
