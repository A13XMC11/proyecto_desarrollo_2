const crypto = require("node:crypto");
const NoEncontrado = require("../../Compartido/Dominio/Errores/NoEncontrado");
const ConflictoDeEstado = require("../../Compartido/Dominio/Errores/ConflictoDeEstado");

// Sin 0/O ni 1/I/L: los lee un niño o su familia y los teclea en un teléfono
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGITUD = 8;
const REINTENTOS = 3;

const generarCodigo = () => Array.from({ length: LONGITUD }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join("");

// Entrada del usuario -> forma guardada (acepta minúsculas, espacios y guiones: "abcd-2345")
const normalizarCodigo = (texto) => (typeof texto === "string" ? texto.toUpperCase().replace(/[^A-Z0-9]/g, "") : "");

// El docente abre (o rota) el acceso de su curso. Rotar invalida el código anterior.
class GenerarCodigoAcceso {
  constructor(cursoRepository) {
    this.cursoRepository = cursoRepository;
  }

  async ejecutar(docenteId, cursoId) {
    const curso = await this.cursoRepository.findById(cursoId, docenteId);
    if (!curso) throw new NoEncontrado("Curso no encontrado");
    if (curso.archivado) throw new ConflictoDeEstado("Un curso archivado no admite acceso", "CURSO_ARCHIVADO");
    for (let intento = 1; ; intento++) {
      try {
        return await this.cursoRepository.asignarCodigoAcceso(cursoId, docenteId, generarCodigo());
      } catch (error) {
        if (error.codigo !== "CODIGO_ACCESO_REPETIDO" || intento >= REINTENTOS) throw error;
      }
    }
  }
}

// Cierra el acceso del curso
class RevocarCodigoAcceso {
  constructor(cursoRepository) {
    this.cursoRepository = cursoRepository;
  }

  async ejecutar(docenteId, cursoId) {
    const curso = await this.cursoRepository.asignarCodigoAcceso(cursoId, docenteId, null);
    if (!curso) throw new NoEncontrado("Curso no encontrado");
    return curso;
  }
}

module.exports = { GenerarCodigoAcceso, RevocarCodigoAcceso, normalizarCodigo };
