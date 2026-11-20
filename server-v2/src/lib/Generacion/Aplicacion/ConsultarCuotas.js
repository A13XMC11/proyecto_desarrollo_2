const EntradaInvalida = require("../../Compartido/Dominio/Errores/EntradaInvalida");
const { periodoDiario } = require("../Dominio/Entidades/Periodo");

const DIA = /^\d{4}-\d{2}-\d{2}$/;

// Consulta de solo lectura del consumo diario del propio docente y su límite. El contador global es un
// dato de administración (suma de todos los docentes) y no se expone.
class ConsultarCuotas {
  constructor(cuotaRepository, { limiteDiario = 3, habilitada = false, zonaHoraria = "America/Guayaquil" } = {}) {
    this.cuotaRepository = cuotaRepository;
    this.config = { limiteDiario, habilitada, zonaHoraria };
  }

  async ejecutar(docenteId, { dia } = {}) {
    const periodo = dia || periodoDiario(new Date(), this.config.zonaHoraria);
    if (!DIA.test(periodo)) throw new EntradaInvalida("dia inválido: use AAAA-MM-DD");
    return {
      dia: periodo,
      diaria: await this.cuotaRepository.obtener(docenteId, periodo),
      limiteDiario: this.config.limiteDiario,
      generacionHabilitada: this.config.habilitada
    };
  }
}

module.exports = ConsultarCuotas;
