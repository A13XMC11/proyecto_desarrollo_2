import { pedir } from "../../../Infraestructura/http/clienteHttp";

export const GeneracionApiHttp = {
  // La clave viaja en Idempotency-Key: reintentar o hacer doble clic no crea otra solicitud
  solicitar: (clave, datos) =>
    pedir("/generaciones", { metodo: "POST", cuerpo: datos, cabeceras: { "Idempotency-Key": clave } }),
  listar: (filtros = {}) => pedir("/generaciones", { consulta: filtros }),
  cancelar: (id) => pedir(`/generaciones/${id}`, { metodo: "DELETE" }),
  cuotas: () => pedir("/cuotas")
};
