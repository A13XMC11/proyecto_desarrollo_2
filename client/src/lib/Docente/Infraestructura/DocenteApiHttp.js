import { pedir } from "../../../Infraestructura/http/clienteHttp";

export const DocenteApiHttp = {
  // Registrarse y entrar dejan la sesión abierta (cookie HttpOnly)
  registrar: (datos) => pedir("/docentes", { metodo: "POST", cuerpo: datos }),
  iniciarSesion: (datos) => pedir("/docentes/sesion", { metodo: "POST", cuerpo: datos }),
  sesionActual: () => pedir("/docentes/sesion"),
  cerrarSesion: () => pedir("/docentes/sesion", { metodo: "DELETE" }),
  obtener: (id) => pedir(`/docentes/${id}`),
  actualizar: (id, cambios) => pedir(`/docentes/${id}`, { metodo: "PUT", cuerpo: cambios })
};
