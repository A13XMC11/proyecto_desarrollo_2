const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");

// Periodos de las cuotas de IA (§7.4.1, regla 5): las fechas se guardan en UTC, pero el límite diario
// usa el día calendario de la zona configurada (America/Guayaquil por defecto).
function diaEnZona(fecha, zonaHoraria) {
  try {
    // en-CA formatea como AAAA-MM-DD
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zonaHoraria, year: "numeric", month: "2-digit", day: "2-digit"
    }).format(fecha);
  } catch {
    throw new EntradaInvalida(`zona horaria inválida: ${zonaHoraria}`);
  }
}

const periodoDiario = (fecha, zonaHoraria) => diaEnZona(fecha, zonaHoraria);
const periodoMensual = (fecha, zonaHoraria) => diaEnZona(fecha, zonaHoraria).slice(0, 7);

module.exports = { periodoDiario, periodoMensual };
