const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const derivar = promisify(scrypt);
const LONGITUD = 64;

// scrypt de la biblioteca estándar de Node: sin criptografía propia y sin dependencias nuevas
class HasheadorContrasenaScrypt {
  async hashear(contrasena) {
    const sal = randomBytes(16);
    const clave = await derivar(contrasena, sal, LONGITUD);
    return `${sal.toString("hex")}:${clave.toString("hex")}`;
  }

  async verificar(contrasena, hash) {
    if (typeof hash !== "string" || !hash.includes(":")) return false;
    const [sal, esperado] = hash.split(":");
    const clave = await derivar(contrasena, Buffer.from(sal, "hex"), LONGITUD);
    const guardado = Buffer.from(esperado, "hex");
    return guardado.length === clave.length && timingSafeEqual(guardado, clave);
  }
}

module.exports = HasheadorContrasenaScrypt;
