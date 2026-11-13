import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { guardarSesion, leerSesionGuardada, registrarAlExpirar } from "../../../Infraestructura/http/clienteHttp";
import { DocenteApiHttp } from "../Infraestructura/DocenteApiHttp";

const ContextoSesion = createContext(null);

// Sesión del docente. Hoy guarda la vista pública del docente y su id viaja en x-docente-id;
// cuando el servidor tenga cookie de sesión, solo cambia este archivo y clienteHttp.js.
export const ProveedorSesion = ({ children }) => {
  const [docente, setDocente] = useState(leerSesionGuardada);

  const establecer = useCallback((nuevo) => {
    guardarSesion(nuevo);
    setDocente(nuevo);
  }, []);

  useEffect(() => registrarAlExpirar(() => establecer(null)), [establecer]);

  const valor = useMemo(
    () => ({
      docente,
      ingresar: async (credenciales) => establecer(await DocenteApiHttp.iniciarSesion(credenciales)),
      registrar: async (datos) => establecer(await DocenteApiHttp.registrar(datos)),
      actualizar: async (cambios) => establecer(await DocenteApiHttp.actualizar(docente.id, cambios)),
      salir: () => establecer(null)
    }),
    [docente, establecer]
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
};

export const useSesion = () => useContext(ContextoSesion);
