import { pedir } from "../../../Infraestructura/http/clienteHttp";

export const JuegoApiHttp = {
  listar: (filtros = {}) => pedir("/juegos", { consulta: filtros }),
  obtener: (id) => pedir(`/juegos/${id}`),
  crear: (datos) => pedir("/juegos", { metodo: "POST", cuerpo: datos }),
  actualizar: (id, cambios) => pedir(`/juegos/${id}`, { metodo: "PUT", cuerpo: cambios }),
  archivar: (id) => pedir(`/juegos/${id}`, { metodo: "DELETE" }),
  desarchivar: (id) => pedir(`/juegos/${id}/desarchivar`, { metodo: "POST" }),

  recursos: (tematica) => pedir("/recursos", { consulta: { tematica } }),

  listarVersiones: (juegoId) => pedir(`/juegos/${juegoId}/versiones`),
  crearVersion: (juegoId, datos) => pedir(`/juegos/${juegoId}/versiones`, { metodo: "POST", cuerpo: datos }),
  actualizarVersion: (juegoId, id, ejercicios) =>
    pedir(`/juegos/${juegoId}/versiones/${id}`, { metodo: "PUT", cuerpo: { ejercicios } }),
  aprobarVersion: (juegoId, id) => pedir(`/juegos/${juegoId}/versiones/${id}/aprobar`, { metodo: "POST" }),
  descartarVersion: (juegoId, id) => pedir(`/juegos/${juegoId}/versiones/${id}`, { metodo: "DELETE" })
};
