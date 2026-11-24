const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const LimitadorIntentosLogin = require("../../../../src/lib/Docente/Infraestructura/LimitadorIntentosLogin");
const DocenteController = require("../../../../src/lib/Docente/Infraestructura/http/DocenteController");
const NoAutenticado = require("../../../../src/lib/Compartido/Dominio/Errores/NoAutenticado");

const reloj = () => {
  const r = { t: 1_000_000, ahora: () => r.t };
  return r;
};

describe("LimitadorIntentosLogin", () => {
  it("bloquea tras los intentos fallidos permitidos y avisa cuánto esperar", () => {
    const r = reloj();
    const l = new LimitadorIntentosLogin({ maxPorCuenta: 3, ventanaMs: 60_000, ahora: r.ahora });
    for (let i = 0; i < 3; i++) {
      l.verificar("1.1.1.1", "ana@x.ec");
      l.registrarFallo("1.1.1.1", "ana@x.ec");
    }
    assert.throws(
      () => l.verificar("1.1.1.1", "ana@x.ec"),
      (e) => e.statusCode === 429 && e.codigo === "DEMASIADOS_INTENTOS_LOGIN" && e.segundosEspera === 60
    );
  });

  it("el correo se compara sin mayúsculas ni espacios", () => {
    const l = new LimitadorIntentosLogin({ maxPorCuenta: 1 });
    l.registrarFallo("1.1.1.1", "Ana@X.ec");
    assert.throws(() => l.verificar("1.1.1.1", " ana@x.ec "), (e) => e.statusCode === 429);
  });

  it("otra IP no queda bloqueada por los fallos de la primera", () => {
    const l = new LimitadorIntentosLogin({ maxPorCuenta: 1 });
    l.registrarFallo("1.1.1.1", "ana@x.ec");
    assert.doesNotThrow(() => l.verificar("2.2.2.2", "ana@x.ec"));
  });

  it("probar muchos correos desde una misma IP también se frena", () => {
    const l = new LimitadorIntentosLogin({ maxPorCuenta: 5, maxPorIp: 3 });
    for (let i = 0; i < 3; i++) l.registrarFallo("1.1.1.1", `u${i}@x.ec`);
    assert.throws(() => l.verificar("1.1.1.1", "otro@x.ec"), (e) => e.statusCode === 429);
  });

  it("pasada la ventana se puede volver a intentar", () => {
    const r = reloj();
    const l = new LimitadorIntentosLogin({ maxPorCuenta: 1, ventanaMs: 60_000, ahora: r.ahora });
    l.registrarFallo("1.1.1.1", "ana@x.ec");
    assert.throws(() => l.verificar("1.1.1.1", "ana@x.ec"));
    r.t += 60_001;
    assert.doesNotThrow(() => l.verificar("1.1.1.1", "ana@x.ec"));
  });

  it("un acceso correcto reinicia el contador de la cuenta", () => {
    const l = new LimitadorIntentosLogin({ maxPorCuenta: 2 });
    l.registrarFallo("1.1.1.1", "ana@x.ec");
    l.registrarExito("1.1.1.1", "ana@x.ec");
    l.registrarFallo("1.1.1.1", "ana@x.ec");
    assert.doesNotThrow(() => l.verificar("1.1.1.1", "ana@x.ec"));
  });
});

describe("DocenteController.entrar con límite de intentos", () => {
  const crearRes = () => {
    const res = { cabeceras: {} };
    res.set = (k, v) => ((res.cabeceras[k] = v), res);
    res.json = (b) => ((res.cuerpo = b), res);
    return res;
  };
  const crearReq = (contrasena) => ({
    ip: "9.9.9.9",
    body: { correo: "ana@x.ec", contrasena },
    session: { regenerate: (cb) => cb(), save: (cb) => cb() }
  });
  const crearControlador = () => {
    let llamadas = 0;
    const controller = new DocenteController({
      iniciarSesion: {
        ejecutar: async ({ contrasena }) => {
          llamadas++;
          if (contrasena !== "buena") throw new NoAutenticado("mal", "CREDENCIALES_INVALIDAS");
          return { id: "d1" };
        }
      },
      limitadorLogin: new LimitadorIntentosLogin({ maxPorCuenta: 2 })
    });
    return { controller, llamadas: () => llamadas };
  };

  it("tras los fallos responde 429 con Retry-After y ni siquiera verifica la contraseña", async () => {
    const { controller, llamadas } = crearControlador();
    for (let i = 0; i < 2; i++) {
      await assert.rejects(controller.entrar(crearReq("mala"), crearRes()), (e) => e.statusCode === 401);
    }
    const res = crearRes();
    // aunque ahora llegue la contraseña correcta, sigue bloqueado
    await assert.rejects(controller.entrar(crearReq("buena"), res), (e) => e.statusCode === 429);
    assert.ok(Number(res.cabeceras["Retry-After"]) > 0);
    assert.equal(llamadas(), 2);
  });

  it("los datos mal formados (400) no cuentan como intento fallido", async () => {
    const controller = new DocenteController({
      iniciarSesion: { ejecutar: async () => { throw Object.assign(new Error("x"), { statusCode: 400, codigo: "ENTRADA_INVALIDA" }); } },
      limitadorLogin: new LimitadorIntentosLogin({ maxPorCuenta: 1 })
    });
    for (let i = 0; i < 3; i++) {
      await assert.rejects(controller.entrar(crearReq(""), crearRes()), (e) => e.statusCode === 400);
    }
  });

  it("un acceso correcto responde con el docente", async () => {
    const { controller } = crearControlador();
    const res = crearRes();
    await controller.entrar(crearReq("buena"), res);
    assert.deepEqual(res.cuerpo, { id: "d1" });
  });
});
