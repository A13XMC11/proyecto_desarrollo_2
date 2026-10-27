const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.resolve(__dirname, "../../src");
const LIB = path.join(SRC, "lib");
const PROHIBIDAS = ["domain", "application", "adapters", "services", "utils", "mappers"];
const EXTERNOS_PROHIBIDOS = ["express", "mongoose", "sequelize", "pg"];

function archivos(carpeta, filtro = () => true) {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(carpeta, e.name);
    if (e.isDirectory()) return archivos(ruta, filtro);
    return filtro(ruta) ? [ruta] : [];
  });
}

function carpetas(carpeta) {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    if (!e.isDirectory()) return [];
    const ruta = path.join(carpeta, e.name);
    return [ruta, ...carpetas(ruta)];
  });
}

// Cada require() con ruta literal; los relativos se resuelven a ruta absoluta.
function requires(archivo) {
  const codigo = fs.readFileSync(archivo, "utf8");
  return [...codigo.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map(([, destino]) => ({
    destino,
    absoluto: destino.startsWith(".") ? path.resolve(path.dirname(archivo), destino) : null
  }));
}

const info = (archivo) => {
  const partes = path.relative(LIB, archivo).split(path.sep);
  return { modulo: partes[0], capa: partes[1] };
};

const js = archivos(LIB, (r) => r.endsWith(".js"));
const infoDestino = (absoluto) => (absoluto.startsWith(LIB + path.sep) ? info(absoluto) : null);

describe("Arquitectura: reglas de capas", () => {
  it("hay archivos que revisar", () => {
    assert.ok(js.length > 20);
  });

  it("Dominio solo importa Dominio (propio, de otros módulos o Compartido) y validator", () => {
    const fallos = [];
    for (const archivo of js.filter((a) => info(a).capa === "Dominio")) {
      for (const { destino, absoluto } of requires(archivo)) {
        if (!absoluto) {
          if (destino !== "validator") fallos.push(`${path.relative(SRC, archivo)} importa "${destino}"`);
          continue;
        }
        const d = infoDestino(absoluto);
        if (!d || d.capa !== "Dominio") fallos.push(`${path.relative(SRC, archivo)} importa ${destino} (fuera de Dominio)`);
      }
    }
    assert.deepEqual(fallos, []);
  });

  it("Aplicacion no importa Infraestructura, express ni mongoose; entre módulos solo Dominio", () => {
    const fallos = [];
    for (const archivo of js.filter((a) => info(a).capa === "Aplicacion")) {
      for (const { destino, absoluto } of requires(archivo)) {
        if (EXTERNOS_PROHIBIDOS.includes(destino)) fallos.push(`${path.relative(SRC, archivo)} importa ${destino}`);
        if (!absoluto) continue;
        const d = infoDestino(absoluto);
        if (!d || d.capa === "Infraestructura") fallos.push(`${path.relative(SRC, archivo)} importa Infraestructura (${destino})`);
        else if (d.modulo !== info(archivo).modulo && d.capa !== "Dominio") {
          fallos.push(`${path.relative(SRC, archivo)} importa ${destino} de otro módulo fuera de Dominio`);
        }
      }
    }
    assert.deepEqual(fallos, []);
  });

  it("Infraestructura no importa Aplicacion ni Dominio/Infraestructura ajenos salvo http/index.js", () => {
    const fallos = [];
    for (const archivo of js.filter((a) => info(a).capa === "Infraestructura")) {
      const esComposicion = archivo.endsWith(path.join("http", "index.js"));
      for (const { absoluto } of requires(archivo)) {
        const d = absoluto && infoDestino(absoluto);
        if (!d) continue;
        if (d.modulo !== info(archivo).modulo && d.capa === "Infraestructura" && !esComposicion) {
          fallos.push(`${path.relative(SRC, archivo)} importa la Infraestructura de ${d.modulo}`);
        }
        if (d.modulo !== info(archivo).modulo && d.capa === "Aplicacion") {
          fallos.push(`${path.relative(SRC, archivo)} importa la Aplicacion de ${d.modulo}`);
        }
      }
    }
    assert.deepEqual(fallos, []);
  });

  it("no hay ciclos entre módulos", () => {
    const grafo = new Map();
    for (const archivo of js) {
      const origen = info(archivo).modulo;
      if (!grafo.has(origen)) grafo.set(origen, new Set());
      for (const { absoluto } of requires(archivo)) {
        const d = absoluto && infoDestino(absoluto);
        if (d && d.modulo !== origen) grafo.get(origen).add(d.modulo);
      }
    }

    const estado = new Map();
    const ciclos = [];
    const visitar = (modulo, ruta) => {
      if (estado.get(modulo) === "visitando") return ciclos.push([...ruta, modulo].join(" -> "));
      if (estado.get(modulo) === "listo") return;
      estado.set(modulo, "visitando");
      for (const vecino of grafo.get(modulo) || []) visitar(vecino, [...ruta, modulo]);
      estado.set(modulo, "listo");
    };
    for (const modulo of grafo.keys()) visitar(modulo, []);
    assert.deepEqual(ciclos, []);
  });

  it("no existen carpetas prohibidas, contenedores ni archivos vacíos", () => {
    const prohibidas = carpetas(SRC).filter((c) => PROHIBIDAS.includes(path.basename(c)));
    assert.deepEqual(prohibidas.map((c) => path.relative(SRC, c)), []);

    const contenedores = archivos(SRC).filter((a) => /container\.js$|UnitOfWork/i.test(a));
    assert.deepEqual(contenedores.map((c) => path.relative(SRC, c)), []);

    const vacios = archivos(SRC).filter((a) => fs.readFileSync(a, "utf8").trim() === "");
    assert.deepEqual(vacios.map((c) => path.relative(SRC, c)), []);
  });

  it("el servidor usa solo CommonJS (sin import/export ES)", () => {
    const fallos = archivos(SRC, (r) => r.endsWith(".js"))
      .filter((a) => /^\s*(import\s.+from|export\s+(default|const|function|class))/m.test(fs.readFileSync(a, "utf8")))
      .map((a) => path.relative(SRC, a));
    assert.deepEqual(fallos, []);
  });

  it("el escáner detecta una violación sintética (la prueba no es vacua)", () => {
    const tmp = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "capas-"));
    const archivo = path.join(tmp, "Malo.js");
    fs.writeFileSync(archivo, 'const m = require("mongoose");\nconst x = require("../Infraestructura/Y");\n');
    const encontrados = requires(archivo).map((r) => r.destino);
    assert.deepEqual(encontrados, ["mongoose", "../Infraestructura/Y"]);
    assert.ok(EXTERNOS_PROHIBIDOS.includes(encontrados[0]));
    fs.rmSync(tmp, { recursive: true });
  });
});
