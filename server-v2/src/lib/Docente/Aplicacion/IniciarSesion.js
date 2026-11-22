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
    // Siempre se verifica contra un hash (uno simulado si el correo no existe): el tiempo de respuesta
    // no revela si el correo está registrado (§7.4.2)
    const valida = await this.hasheador.verificar(contrasena, docente ? docente.hash : await this.hashSimulado());
    if (!docente || !valida) throw new NoAutenticado("Correo o contraseña incorrectos", "CREDENCIALES_INVALIDAS");
    return docente.aPublico();
  }

  // Se calcula una vez, con el mismo algoritmo y coste que los hashes reales
  hashSimulado() {
    if (!this.hashSimuladoPromesa) this.hashSimuladoPromesa = this.hasheador.hashear("contrasena-que-nadie-usa");
    return this.hashSimuladoPromesa;
  }
}

module.exports = IniciarSesion;
