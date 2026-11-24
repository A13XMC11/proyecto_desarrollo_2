import { pedir } from "../../../Infraestructura/http/clienteHttp";

export const AulaApiHttp = {
  listarCursos: ({ archivado } = {}) => pedir("/cursos", { consulta: { archivado } }),
  crearCurso: (datos) => pedir("/cursos", { metodo: "POST", cuerpo: datos }),
  actualizarCurso: (id, cambios) => pedir(`/cursos/${id}`, { metodo: "PUT", cuerpo: cambios }),
  archivarCurso: (id) => pedir(`/cursos/${id}`, { metodo: "DELETE" }),
  // Acceso de estudiantes: abrir o cambiar el código del curso / cerrarlo. Ambos devuelven el curso.
  abrirAcceso: (id) => pedir(`/cursos/${id}/codigo-acceso`, { metodo: "POST" }),
  cerrarAcceso: (id) => pedir(`/cursos/${id}/codigo-acceso`, { metodo: "DELETE" }),

  listarEstudiantes: ({ cursoId, archivado } = {}) => pedir("/estudiantes", { consulta: { cursoId, archivado } }),
  crearEstudiante: (datos) => pedir("/estudiantes", { metodo: "POST", cuerpo: datos }),
  actualizarEstudiante: (id, cambios) => pedir(`/estudiantes/${id}`, { metodo: "PUT", cuerpo: cambios }),
  archivarEstudiante: (id) => pedir(`/estudiantes/${id}`, { metodo: "DELETE" })
};
