const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

const DIA = /^\d{4}-\d{2}-\d{2}$/;

// Consulta de solo lectura del consumo diario del propio docente. El contador global es un dato de
// administración (suma de todos los docentes) y no se expone.
class ConsultarCuotas {
  constructor(cuotaRepository) {
    this.cuotaRepository = cuotaRepository;
  }

  async ejecutar(docenteId, { dia } = {}) {
    const periodo = dia || new Date().toISOString().slice(0, 10);
    if (!DIA.test(periodo)) throw new EntradaInvalida("dia inválido: use AAAA-MM-DD");
    return { diaria: await this.cuotaRepository.obtener(docenteId, periodo) };
  }
}

module.exports = ConsultarCuotas;
