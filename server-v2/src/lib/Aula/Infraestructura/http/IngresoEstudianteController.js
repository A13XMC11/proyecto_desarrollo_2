const { iniciarSesionEstudiante, cerrarSesionEstudiante } = require("../../../../Infraestructura/http/sesion");

class IngresoEstudianteController {
  constructor({ ingresarEstudiante }) {
    this.ingresarEstudiante = ingresarEstudiante;
  }

  ingresar = async (req, res) => {
    const { docenteId, cursoId, estudiante } = await this.ingresarEstudiante.ejecutar(req.body);
    await iniciarSesionEstudiante(req, res, { docenteId, cursoId, estudianteId: estudiante.id });
    res.json({ apodo: estudiante.apodo || null, avatarId: estudiante.avatarId, codigoLista: estudiante.codigoLista });
  };

  salir = async (req, res) => {
    await cerrarSesionEstudiante(req);
    res.status(204).send();
  };
}

module.exports = IngresoEstudianteController;
