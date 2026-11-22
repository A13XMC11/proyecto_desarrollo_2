import { Check, X } from "lucide-react";

// Mecánica "elegir la respuesta". No sabe cuál es la correcta: pinta lo que el servidor respondió.
// El acierto/fallo se marca con color, icono y texto, nunca solo con color.
export const SelectOption = ({ ejercicio, resultado, bloqueado, alElegir }) => {
  const solucion = resultado?.solucion || ejercicio.solucion;
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-5" role="group" aria-label="Opciones">
      {ejercicio.opciones.map((opcion) => {
        const elegida = resultado?.eleccion === opcion.id;
        const correcta = (elegida && resultado?.esCorrecto) || solucion === opcion.id;
        const incorrecta = elegida && !resultado?.esCorrecto;
        return (
          <button
            key={opcion.id}
            type="button"
            disabled={bloqueado}
            onClick={() => alElegir(opcion.id)}
            aria-label={`${opcion.texto}${correcta ? ", correcta" : incorrecta ? ", incorrecta" : ""}`}
            className={`relative grid aspect-square max-h-48 cursor-pointer place-items-center rounded-3xl font-titulo font-black transition-[scale,background-color] duration-150 ease-[var(--ease-salida)] active:scale-[0.97] disabled:cursor-default ${
              // Una vocal o un número caben en grande; una sílaba de 3 letras necesita menos tamaño para no salirse del botón
              opcion.texto.length > 2 ? "text-4xl sm:text-6xl" : "text-6xl sm:text-7xl"
            } ${
              correcta
                ? "animate-acierto bg-exito-suave text-exito ring-4 ring-exito"
                : incorrecta
                  ? "animate-sacudir bg-error-suave text-error ring-4 ring-error"
                  : "bg-white text-marca-800 shadow-[0_6px_0_var(--color-marca-200)] ring-2 ring-marca-200 hover:bg-marca-50"
            }`}
          >
            {opcion.texto}
            {correcta && <Check className="absolute right-3 top-3 size-7" strokeWidth={3} aria-hidden="true" />}
            {incorrecta && <X className="absolute right-3 top-3 size-7" strokeWidth={3} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
};
