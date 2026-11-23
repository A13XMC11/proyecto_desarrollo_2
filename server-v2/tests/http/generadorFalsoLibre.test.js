const { describe } = require("node:test");
const assert = require("node:assert/strict");

// Valores de prueba: sin proveedor real y con 10 ejercicios permitidos (como la suite completa)
Object.assign(process.env, {
  AI_ENABLED: "true", AI_PROVEEDOR: "falso", GENERADOR_FALSO_DEMORA_MS: "0", AI_MAX_DIARIAS: "3", AI_MAX_SIMULTANEAS: "1",
  AI_TIEMPO_LIMITE_MS: "5000", AI_MARGEN_CONCILIACION_MS: "1000", AI_PRESUPUESTO_MENSUAL: "1000000",
  AI_COSTO_MAXIMO_LLAMADA: "1", AI_TARIFA_ENTRADA_MTOK: "1", AI_TARIFA_SALIDA_MTOK: "2", PERMITIR_10_EJERCICIOS: "true"
});

const { pruebasConBase } = require("../Infraestructura/database/baseDePruebas");
const { conServidor, registrarDocente } = require("./cliente");
const { crearAsegurarCanales } = require("../../src/lib/Canal/Infraestructura/http");
const VersionJuego = require("../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const VersionRepositoryMongoose = require("../../src/lib/Juego/Infraestructura/VersionRepositoryMongoose");
const GeneradorContenidoFalso = require("../../src/lib/Generacion/Infraestructura/GeneradorContenidoFalso");
const FiltroContenidoJson = require("../../src/lib/Juego/Infraestructura/FiltroContenidoJson");
const EmojisPermitidosJson = require("../../src/lib/Juego/Infraestructura/EmojisPermitidosJson");
const { COMPATIBILIDAD } = require("../../src/lib/Compartido/Dominio/ValoresPermitidos");

// Con una versión armada con la salida del generador falso (sin pasar por la generación HTTP, que sigue cerrada hasta el
// paso 7): se aprueba y se juega por HTTP, y el servidor corrige.
const prueba = pruebasConBase("generadorFalsoLibreHttp", { sql: true, mongo: true });
const llamar = conServidor();
const versiones = new VersionRepositoryMongoose();
const falso = new GeneradorContenidoFalso({ filtroContenido: new FiltroContenidoJson(), emojisPermitidos: new EmojisPermitidosJson() });

const HABILIDADES = ["vocales", "palabras_silabas", "completar_silaba", "contar_silabas"];
const TEMAS = ["frutas", "colores", "animales", "dinosaurios del espacio"]; // la última no está en el diccionario

async function escenario() {
  await crearAsegurarCanales().ejecutar();
  const docente = await registrarDocente(llamar);
  const curso = (await llamar("/api/cursos", { metodo: "POST", docente, cuerpo: { grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027" } })).cuerpo.id;
  const estudiante = (await llamar("/api/estudiantes", { metodo: "POST", docente, cuerpo: { cursoId: curso, codigoLista: "A01", franjaEdad: 6, avatarId: "gato" } })).cuerpo.id;
  return { docente, curso, estudiante };
}

describe("HTTP: la salida del generador falso en temática libre se aprueba y se juega", () => {
  for (const cantidad of [5, 10]) {
    prueba(`las 4 habilidades × 4 temáticas con ${cantidad} ejercicios: aprobar, jugar y corregir en el servidor`, async () => {
      const esc = await escenario();
      for (const habilidad of HABILIDADES) {
        for (const tematica of TEMAS) {
          const etiqueta = `${habilidad} · ${tematica} · ${cantidad}`;
          const { titulo, ejercicios } = await falso.generar({ habilidad, mecanica: COMPATIBILIDAD[habilidad], modoTematica: "libre", tematica, cantidad, franjaEdad: 6 });
          const juego = (await llamar("/api/juegos", { metodo: "POST", docente: esc.docente, cuerpo: { cursoId: esc.curso, titulo, habilidad } })).cuerpo.id;
          const version = await versiones.save(new VersionJuego({
            juegoId: juego, ejercicios,
            configuracion: { habilidad, mecanica: COMPATIBILIDAD[habilidad], modoTematica: "libre", tematica, cantidadEjercicios: cantidad }
          }));
          const aprobada = await llamar(`/api/juegos/${juego}/versiones/${version.id}/aprobar`, { metodo: "POST", docente: esc.docente });
          assert.equal(aprobada.status, 200, `${etiqueta}: ${JSON.stringify(aprobada.cuerpo)}`);
          assert.equal(aprobada.cuerpo.juego.estado, "listo", etiqueta);

          const partida = await llamar("/api/partidas", { metodo: "POST", docente: esc.docente, cuerpo: { estudianteId: esc.estudiante, juegoId: juego, canal: "aula_computador" } });
          assert.equal(partida.status, 201, etiqueta);
          const jugable = (await llamar(`/api/partidas/${partida.cuerpo.id}/jugable`, { docente: esc.docente })).cuerpo;
          assert.equal(jugable.ejercicios.length, cantidad, etiqueta);
          const texto = JSON.stringify(jugable);
          for (const secreto of ["respuestaCorrectaId", "ordenCorrecto", "palabraId"]) assert.ok(!texto.includes(secreto), `${etiqueta}: la vista del estudiante no debe incluir ${secreto}`);

          for (const [i, e] of ejercicios.entries()) {
            const intento = await llamar(`/api/partidas/${partida.cuerpo.id}/intentos`, {
              metodo: "POST", docente: esc.docente, cuerpo: { ejercicioId: e.id, eleccion: e.ordenCorrecto || e.respuestaCorrectaId, operacionId: `op-${habilidad}-${cantidad}-${tematica.length}-${i}` }
            });
            assert.equal(intento.cuerpo.esCorrecto, true, `${etiqueta} · ${e.id}`);
          }
          const final = (await llamar(`/api/partidas/${partida.cuerpo.id}`, { docente: esc.docente })).cuerpo;
          assert.equal(final.estado, "finalizada", etiqueta);
        }
      }
    });
  }
});
