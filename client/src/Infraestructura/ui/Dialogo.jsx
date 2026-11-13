import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// <dialog> nativo: foco atrapado, Escape y fondo gratis. La entrada y salida están en index.css.
export const Dialogo = ({ abierto, alCerrar, titulo, children, ancho = "max-w-lg" }) => {
  const ref = useRef(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      onClick={(e) => e.target === ref.current && alCerrar()}
      className={`dialogo m-auto w-[calc(100%-2rem)] ${ancho} rounded-3xl bg-white p-0 text-tinta shadow-2xl`}
      aria-labelledby="dialogo-titulo"
    >
      {abierto && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id="dialogo-titulo" className="text-xl font-extrabold">{titulo}</h2>
            <button
              type="button"
              onClick={alCerrar}
              className="-m-2 grid size-11 cursor-pointer place-items-center rounded-xl text-tenue transition-colors hover:bg-slate-100"
              aria-label="Cerrar"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
};
