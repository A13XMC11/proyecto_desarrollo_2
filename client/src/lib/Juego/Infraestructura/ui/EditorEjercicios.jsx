import { Plus, Trash2, Wand2 } from "lucide-react";
import { Boton, Campo, Selector } from "../../../../Infraestructura/ui/componentes";
import { ejercicioVacio, recursosPara, sugerirSegunHabilidad, usaOpciones } from "../../Dominio/Ejercicios";

const TEXTO_SUGERIR = {
  vocales: "Sugerir vocales a partir de la palabra",
  completar_silaba: "Sugerir opciones para la sílaba que falta",
  contar_silabas: "Sugerir números a partir de la palabra"
};

const EjercicioOpcion = ({ ejercicio, recurso, recursos, habilidad, errores, cambiar }) => {
  const propuesta = () => sugerirSegunHabilidad(habilidad, recurso, { indice: ejercicio.indice, recursos });
  const sugerir = () => {
    const sugerencia = propuesta();
    if (sugerencia) cambiar({ opciones: sugerencia.opciones, correcta: sugerencia.correcta });
  };
  const puedeSugerir = Boolean(propuesta());
  // Las vocales se escriben en mayúscula; las sílabas y los números, tal cual
  const mayusculas = habilidad === "vocales" ? "uppercase" : "";
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
              className={`min-h-9 w-full min-w-0 bg-transparent text-center font-titulo text-lg font-black ${mayusculas} focus:outline-none`}
              aria-label={`Texto de la opción ${j + 1}`}
            />
          </label>
        ))}
      </div>
      {errores.opciones ? (
        <p role="alert" className="mt-1.5 text-sm text-error">{errores.opciones}</p>
      ) : (
        <button type="button" onClick={sugerir} disabled={!puedeSugerir} className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-marca-700 hover:bg-marca-50 disabled:cursor-not-allowed disabled:text-slate-400">
          <Wand2 className="size-4" aria-hidden="true" /> {puedeSugerir ? TEXTO_SUGERIR[habilidad] : "Elige una palabra para sugerir las opciones"}
        </button>
      )}
    </fieldset>
  );
};

// Completar sílaba: el docente elige cuál de las sílabas aprobadas de la palabra queda oculta
const SilabaQueFalta = ({ recurso, indice, alCambiar }) => (
  <Selector
    etiqueta="Sílaba que falta"
    value={String(indice)}
    onChange={(e) => alCambiar(Number(e.target.value))}
    disabled={!recurso}
    opciones={recurso
      ? recurso.silabas.map((s, i) => ({ valor: String(i), texto: `${i + 1}.ª sílaba: ${s}` }))
      : [{ valor: "0", texto: "Elige primero la palabra" }]}
    ayuda={recurso ? `Se verá: ${recurso.silabas.map((s, i) => (i === indice ? "＿＿" : s)).join(" ")}` : undefined}
  />
);

// Las sílabas vienen del catálogo (división aprobada): solo se muestran, no se escriben
const EjercicioSilabas = ({ recurso }) => (
  <div>
    <p className="mb-2 text-sm font-medium">Sílabas en orden</p>
    {recurso ? (
      <div className="flex flex-wrap gap-1.5" aria-label="Sílabas de la palabra">
        {recurso.silabas.map((silaba, i) => (
          <span key={i} className="rounded-lg bg-marca-50 px-2.5 py-1 font-titulo font-black text-marca-800 ring-1 ring-marca-200">{silaba}</span>
        ))}
      </div>
    ) : (
      <p className="text-sm text-tenue">Al elegir la palabra verás sus sílabas.</p>
    )}
  </div>
);

export const EditorEjercicios = ({ ejercicios, setEjercicios, habilidad, cantidad, errores = [], recursos = [] }) => {
  const disponibles = recursosPara(recursos, habilidad);
  const cambiar = (i) => (cambios) => setEjercicios((lista) => lista.map((e, k) => (k === i ? { ...e, ...cambios } : e)));
  // Al elegir la palabra se proponen de una vez las tres opciones (y el hueco vuelve a la primera sílaba)
  const elegirRecurso = (i) => (e) => {
    const recurso = recursos.find((r) => r.id === e.target.value);
    const sugerencia = sugerirSegunHabilidad(habilidad, recurso, { indice: 0, recursos });
    cambiar(i)({ recursoId: e.target.value, ...(habilidad === "completar_silaba" && { indice: 0 }), ...(sugerencia && { opciones: sugerencia.opciones, correcta: sugerencia.correcta }) });
  };
  // Al cambiar la sílaba oculta, las opciones se rehacen para que la correcta siga siendo la que falta
  const elegirHueco = (i, recurso) => (indice) => {
    const sugerencia = sugerirSegunHabilidad(habilidad, recurso, { indice, recursos });
    cambiar(i)({ indice, ...(sugerencia && { opciones: sugerencia.opciones, correcta: sugerencia.correcta }) });
  };
  const quitar = (i) => setEjercicios((lista) => lista.filter((_, k) => k !== i));

  return (
    <div className="grid gap-4">
      {ejercicios.map((ejercicio, i) => {
        const err = errores[i] || {};
        const recurso = recursos.find((r) => r.id === ejercicio.recursoId);
        return (
          <section key={i} aria-label={`Ejercicio ${i + 1}`} className="rounded-2xl border border-borde bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-extrabold">Ejercicio {i + 1}</h3>
              <button type="button" onClick={() => quitar(i)} className="grid size-10 cursor-pointer place-items-center rounded-xl text-tenue transition-colors hover:bg-error-suave hover:text-error" aria-label={`Quitar ejercicio ${i + 1}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Selector
                etiqueta="Palabra del catálogo"
                value={ejercicio.recursoId}
                onChange={elegirRecurso(i)}
                error={err.recursoId}
                opciones={[
                  { valor: "", texto: "Elige una palabra…" },
                  // Una palabra heredada que ya no está disponible se muestra para poder cambiarla, no se pierde en silencio
                  ...(ejercicio.recursoId && !recurso ? [{ valor: ejercicio.recursoId, texto: `${ejercicio.recursoId} (no disponible)` }] : []),
                  ...disponibles.map((r) => ({ valor: r.id, texto: r.icono ? `${r.icono} ${r.palabra}` : r.palabra }))
                ]}
              />
              <Campo etiqueta="Pista (opcional)" maxLength={100} value={ejercicio.pista} onChange={(e) => cambiar(i)({ pista: e.target.value })} placeholder="Suena como cuando algo te sorprende: ¡oh!" />
              <Campo className="sm:col-span-2" etiqueta="Consigna" maxLength={140} value={ejercicio.consigna} onChange={(e) => cambiar(i)({ consigna: e.target.value })} error={err.consigna} />
              {habilidad === "completar_silaba" && (
                <div className="sm:col-span-2">
                  <SilabaQueFalta recurso={recurso} indice={ejercicio.indice ?? 0} alCambiar={elegirHueco(i, recurso)} />
                </div>
              )}
              <div className="sm:col-span-2">
                {usaOpciones(habilidad) ? (
                  <EjercicioOpcion ejercicio={ejercicio} recurso={recurso} recursos={recursos} habilidad={habilidad} errores={err} cambiar={cambiar(i)} />
                ) : (
                  <EjercicioSilabas recurso={recurso} />
                )}
              </div>
            </div>
          </section>
        );
      })}
      {ejercicios.length < cantidad && (
        <Boton variante="secundario" onClick={() => setEjercicios((l) => [...l, ejercicioVacio(habilidad)])} className="border-2 border-dashed border-marca-200 ring-0">
          <Plus className="size-5" aria-hidden="true" /> Agregar ejercicio ({ejercicios.length} de {cantidad})
        </Boton>
      )}
    </div>
  );
};
