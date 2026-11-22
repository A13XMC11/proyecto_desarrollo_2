const { iniciarSesion, cerrarSesion, enviarTokenCsrf } = require("../../../../Infraestructura/http/sesion");

// Crear y cerrar la sesión del navegador es responsabilidad del controlador, no regla de negocio (§5.2.4)
class DocenteController {
  constructor({ registrarDocente, listarDocentes, obtenerDocentePorId, obtenerDocenteActual, actualizarDocente, eliminarDocente, iniciarSesion: casoIniciarSesion }) {
    this.casoIniciarSesion = casoIniciarSesion;
    this.registrarDocente = registrarDocente;
    this.listarDocentes = listarDocentes;
    this.obtenerDocentePorId = obtenerDocentePorId;
    this.obtenerDocenteActual = obtenerDocenteActual;
    this.actualizarDocente = actualizarDocente;
    this.eliminarDocente = eliminarDocente;
  }

  // Registrarse deja la sesión iniciada
  registrar = async (req, res) => {
    const docente = await this.registrarDocente.ejecutar(req.body);
    await iniciarSesion(req, res, docente.id);
    res.status(201).json(docente);
  };

  // Entrar: el id de sesión se regenera y el token CSRF llega en la cabecera X-CSRF-Token
  entrar = async (req, res) => {
    const docente = await this.casoIniciarSesion.ejecutar(req.body);
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
