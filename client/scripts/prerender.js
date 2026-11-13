// Prerenderiza la portada dentro de dist/index.html para que los buscadores lean el contenido sin JS.
// Se ejecuta después de `vite build` (ver package.json).
import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "..");
execSync("npx vite build --ssr src/entry-server.jsx --outDir dist-ssr --logLevel warn", { cwd: raiz, stdio: "inherit" });

const { render } = await import(pathToFileURL(resolve(raiz, "dist-ssr/entry-server.js")).href);
const plantilla = readFileSync(resolve(raiz, "dist/index.html"), "utf8");
const html = render("/");
if (!html.includes("Minijuegos de lectura")) throw new Error("El prerender de la portada salió vacío");

writeFileSync(resolve(raiz, "dist/index.html"), plantilla.replace("<!--app-->", html));
rmSync(resolve(raiz, "dist-ssr"), { recursive: true, force: true });
console.log(`Portada prerenderizada (${(html.length / 1024).toFixed(1)} kB de HTML).`);
