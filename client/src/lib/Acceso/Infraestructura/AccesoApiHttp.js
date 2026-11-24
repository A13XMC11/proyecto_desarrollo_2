import { pedir } from "../../../Infraestructura/http/clienteHttp";

// API del estudiante: la identidad es la sesión que abre el código del curso (cookie HttpOnly).
// jugable/intento/pista tienen la misma forma que PartidaApiHttp para reutilizar el motor del juego.
export const AccesoApiHttp = {
  ingresar: (datos) => pedir("/estudiante/ingresar", { metodo: "POST", cuerpo: datos }),
  salir: () => pedir("/estudiante/salir", { metodo: "POST" }),
  yo: () => pedir("/estudiante/yo"),
  juegos: () => pedir("/estudiante/juegos"),
  iniciar: (datos) => pedir("/estudiante/partidas", { metodo: "POST", cuerpo: datos }),
  jugable: (id) => pedir(`/estudiante/partidas/${id}/jugable`),
  intento: (id, datos) => pedir(`/estudiante/partidas/${id}/intentos`, { metodo: "POST", cuerpo: datos }),
  pista: (id, datos) => pedir(`/estudiante/partidas/${id}/pistas`, { metodo: "POST", cuerpo: datos })
};
