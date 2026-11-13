const NoAutenticado = require("../../Compartido/Dominio/Errores/NoAutenticado");
const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

// Verifica correo y contraseña. El mismo mensaje para correo inexistente y contraseña errónea:
// así no se revela qué correos están registrados.
class IniciarSesion {
  constructor(docenteRepository, hasheador) {
    this.docenteRepository = docenteRepository;
    this.hasheador = hasheador;
  }

  async ejecutar({ correo, contrasena } = {}) {
    if (typeof correo !== "string" || typeof contrasena !== "string" || !correo.trim() || !contrasena) {
      throw new EntradaInvalida("correo y contrasena son obligatorios");
    }
    const docente = await this.docenteRepository.findByCorreo(correo);
    const valida = docente ? await this.hasheador.verificar(contrasena, docente.hash) : false;
    if (!valida) throw new NoAutenticado("Correo o contraseña incorrectos", "CREDENCIALES_INVALIDAS");
    return docente.aPublico();
  }
}

module.exports = IniciarSesion;
