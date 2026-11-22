const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");

const DIA = /^\d{4}-\d{2}-\d{2}$/;

// Consulta de solo lectura del consumo diario del propio docente. El contador global es un dato de
// administración (suma de todos los docentes) y no se expone.
class ConsultarCuotas {
  constructor(cuotaRepository, config) {
    this.cuotaRepository = cuotaRepository;
    this.config = config;
  }

  async ejecutar(docenteId, { dia } = {}) {
    const periodo = dia || new Date().toISOString().slice(0, 10);
    if (!DIA.test(periodo)) throw new EntradaInvalida("dia inválido: use AAAA-MM-DD");
    // maximoDiario permite a la pantalla mostrar el cupo real sin suponerlo
    return {
      diaria: await this.cuotaRepository.obtener(docenteId, periodo),
      ...(this.config && { maximoDiario: this.config.maxDiarias })
    };
  }
}

module.exports = ConsultarCuotas;
