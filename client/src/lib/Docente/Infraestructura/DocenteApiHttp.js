import { pedir } from "../../../Infraestructura/http/clienteHttp";

export const DocenteApiHttp = {
  registrar: (datos) => pedir("/docentes", { metodo: "POST", cuerpo: datos }),
  iniciarSesion: (datos) => pedir("/docentes/sesion", { metodo: "POST", cuerpo: datos }),
  obtener: (id) => pedir(`/docentes/${id}`),
  actualizar: (id, cambios) => pedir(`/docentes/${id}`, { metodo: "PUT", cuerpo: cambios })
};
