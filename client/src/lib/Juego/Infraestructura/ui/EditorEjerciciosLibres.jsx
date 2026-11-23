import { useState } from "react";
import { ImageOff, Palette, Sparkles } from "lucide-react";
import { Boton, Campo, Selector } from "../../../../Infraestructura/ui/componentes";
import { CATEGORIAS_ICONOS } from "../../Dominio/ValoresPermitidos";
import { iconosDe } from "../../Dominio/EjerciciosLibres";

// Elegir otro icono de la lista cerrada que entrega el servidor (el servidor vuelve a comprobarlo al guardar).
// Cada icono es un botón grande con su propio nombre accesible.
const SelectorIcono = ({ valor, categorias, alElegir, idEjercicio }) => {
  const [abierto, setAbierto] = useState(false);
  const [categoria, setCategoria] = useState("");
  const clave = categoria || categorias?.[0]?.clave || "";
  const iconos = iconosDe(categorias, clave);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" tamano="sm" aria-expanded={abierto} aria-controls={`iconos-${idEjercicio}`} onClick={() => setAbierto((a) => !a)}>
          <Palette className="size-4" aria-hidden="true" /> {abierto ? "Cerrar la lista de iconos" : valor ? "Elegir otro icono" : "Elegir un icono"}
        </Boton>
        {valor && (
          <Boton variante="fantasma" tamano="sm" onClick={() => alElegir("")}>
            <ImageOff className="size-4" aria-hidden="true" /> Quitar el icono
          </Boton>
        )}
      </div>
      {abierto && (
        <div id={`iconos-${idEjercicio}`} className="mt-3 rounded-2xl border border-borde bg-slate-50 p-3">
          {categorias?.length ? (
            <>
              <Selector
                etiqueta="Tipo de icono"
                value={clave}
                onChange={(e) => setCategoria(e.target.value)}
                opciones={categorias.map((c) => ({ valor: c.clave, texto: CATEGORIAS_ICONOS[c.clave] || c.clave }))}
              />
              <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Iconos de ${CATEGORIAS_ICONOS[clave] || clave}`}>
                {iconos.map((icono) => (
                  <li key={icono}>
                    <button
                      type="button"
                      aria-label={`Icono ${icono}`}
                      aria-pressed={icono === valor}
                      onClick={() => { alElegir(icono); setAbierto(false); }}
                      className={`grid size-12 cursor-pointer place-items-center rounded-xl text-3xl transition-[scale,background-color] duration-150 active:scale-95 ${icono === valor ? "bg-marca-100 ring-2 ring-marca-600" : "bg-white ring-1 ring-borde hover:bg-marca-50"}`}
                    >
                      <span aria-hidden="true">{icono}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-tenue">La lista de iconos todavía no cargó. Inténtalo de nuevo en un momento.</p>
          )}
        </div>
      )}
    </div>
  );
};

// Revisión de un borrador de temática libre. La palabra, las sílabas, las opciones y la respuesta las calculó el servidor:
// aquí solo se corrigen el título, la consigna, la pista y el icono. El servidor vuelve a validar todo al guardar.
export const EditorEjerciciosLibres = ({ titulo, setTitulo, ejercicios, setEjercicios, errores = [], errorTitulo, categoriasIconos }) => {
  const cambiar = (i) => (cambios) => setEjercicios((lista) => lista.map((e, k) => (k === i ? { ...e, ...cambios } : e)));
  return (
    <div className="grid gap-4">
      <div className="flex gap-3 rounded-2xl border border-marca-200 bg-marca-50 p-4 text-marca-900">
        <Sparkles className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="grid gap-1 text-sm">
          <p className="text-base font-extrabold">Contenido generado por IA. Revísalo antes de aprobar.</p>
          <p>Puedes corregir el título, la consigna, la pista y el icono. La palabra y la respuesta correcta las calcula el sistema y no se pueden cambiar.</p>
          <p className="font-medium">Revisa que el dibujo corresponda a la palabra: el sistema solo comprueba que el icono sea seguro, no que sea el dibujo correcto.</p>
        </div>
      </div>

      <Campo etiqueta="Título de la actividad" maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} error={errorTitulo} />

      {ejercicios.map((ejercicio, i) => {
        const err = errores[i] || {};
        return (
          <section key={ejercicio.id} aria-label={`Ejercicio ${i + 1}`} className="rounded-2xl border border-borde bg-white p-5">
            <h3 className="mb-3 font-extrabold">Ejercicio {i + 1}</h3>
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl bg-slate-50 p-4">
              {ejercicio.icono ? (
                <span className="text-6xl leading-none" role="img" aria-label={`Icono de la palabra ${ejercicio.palabra}`}>{ejercicio.icono}</span>
              ) : (
                <span className="grid size-16 place-items-center rounded-2xl bg-white text-xs text-tenue ring-1 ring-borde">Sin icono</span>
              )}
              <div>
                <p className="font-titulo text-3xl font-black text-marca-900">{ejercicio.palabra}</p>
                <p className="text-sm text-tenue">
                  Palabra (no se puede cambiar) · Respuesta correcta: <strong className="text-tinta">{ejercicio.respuesta}</strong>
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo className="sm:col-span-2" etiqueta="Consigna" maxLength={140} value={ejercicio.consigna} onChange={(e) => cambiar(i)({ consigna: e.target.value })} error={err.consigna} />
              <Campo className="sm:col-span-2" etiqueta="Pista (opcional)" maxLength={100} value={ejercicio.pista} onChange={(e) => cambiar(i)({ pista: e.target.value })} error={err.pista} />
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm font-medium">Icono</p>
                <SelectorIcono idEjercicio={ejercicio.id} valor={ejercicio.icono} categorias={categoriasIconos} alElegir={(icono) => cambiar(i)({ icono })} />
                <p className="mt-2 text-sm text-tenue">Revisa que el dibujo corresponda a la palabra.</p>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
};
