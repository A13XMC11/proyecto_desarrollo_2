const Docente = require("../Dominio/Entidades/Docente");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

class RegistrarDocente {
  constructor(docenteRepository, hasheador) {
    this.docenteRepository = docenteRepository;
    this.hasheador = hasheador;
  }

  async ejecutar({ nombre, correo, contrasena, institucion } = {}) {
    if (typeof contrasena !== "string" || contrasena.length < 8 || contrasena.length > 128) {
      throw new EntradaInvalida("contrasena debe tener entre 8 y 128 caracteres");
    }
    const hash = await this.hasheador.hashear(contrasena);
    const docente = new Docente({ nombre, correo, hash, institucion });
    const guardado = await this.docenteRepository.save(docente);
    return guardado.aPublico();
  }
}

module.exports = RegistrarDocente;
