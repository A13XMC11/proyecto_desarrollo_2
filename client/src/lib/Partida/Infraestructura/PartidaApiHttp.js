import { pedir } from "../../../Infraestructura/http/clienteHttp";

export const PartidaApiHttp = {
  iniciar: (datos) => pedir("/partidas", { metodo: "POST", cuerpo: datos }),
  listar: (filtros = {}) => pedir("/partidas", { consulta: filtros }),
  // Indicadores calculados en el servidor: { resumen, porEstudiante, porHabilidad, partidas }
  resultados: (filtros = {}) => pedir("/resultados", { consulta: filtros }),
  // Sugerencia de repaso: { suficiente, partidas, respondidos, habilidades, palabras }, con los mismos filtros
  repaso: (filtros = {}) => pedir("/resultados/repaso", { consulta: filtros }),
  // Recomendación redactada por la IA con ese mismo análisis: gasta cupo mensual, por eso es POST. { resumen, sugerencias, cupoRestante }
  recomendacion: (filtros = {}) => pedir("/resultados/repaso/recomendacion", { metodo: "POST", cuerpo: filtros }),
  inicio: () => pedir("/inicio"),
  jugable: (id) => pedir(`/partidas/${id}/jugable`),
  intento: (id, datos) => pedir(`/partidas/${id}/intentos`, { metodo: "POST", cuerpo: datos }),
  pista: (id, datos) => pedir(`/partidas/${id}/pistas`, { metodo: "POST", cuerpo: datos }),
  abandonar: (id) => pedir(`/partidas/${id}`, { metodo: "DELETE" })
};
