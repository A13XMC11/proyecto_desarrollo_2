// Contenido de actividades FICTICIO y válido, armado desde el catálogo de recursos. Lo usan las pruebas de
// aceptación y los datos de demostración, para que ningún otro archivo repita el contrato de los ejercicios.
// Cada ejercicio cumple las reglas pedagógicas del servidor (VersionJuego.validarContenido).
const CatalogoRecursosJson = require("../src/lib/Juego/Infraestructura/CatalogoRecursosJson");
const { recursosParaGeneracion } = require("../src/lib/Generacion/Dominio/Entidades/RecursosParaGeneracion");

const catalogo = new CatalogoRecursosJson();
const VOCALES = ["a", "e", "i", "o", "u"];

const CONSIGNA_VOCALES = "¿Con qué vocal empieza esta palabra?";
const CONSIGNA_SILABAS = "Ordena las sílabas para formar la palabra";

// Palabras de la temática que sirven para la habilidad (las mismas que la generación con IA)
const recursosDe = (habilidad, tematica) => recursosParaGeneracion(catalogo, { habilidad, tematica });

function ejerciciosVocales(tematica = "animales", cantidad = 5) {
  const recursos = recursosDe("vocales", tematica);
  if (recursos.length < cantidad) throw new Error(`la temática ${tematica} no tiene ${cantidad} palabras con vocal inicial`);
  return recursos.slice(0, cantidad).map((recurso, i) => {
    const correcta = recurso.vocalInicial;
    const otras = VOCALES.filter((v) => v !== correcta);
    const opciones = [correcta, otras[i % otras.length], otras[(i + 2) % otras.length]];
    return {
      id: `e${i + 1}`,
      consigna: `${CONSIGNA_VOCALES} (${i + 1})`,
      pista: "Escucha el primer sonido",
      objetivo: recurso.palabra,
      recursoId: recurso.id,
      opciones: [...new Set(opciones)].map((t) => ({ id: t, texto: t })),
      respuestaCorrectaId: correcta
    };
  });
}

function ejerciciosSilabas(tematica = "animales", cantidad = 5) {
  const recursos = recursosDe("palabras_silabas", tematica);
  if (recursos.length < cantidad) throw new Error(`la temática ${tematica} no tiene ${cantidad} palabras de 2 a 3 sílabas`);
  return recursos.slice(0, cantidad).map((recurso, i) => {
    const piezas = recurso.silabas.map((texto, j) => ({ id: `p${j + 1}`, texto }));
    return {
      id: `e${i + 1}`,
      consigna: `${CONSIGNA_SILABAS} (${i + 1})`,
      objetivo: recurso.palabra,
      palabraId: recurso.id,
      piezas,
      ordenCorrecto: piezas.map((p) => p.id)
    };
  });
}

const ejerciciosDe = (habilidad, tematica, cantidad) =>
  habilidad === "vocales" ? ejerciciosVocales(tematica, cantidad) : ejerciciosSilabas(tematica, cantidad);

// Lo que respondería un estudiante: la elección correcta o una incorrecta pero bien formada
const eleccionCorrecta = (ejercicio) => (ejercicio.opciones ? ejercicio.respuestaCorrectaId : ejercicio.ordenCorrecto);
function eleccionIncorrecta(ejercicio) {
  if (ejercicio.opciones) return ejercicio.opciones.find((o) => o.id !== ejercicio.respuestaCorrectaId).id;
  return [...ejercicio.ordenCorrecto].reverse(); // misma piezas, otro orden (las palabras elegidas tienen 2 o más sílabas distintas)
}

module.exports = { ejerciciosVocales, ejerciciosSilabas, ejerciciosDe, eleccionCorrecta, eleccionIncorrecta, recursosDe };
