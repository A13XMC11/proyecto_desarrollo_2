import { useCallback, useEffect, useRef, useState } from "react";

// Carga datos con estados de carga y error, y permite recargar. Ignora respuestas viejas
// si las dependencias cambian antes de que termine la anterior.
export const useConsulta = (funcion, dependencias = []) => {
  const [estado, setEstado] = useState({ datos: undefined, cargando: true, error: null });
  const turno = useRef(0);

  const cargar = useCallback(async () => {
    const actual = ++turno.current;
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));
    try {
      const datos = await funcion();
      if (actual === turno.current) setEstado({ datos, cargando: false, error: null });
    } catch (error) {
      if (actual === turno.current) setEstado((previo) => ({ ...previo, cargando: false, error }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { ...estado, recargar: cargar };
};

// Ejecuta una acción (guardar, archivar...) con estado de envío; evita dobles clics
export const useAccion = (funcion) => {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const enCurso = useRef(false);

  const ejecutar = useCallback(
    async (...args) => {
      if (enCurso.current) return undefined;
      enCurso.current = true;
      setEnviando(true);
      setError(null);
      try {
        return await funcion(...args);
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        enCurso.current = false;
        setEnviando(false);
      }
    },
    [funcion]
  );

  return { ejecutar, enviando, error, limpiarError: () => setError(null) };
};
