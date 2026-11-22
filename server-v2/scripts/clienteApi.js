// Cliente HTTP mínimo para los scripts: se comporta como un navegador (guarda la cookie de sesión y el token CSRF).
// Lo usan sembrarDemo y probarRespaldo; funciona igual contra un servidor local o uno publicado.
function crearNavegador(base) {
  const estado = { cookie: undefined, csrf: undefined };
  return {
    base,
    estado,
    async llamar(ruta, { metodo = "GET", cuerpo, cabeceras } = {}) {
      const respuesta = await fetch(base + ruta, {
        method: metodo,
        headers: {
          "content-type": "application/json",
          ...(estado.cookie && { cookie: estado.cookie, "x-csrf-token": estado.csrf }),
          ...cabeceras
        },
        body: cuerpo && JSON.stringify(cuerpo)
      });
      const texto = await respuesta.text();
      const cookie = respuesta.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("letritas.sid="));
      const csrf = respuesta.headers.get("x-csrf-token");
      if (cookie && csrf) Object.assign(estado, { cookie, csrf });
      let datos;
      try { datos = texto ? JSON.parse(texto) : undefined; } catch { datos = texto; }
      return { status: respuesta.status, ok: respuesta.ok, cuerpo: datos };
    }
  };
}

// Devuelve el cuerpo si la respuesta fue correcta; si no, lanza con el motivo
function exigir(respuesta, que) {
  if (!respuesta.ok) throw new Error(`${que} falló (${respuesta.status}): ${JSON.stringify(respuesta.cuerpo)}`);
  return respuesta.cuerpo;
}

module.exports = { crearNavegador, exigir };
