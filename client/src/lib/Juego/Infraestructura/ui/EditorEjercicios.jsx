import { Plus, Trash2, Wand2 } from "lucide-react";
import { Boton, Campo } from "../../../../Infraestructura/ui/componentes";
import { ejercicioVacio, separarSilabas, sugerirOpciones } from "../../Dominio/Ejercicios";

const EjercicioOpcion = ({ ejercicio, errores, cambiar }) => {
  const sugerir = () => {
    const sugerencia = sugerirOpciones(ejercicio.palabra);
    if (sugerencia) cambiar({ opciones: sugerencia.opciones, correcta: sugerencia.correcta });
  };
  const puedeSugerir = Boolean(sugerirOpciones(ejercicio.palabra));
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Opciones (marca la correcta)</legend>
      <div className="grid grid-cols-3 gap-2">
        {ejercicio.opciones.map((texto, j) => (
          <label key={j} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${ejercicio.correcta === j ? "border-exito bg-exito-suave/50" : "border-borde"}`}>
            <input type="radio" checked={ejercicio.correcta === j} onChange={() => cambiar({ correcta: j })} className="size-4 shrink-0 accent-exito" aria-label={`Opción ${j + 1} es la correcta`} />
            <input
              value={texto}
              maxLength={40}
              onChange={(e) => cambiar({ opciones: ejercicio.opciones.map((o, k) => (k === j ? e.target.value : o)) })}
              className="min-h-9 w-full min-w-0 bg-transparent text-center font-titulo text-lg font-black uppercase focus:outline-none"
              aria-label={`Texto de la opción ${j + 1}`}
            />
          </label>
        ))}
      </div>
      {errores.opciones ? (
        <p role="alert" className="mt-1.5 text-sm text-error">{errores.opciones}</p>
      ) : (
        <button type="button" onClick={sugerir} disabled={!puedeSugerir} className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-marca-700 hover:bg-marca-50 disabled:cursor-not-allowed disabled:text-slate-400">
          <Wand2 className="size-4" aria-hidden="true" /> {puedeSugerir ? "Sugerir vocales a partir de la palabra" : "La palabra debe empezar con vocal para sugerir opciones"}
        </button>
      )}
    </fieldset>
  );
};

const EjercicioSilabas = ({ ejercicio, errores, cambiar }) => (
  <div>
    <Campo etiqueta="Sílabas en orden" value={ejercicio.silabas} onChange={(e) => cambiar({ silabas: e.target.value })} error={errores.silabas} ayuda="Sepáralas con guiones: ma-ri-po-sa" />
    {separarSilabas(ejercicio.silabas).length > 1 && !errores.silabas && (
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Vista previa de las piezas">
        {separarSilabas(ejercicio.silabas).map((s, i) => (
          <span key={i} className="rounded-lg bg-marca-50 px-2.5 py-1 font-titulo font-black text-marca-800 ring-1 ring-marca-200">{s}</span>
        ))}
      </div>
    )}
  </div>
);

export const EditorEjercicios = ({ ejercicios, setEjercicios, mecanica, cantidad, errores = [] }) => {
  const cambiar = (i) => (cambios) => setEjercicios((lista) => lista.map((e, k) => (k === i ? { ...e, ...cambios } : e)));
  const quitar = (i) => setEjercicios((lista) => lista.filter((_, k) => k !== i));

  return (
    <div className="grid gap-4">
      {ejercicios.map((ejercicio, i) => {
        const err = errores[i] || {};
        return (
          <section key={i} aria-label={`Ejercicio ${i + 1}`} className="rounded-2xl border border-borde bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-extrabold">Ejercicio {i + 1}</h3>
              <button type="button" onClick={() => quitar(i)} className="grid size-10 cursor-pointer place-items-center rounded-xl text-tenue transition-colors hover:bg-error-suave hover:text-error" aria-label={`Quitar ejercicio ${i + 1}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Palabra" maxLength={40} value={ejercicio.palabra} onChange={(e) => cambiar(i)({ palabra: e.target.value })} error={err.palabra} placeholder={mecanica === "seleccionar_opcion" ? "oso" : "gato"} />
              <Campo etiqueta="Pista (opcional)" maxLength={100} value={ejercicio.pista} onChange={(e) => cambiar(i)({ pista: e.target.value })} placeholder="Suena como cuando algo te sorprende: ¡oh!" />
              <Campo className="sm:col-span-2" etiqueta="Consigna" maxLength={140} value={ejercicio.consigna} onChange={(e) => cambiar(i)({ consigna: e.target.value })} error={err.consigna} />
              <div className="sm:col-span-2">
                {mecanica === "seleccionar_opcion" ? (
                  <EjercicioOpcion ejercicio={ejercicio} errores={err} cambiar={cambiar(i)} />
                ) : (
                  <EjercicioSilabas ejercicio={ejercicio} errores={err} cambiar={cambiar(i)} />
                )}
              </div>
            </div>
          </section>
        );
      })}
      {ejercicios.length < cantidad && (
        <Boton variante="secundario" onClick={() => setEjercicios((l) => [...l, ejercicioVacio(mecanica)])} className="border-2 border-dashed border-marca-200 ring-0">
          <Plus className="size-5" aria-hidden="true" /> Agregar ejercicio ({ejercicios.length} de {cantidad})
        </Boton>
      )}
    </div>
  );
};
