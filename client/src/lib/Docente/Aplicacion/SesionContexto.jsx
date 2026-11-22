import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { guardarSesion, leerSesionGuardada, registrarAlExpirar } from "../../../Infraestructura/http/clienteHttp";
import { DocenteApiHttp } from "../Infraestructura/DocenteApiHttp";

const ContextoSesion = createContext(null);

// Sesión del docente. La identidad es la cookie HttpOnly del servidor; aquí se guarda solo la vista pública
// del docente para pintar el panel sin esperar. Al cargar la app se confirma con el servidor: si la sesión
// expiró o se cerró en otro lado, se olvida y las páginas privadas llevan a /ingresar.
export const ProveedorSesion = ({ children }) => {
  const [docente, setDocente] = useState(leerSesionGuardada);

  const establecer = useCallback((nuevo) => {
    guardarSesion(nuevo);
    setDocente(nuevo);
  }, []);

  useEffect(() => registrarAlExpirar(() => establecer(null)), [establecer]);

  // Recuperar la sesión al recargar (y con ella el token CSRF). Si este navegador no tenía a nadie,
  // no se pregunta: la portada no necesita una petición que solo respondería 401.
  useEffect(() => {
    if (!leerSesionGuardada()) return undefined;
    let vigente = true;
    DocenteApiHttp.sesionActual()
      .then((actual) => vigente && establecer(actual))
      .catch((error) => {
        // Sin conexión no se sabe: se conserva lo guardado. Un 401 significa que no hay sesión.
        if (vigente && error.estado === 401) establecer(null);
      });
    return () => {
      vigente = false;
    };
  }, [establecer]);

  const valor = useMemo(
    () => ({
      docente,
      ingresar: async (credenciales) => establecer(await DocenteApiHttp.iniciarSesion(credenciales)),
      registrar: async (datos) => establecer(await DocenteApiHttp.registrar(datos)),
      actualizar: async (cambios) => establecer(await DocenteApiHttp.actualizar(docente.id, cambios)),
      // Revoca la sesión en el servidor; aunque falle la red, en este navegador se sale igual
      salir: async () => {
        try {
          await DocenteApiHttp.cerrarSesion();
        } catch {
          /* la cookie caduca sola; lo importante es no seguir mostrando el panel */
        }
        establecer(null);
      }
    }),
    [docente, establecer]
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
};

export const useSesion = () => useContext(ContextoSesion);
