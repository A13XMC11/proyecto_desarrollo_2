// Filas reales de las tablas relacionales para las pruebas que dependen de claves foráneas.
const { randomUUID } = require("node:crypto");
const Docente = require("../../../src/lib/Docente/Dominio/Entidades/Docente");
const Curso = require("../../../src/lib/Aula/Dominio/Entidades/Curso");
const Estudiante = require("../../../src/lib/Aula/Dominio/Entidades/Estudiante");
const DocenteRepo = require("../../../src/lib/Docente/Infraestructura/DocenteRepositorySequelize");
const CursoRepo = require("../../../src/lib/Aula/Infraestructura/CursoRepositorySequelize");
const EstudianteRepo = require("../../../src/lib/Aula/Infraestructura/EstudianteRepositorySequelize");

const docentes = new DocenteRepo();
const cursos = new CursoRepo();
const estudiantes = new EstudianteRepo();

let contador = 0;
const siguiente = () => String(++contador).padStart(4, "0");

async function crearDocente() {
  return docentes.save(new Docente({ nombre: "Docente Prueba", correo: `d${randomUUID()}@x.ec`, hash: "hash-de-prueba" }));
}

async function crearCurso(docenteId, extra = {}) {
  return cursos.save(new Curso({ docenteId, grado: "1.º EGB", paralelo: "A", anioLectivo: "2026-2027", ...extra }));
}

async function crearEstudiante(cursoId, extra = {}) {
  return estudiantes.save(new Estudiante({ cursoId, codigoLista: `E${siguiente()}`, franjaEdad: 6, avatarId: "gato", ...extra }));
}

// Docente con un curso y un estudiante, listos para colgar generaciones.
async function crearEscenario() {
  const docente = await crearDocente();
  const curso = await crearCurso(docente.id);
  const estudiante = await crearEstudiante(curso.id);
  return { docente, curso, estudiante, docenteId: docente.id, cursoId: curso.id, estudianteId: estudiante.id };
}

module.exports = { crearDocente, crearCurso, crearEstudiante, crearEscenario };
