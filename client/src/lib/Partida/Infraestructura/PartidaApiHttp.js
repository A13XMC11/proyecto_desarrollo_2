import { pedir } from "../../../Infraestructura/http/clienteHttp";

export const PartidaApiHttp = {
  iniciar: (datos) => pedir("/partidas", { metodo: "POST", cuerpo: datos }),
  listar: (filtros = {}) => pedir("/partidas", { consulta: filtros }),
  // Indicadores calculados en el servidor: { resumen, porEstudiante, porHabilidad, partidas }
  resultados: (filtros = {}) => pedir("/resultados", { consulta: filtros }),
  inicio: () => pedir("/inicio"),
  jugable: (id) => pedir(`/partidas/${id}/jugable`),
  intento: (id, datos) => pedir(`/partidas/${id}/intentos`, { metodo: "POST", cuerpo: datos }),
  pista: (id, datos) => pedir(`/partidas/${id}/pistas`, { metodo: "POST", cuerpo: datos }),
  abandonar: (id) => pedir(`/partidas/${id}`, { metodo: "DELETE" })
};
