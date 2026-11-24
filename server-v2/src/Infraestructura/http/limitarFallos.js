const LimiteAlcanzado = require("../../lib/Compartido/Dominio/Errores/LimiteAlcanzado");

// Freno a quien prueba códigos al azar: cuenta solo los intentos fallidos por IP en una ventana.
// En memoria (un proceso): suficiente para la versión de prueba; con varias instancias hay que moverlo a un almacén común.
function crearLimitadorDeFallos({ maximo = 20, ventanaMs = 10 * 60 * 1000 } = {}) {
  const fallos = new Map(); // ip -> { cuenta, hasta }

  const vigente = (ip) => {
    const f = fallos.get(ip);
    if (f && f.hasta <= Date.now()) fallos.delete(ip);
    return fallos.get(ip);
  };

  return {
    revisar(ip) {
      const f = vigente(ip);
      if (f && f.cuenta >= maximo) {
        throw new LimiteAlcanzado("Demasiados intentos. Espera unos minutos y vuelve a probar.", "DEMASIADOS_INTENTOS");
      }
    },
    registrarFallo(ip) {
      const f = vigente(ip) || { cuenta: 0, hasta: Date.now() + ventanaMs };
      fallos.set(ip, { ...f, cuenta: f.cuenta + 1 });
      if (fallos.size > 5000) fallos.delete(fallos.keys().next().value); // acota la memoria
    }
  };
}

module.exports = { crearLimitadorDeFallos };
