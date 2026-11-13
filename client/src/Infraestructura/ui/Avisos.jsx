import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

const ContextoAvisos = createContext(() => {});

// Avisos breves (4 s). Se anuncian con aria-live sin robar el foco; el temporizador se pausa
// si la pestaña está oculta, para que el aviso no desaparezca sin que nadie lo vea.
export const ProveedorAvisos = ({ children }) => {
  const [avisos, setAvisos] = useState([]);
  const siguienteId = useRef(0);

  const avisar = useCallback((texto, tipo = "exito") => {
    const id = ++siguienteId.current;
    setAvisos((lista) => [...lista.slice(-2), { id, texto, tipo }]);
  }, []);

  const quitar = useCallback((id) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end">
        {avisos.map((aviso) => (
          <Aviso key={aviso.id} aviso={aviso} alTerminar={quitar} />
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
};

const Aviso = ({ aviso, alTerminar }) => {
  useEffect(() => {
    let restante = 4000;
    let inicio = Date.now();
    let temporizador = setTimeout(() => alTerminar(aviso.id), restante);
    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        clearTimeout(temporizador);
        restante -= Date.now() - inicio;
      } else {
        inicio = Date.now();
        temporizador = setTimeout(() => alTerminar(aviso.id), restante);
      }
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [aviso.id, alTerminar]);

  const Icono = aviso.tipo === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className="aviso pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-tinta px-4 py-3 text-sm text-white shadow-xl">
      <Icono className={`size-5 shrink-0 ${aviso.tipo === "error" ? "text-red-300" : "text-green-300"}`} aria-hidden="true" />
      {aviso.texto}
    </div>
  );
};

export const useAvisos = () => useContext(ContextoAvisos);
