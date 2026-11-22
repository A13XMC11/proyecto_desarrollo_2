// S6-02: la herramienta que revisa configuración y secretos tiene que detectar de verdad lo que dice detectar.
// Un resultado «sin problemas» solo vale si se comprueba que, ante un problema, avisa.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { revisarEntorno, revisarRepositorio } = require("../../scripts/revisarConfiguracion");

const errores = (resultados) => resultados.filter((r) => r.nivel === "error").map((r) => `${r.texto} ${r.detalle || ""}`.trim());

const entornoBueno = {
  NODE_ENV: "production",
  SESSION_SECRET: "a".repeat(64),
  SQL_URL: "postgres://usuario:clave@base.ejemplo.com:5432/letritas?sslmode=require",
  MONGO_URI: "mongodb+srv://usuario:clave@cluster.ejemplo.net/letritas",
  SQL_SYNC_ALTER: "false",
  AI_ENABLED: "false"
};

describe("revisarConfiguracion: entorno", () => {
  it("un entorno de producción correcto no tiene errores", () => {
    assert.deepEqual(errores(revisarEntorno(entornoBueno)), []);
  });

  it("detecta cada problema que impide publicar", () => {
    const malo = {
      NODE_ENV: "development", SESSION_SECRET: "corto", SQL_URL: "postgres://u:p@h:5432/minijuegos_test",
      MONGO_URI: "", SQL_SYNC_ALTER: "true", APP_ORIGIN: "http://inseguro.example, no-es-url", ZONA_HORARIA: "Marte/Olympus"
    };
    const e = errores(revisarEntorno(malo)).join("\n");
    for (const esperado of ["NODE_ENV", "SESSION_SECRET es demasiado corto", "base de pruebas", "Falta MONGO_URI", "SQL_SYNC_ALTER", "no es HTTPS", "no es una URL", "ZONA_HORARIA"]) {
      assert.match(e, new RegExp(esperado), `debería avisar de: ${esperado}`);
    }
  });

  it("sin SESSION_SECRET falla", () => {
    const { SESSION_SECRET, ...sin } = entornoBueno;
    assert.match(errores(revisarEntorno(sin)).join(), /Falta SESSION_SECRET/);
  });

  it("generación habilitada sin los valores económicos es un error; con el generador falso completo, solo un aviso", () => {
    const sinValores = revisarEntorno({ ...entornoBueno, AI_ENABLED: "true" });
    assert.match(errores(sinValores).join(), /generación con IA no es válida/);
    const completa = revisarEntorno({
      ...entornoBueno, AI_ENABLED: "true", AI_PROVEEDOR: "falso", AI_TIEMPO_LIMITE_MS: "30000", AI_MARGEN_CONCILIACION_MS: "60000",
      AI_PRESUPUESTO_MENSUAL: "1", AI_COSTO_MAXIMO_LLAMADA: "0.01", AI_TARIFA_ENTRADA_MTOK: "0", AI_TARIFA_SALIDA_MTOK: "0"
    });
    assert.deepEqual(errores(completa), []);
    assert.ok(completa.some((r) => r.nivel === "aviso" && /HABILITADA/.test(r.texto)), "habilitar la IA siempre pide una decisión");
  });

  it("gemini sin clave, modelo y tope de salida es un error", () => {
    const r = revisarEntorno({ ...entornoBueno, AI_ENABLED: "true", AI_PROVEEDOR: "gemini", AI_TIEMPO_LIMITE_MS: "30000", AI_MARGEN_CONCILIACION_MS: "1", AI_PRESUPUESTO_MENSUAL: "1", AI_COSTO_MAXIMO_LLAMADA: "0.01", AI_TARIFA_ENTRADA_MTOK: "0", AI_TARIFA_SALIDA_MTOK: "0" });
    assert.match(errores(r).join(), /GEMINI_API_KEY/);
  });
});

describe("revisarConfiguracion: repositorio", () => {
  const repoTemporal = (archivos) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "revision-"));
    const git = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: "ignore" });
    git("init", "-q");
    for (const [nombre, contenido] of Object.entries(archivos)) {
      fs.mkdirSync(path.dirname(path.join(dir, nombre)), { recursive: true });
      fs.writeFileSync(path.join(dir, nombre), contenido);
    }
    git("add", "-A");
    return dir;
  };

  it("un repositorio limpio no tiene errores", () => {
    const dir = repoTemporal({ "src/app.js": "const x = 1;\n", ".env.example": "SQL_URL=postgres://postgres@127.0.0.1:5432/dev\n", "README.md": "usa mongodb+srv://usuario:clave@host/db de ejemplo\n" });
    try {
      assert.deepEqual(errores(revisarRepositorio(dir)), [], "la plantilla .env.example y los .md pueden llevar ejemplos");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it("detecta credenciales y archivos .env versionados", () => {
    const dir = repoTemporal({
      "src/config.js": [
        `const google = "AIza${"B".repeat(35)}";`,
        `const url = "postgres://admin:SuperSecreta123@db.ejemplo.com:5432/app";`,
        `const mongo = "mongodb+srv://usuario:otraClave99@cluster.ejemplo.net/app";`,
        `const sk = "sk-${"c".repeat(40)}";`
      ].join("\n"),
      "clave.pem": "-----BEGIN RSA PRIVATE KEY-----\nabc\n",
      "server/.env": "SESSION_SECRET=algo\n"
    });
    try {
      const e = errores(revisarRepositorio(dir)).join("\n");
      for (const esperado of ["archivos .env versionados", "clave de API de Google", "clave secreta tipo sk-", "URL de base de datos con contraseña", "clave privada"]) {
        assert.match(e, new RegExp(esperado), `debería detectar: ${esperado}`);
      }
      const detalle = revisarRepositorio(dir).map((r) => r.detalle || "").join(" ");
      assert.doesNotMatch(detalle, /SuperSecreta123/, "el informe no repite la contraseña encontrada");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
