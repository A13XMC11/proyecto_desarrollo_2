const LimiteAlcanzado = require("../../Compartido/Dominio/Errores/LimiteAlcanzado");

// Límite de intentos fallidos de inicio de sesión (fuerza bruta). Cuenta en memoria del proceso:
// vale para un solo servidor; con varias instancias habría que moverlo a MongoDB o Redis.
// Dos contadores en una ventana deslizante:
// - por IP + correo: frena adivinar la contraseña de una cuenta, sin que un tercero bloquee al docente desde otra IP
// - por IP: frena probar muchos correos distintos desde el mismo origen
class LimitadorIntentosLogin {
  constructor({ maxPorCuenta = 5, maxPorIp = 20, ventanaMs = 15 * 60 * 1000, ahora = Date.now } = {}) {
    this.maxPorCuenta = maxPorCuenta;
    this.maxPorIp = maxPorIp;
    this.ventanaMs = ventanaMs;
    this.ahora = ahora;
    this.fallos = new Map(); // clave -> marcas de tiempo de los fallos dentro de la ventana
  }

  claveCuenta(ip, correo) {
    return `c|${ip}|${String(correo).trim().toLowerCase()}`;
  }

  claveIp(ip) {
    return `i|${ip}`;
  }

  vigentes(clave) {
    const desde = this.ahora() - this.ventanaMs;
    const marcas = (this.fallos.get(clave) || []).filter((t) => t > desde);
    if (marcas.length) this.fallos.set(clave, marcas);
    else this.fallos.delete(clave);
    return marcas;
  }

  // Lanza 429 (con segundosEspera) si ya se agotaron los intentos; no cuenta nada
  verificar(ip, correo) {
    const revisiones = [
      [this.vigentes(this.claveCuenta(ip, correo)), this.maxPorCuenta],
      [this.vigentes(this.claveIp(ip)), this.maxPorIp]
    ];
    let espera = 0;
    for (const [marcas, maximo] of revisiones) {
      if (marcas.length >= maximo) {
        // se libera cuando el fallo más antiguo que cuenta salga de la ventana
        const libre = marcas[marcas.length - maximo] + this.ventanaMs - this.ahora();
        espera = Math.max(espera, libre);
      }
    }
    if (espera > 0) {
      const error = new LimiteAlcanzado(
        "Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo",
        "DEMASIADOS_INTENTOS_LOGIN"
      );
      error.segundosEspera = Math.ceil(espera / 1000);
      throw error;
    }
  }

  registrarFallo(ip, correo) {
    const t = this.ahora();
    for (const clave of [this.claveCuenta(ip, correo), this.claveIp(ip)]) {
      this.fallos.set(clave, [...this.vigentes(clave), t]);
    }
  }

  // Un acceso correcto limpia el contador de esa cuenta (el de la IP sigue su curso)
  registrarExito(ip, correo) {
    this.fallos.delete(this.claveCuenta(ip, correo));
  }

  // Evita que el mapa crezca sin límite con IPs que no vuelven
  limpiar() {
    for (const clave of [...this.fallos.keys()]) this.vigentes(clave);
  }
}

module.exports = LimitadorIntentosLogin;
