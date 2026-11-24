const { iniciarSesion, cerrarSesion, enviarTokenCsrf } = require("../../../../Infraestructura/http/sesion");

// Crear y cerrar la sesión del navegador es responsabilidad del controlador, no regla de negocio (§5.2.4)
class DocenteController {
  constructor({ registrarDocente, listarDocentes, obtenerDocentePorId, obtenerDocenteActual, actualizarDocente, eliminarDocente, iniciarSesion: casoIniciarSesion, limitadorLogin }) {
    this.casoIniciarSesion = casoIniciarSesion;
    this.limitadorLogin = limitadorLogin;
    this.registrarDocente = registrarDocente;
    this.listarDocentes = listarDocentes;
    this.obtenerDocentePorId = obtenerDocentePorId;
    this.obtenerDocenteActual = obtenerDocenteActual;
    this.actualizarDocente = actualizarDocente;
    this.eliminarDocente = eliminarDocente;
  }

  // Registrarse deja la sesión iniciada. Si la sesión no se puede abrir (p. ej. MongoDB caído) la cuenta recién
  // creada se deshace: así el docente puede reintentar el registro en vez de quedar con una cuenta a medias.
  registrar = async (req, res) => {
    const docente = await this.registrarDocente.ejecutar(req.body);
    try {
      await iniciarSesion(req, res, docente.id);
    } catch (error) {
      await this.eliminarDocente.ejecutar(docente.id, docente.id).catch((fallo) => {
        console.error("No se pudo deshacer el registro tras fallar la sesión:", fallo);
      });
      throw error;
    }
    res.status(201).json(docente);
  };

  // Entrar: el id de sesión se regenera y el token CSRF llega en la cabecera X-CSRF-Token
  // Los intentos fallidos se limitan por IP y correo (fuerza bruta): al agotarse responde 429 con Retry-After
  entrar = async (req, res) => {
    const correo = req.body && req.body.correo;
    const limitador = this.limitadorLogin;
    if (limitador) {
      try {
        limitador.verificar(req.ip, correo);
      } catch (error) {
        if (error.segundosEspera) res.set("Retry-After", String(error.segundosEspera));
        throw error;
      }
    }
    let docente;
    try {
      docente = await this.casoIniciarSesion.ejecutar(req.body);
    } catch (error) {
      // Solo cuentan las credenciales equivocadas, no los datos mal formados
      if (limitador && error.codigo === "CREDENCIALES_INVALIDAS") limitador.registrarFallo(req.ip, correo);
      throw error;
    }
    if (limitador) limitador.registrarExito(req.ip, correo);
    await iniciarSesion(req, res, docente.id);
    res.json(docente);
  };

  // Quién soy: sirve al recargar la página para recuperar la sesión y el token CSRF
  sesionActual = async (req, res) => {
    let docente;
    try {
      docente = await this.obtenerDocenteActual.ejecutar(req.docenteId);
    } catch (error) {
      await cerrarSesion(req, res); // la cuenta ya no existe: la sesión no vale
      throw error;
    }
    enviarTokenCsrf(req, res);
    res.json(docente);
  };

  salir = async (req, res) => {
    await cerrarSesion(req, res);
    res.status(204).send();
  };

  listar = async (req, res) => {
    res.json(await this.listarDocentes.ejecutar(req.docenteId));
  };

  obtenerPorId = async (req, res) => {
    const docente = await this.obtenerDocentePorId.ejecutar(req.docenteId, req.params.id);
    res.json(docente);
  };

  actualizar = async (req, res) => {
    const docente = await this.actualizarDocente.ejecutar(req.docenteId, req.params.id, req.body);
    res.json(docente);
  };

  // Al eliminar la propia cuenta, su sesión también termina
  eliminar = async (req, res) => {
    await this.eliminarDocente.ejecutar(req.docenteId, req.params.id);
    await cerrarSesion(req, res);
    res.status(204).send();
  };
}

module.exports = DocenteController;
