import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startConsultProxy } from "./consult-proxy.mjs";

await startConsultProxy();
const vite = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", ".bin", "vite");
const child = spawn(vite, process.argv.slice(2), { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
