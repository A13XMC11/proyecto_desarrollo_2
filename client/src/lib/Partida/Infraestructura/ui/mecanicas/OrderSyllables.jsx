import { useEffect, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Boton } from "../../../../../Infraestructura/ui/componentes";

// Mecánica "ordenar sílabas" solo con toques (sin arrastrar): tocar una pieza la pone en la palabra,
// tocarla en la palabra la devuelve. El servidor decide si el orden es correcto.
const Pieza = ({ texto, alTocar, deshabilitada, tono = "normal", etiqueta }) => (
  <button
    type="button"
    onClick={alTocar}
    disabled={deshabilitada}
    aria-label={etiqueta}
    className={`min-h-16 min-w-20 cursor-pointer rounded-2xl px-5 font-titulo text-3xl font-black transition-[scale,background-color] duration-150 ease-[var(--ease-salida)] active:scale-[0.97] disabled:cursor-default sm:min-h-20 sm:text-4xl ${
      tono === "exito"
        ? "bg-exito-suave text-exito ring-4 ring-exito"
        : tono === "error"
          ? "bg-error-suave text-error ring-4 ring-error"
          : "bg-white text-marca-800 shadow-[0_5px_0_var(--color-marca-200)] ring-2 ring-marca-200 hover:bg-marca-50"
    }`}
  >
    {texto}
  </button>
);

export const OrderSyllables = ({ ejercicio, resultado, bloqueado, alEnviar }) => {
  const [orden, setOrden] = useState([]);

  // Nuevo ejercicio o reintento: se vacía la palabra
  useEffect(() => {
    if (!resultado) setOrden([]);
  }, [ejercicio.id, resultado]);

  const solucion = resultado?.solucion || ejercicio.solucion;
  const mostrado = solucion || orden;
  const disponibles = ejercicio.piezas.filter((p) => !mostrado.includes(p.id));
  const texto = (id) => ejercicio.piezas.find((p) => p.id === id)?.texto;
  const tonoRespuesta = solucion ? "exito" : resultado ? (resultado.esCorrecto ? "exito" : "error") : "normal";

  return (
    <div className="grid gap-6">
      <div
        className={`flex min-h-24 flex-wrap items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-4 sm:min-h-28 ${
          resultado && !resultado.esCorrecto && !solucion ? "animate-sacudir border-error" : "border-marca-200 bg-marca-50/50"
        }`}
        aria-label="Tu palabra"
        aria-live="polite"
      >
        {mostrado.length === 0 ? (
          <p className="text-lg text-tenue">Toca las sílabas en orden</p>
        ) : (
          mostrado.map((id, i) => (
            <Pieza
              key={id}
              texto={texto(id)}
              tono={tonoRespuesta}
              deshabilitada={bloqueado || Boolean(resultado)}
              etiqueta={`${texto(id)}, posición ${i + 1}. Toca para quitarla`}
              alTocar={() => setOrden((o) => o.filter((x) => x !== id))}
            />
          ))
        )}
      </div>

      {!resultado && (
        <>
          <div className="flex min-h-20 flex-wrap justify-center gap-3" aria-label="Sílabas disponibles">
            {disponibles.map((p) => (
              <Pieza key={p.id} texto={p.texto} deshabilitada={bloqueado} etiqueta={`Agregar ${p.texto}`} alTocar={() => setOrden((o) => [...o, p.id])} />
            ))}
          </div>
          <div className="flex justify-center gap-3">
            <Boton variante="secundario" tamano="lg" disabled={!orden.length || bloqueado} onClick={() => setOrden([])}>
              <RotateCcw className="size-5" aria-hidden="true" /> Empezar de nuevo
            </Boton>
            <Boton tamano="lg" disabled={orden.length !== ejercicio.piezas.length || bloqueado} cargando={bloqueado && orden.length === ejercicio.piezas.length} onClick={() => alEnviar(orden)}>
              <Check className="size-5" aria-hidden="true" /> Comprobar
            </Boton>
          </div>
        </>
      )}
    </div>
  );
};
