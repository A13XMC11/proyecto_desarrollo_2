const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { CODIGOS_CANAL, SUPERFICIES, DISPOSITIVOS } = require("../../../Compartido/Dominio/ValoresPermitidos");
const { enumerado, identificador } = require("../../../Compartido/Dominio/Validaciones");

class Canal {
  constructor({ id, codigo, superficie, dispositivo }) {
    enumerado(codigo, CODIGOS_CANAL, "codigo");
    enumerado(superficie, SUPERFICIES, "superficie");
    enumerado(dispositivo, DISPOSITIVOS, "dispositivo");
    if (codigo !== `${superficie}_${dispositivo}`) {
      throw new EntradaInvalida("El código del canal debe ser <superficie>_<dispositivo>");
    }

    this.id = identificador(id, "id", { requerido: false });
    this.codigo = codigo;
    this.superficie = superficie;
    this.dispositivo = dispositivo;
  }
}

module.exports = Canal;
