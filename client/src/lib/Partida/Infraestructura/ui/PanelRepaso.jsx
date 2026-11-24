import { Lightbulb, Sparkles } from "lucide-react";
import { Boton, BotonEnlace, Insignia, MensajeError, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { HABILIDADES } from "../../../Juego/Dominio/ValoresPermitidos";
import { fraccion } from "../../Dominio/Indicadores";
import { mensajeDeRecomendacion } from "../../Dominio/MensajesRepaso";
import { enlaceRefuerzo, habilidadesParaReforzar } from "../../Dominio/Refuerzo";

const nombreHabilidad = (clave) => HABILIDADES[clave]?.texto || clave;

// Texto que redactó la IA con esas mismas cifras; las cifras de arriba siguen siendo lo que manda
const Recomendacion = ({ datos }) => (
  <Tarjeta className="mt-3">
    <h3 className="mb-2 flex items-center gap-2 font-bold"><Sparkles className="size-4 text-marca-600" aria-hidden="true" /> Recomendación de la IA</h3>
    <p className="mb-2">{datos.resumen}</p>
    <ul className="list-disc space-y-1 pl-5">
      {datos.sugerencias.map((s) => <li key={s}>{s}</li>)}
    </ul>
    <p className="mt-3 text-sm text-tenue">Es una sugerencia redactada por IA: revísala con tu criterio. Te quedan {datos.cupoRestante} {datos.cupoRestante === 1 ? "recomendación" : "recomendaciones"} este mes.</p>
  </Tarjeta>
);

// Sugerencia de repaso para el docente. Es descriptiva: siempre muestra las cifras que la respaldan.
// iaHabilitada: el servidor tiene la recomendación con IA encendida. Con ella se pide el texto y se ofrece crear refuerzos.
export const PanelRepaso = ({ repaso, cursoId, iaHabilitada = false, recomendacion = {}, onRecomendar }) => {
  const aRepasar = repaso.habilidades.filter((h) => h.repasar);
  const refuerzos = habilidadesParaReforzar(repaso);

  return (
    <section aria-labelledby="titulo-repaso" className="mb-8 rounded-2xl border border-marca-200 bg-marca-50/40 p-5">
      <h2 id="titulo-repaso" className="mb-1 flex items-center gap-2 text-lg font-extrabold">
        <Lightbulb className="size-5 text-marca-600" aria-hidden="true" /> Qué conviene repasar
      </h2>

      {!repaso.suficiente ? (
        <p className="text-tenue">
          Todavía hay pocas respuestas para sugerir algo ({repaso.respondidos} en {repaso.partidas} {repaso.partidas === 1 ? "partida terminada" : "partidas terminadas"}). Cuando se jueguen más actividades, aquí aparecerá la sugerencia.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-tenue">
            Se cuentan los ejercicios que no se acertaron al primer intento, en {repaso.partidas} {repaso.partidas === 1 ? "partida terminada" : "partidas terminadas"}.
          </p>

          {aRepasar.length === 0 ? (
            <p className="mb-4 font-medium">Ninguna habilidad destaca por su dificultad. Puedes seguir con nuevas actividades.</p>
          ) : (
            <p className="mb-4 font-medium">
              Conviene repasar: {aRepasar.map((h) => nombreHabilidad(h.habilidad)).join(", ")}.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <Tarjeta>
              <h3 className="mb-2 font-bold">Por habilidad</h3>
              <ul className="grid gap-2">
                {repaso.habilidades.map((h) => (
                  <li key={h.habilidad} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {nombreHabilidad(h.habilidad)}
                      <span className="block text-sm text-tenue tabular-nums">
                        No acertaron al primer intento: {fraccion(h.falloPrimerIntento, h.respondidos)}
                        {h.sinResolver > 0 && ` · sin resolver: ${h.sinResolver}`}
                      </span>
                    </span>
                    {h.repasar ? <Insignia tono="ambar">Repasar</Insignia> : <Insignia tono="gris">Sin alerta</Insignia>}
                  </li>
                ))}
              </ul>
            </Tarjeta>

            <Tarjeta>
              <h3 className="mb-2 font-bold">Palabras que más se les dificultan</h3>
              {repaso.palabras.length === 0 ? (
                <p className="text-sm text-tenue">Ninguna palabra se repite lo suficiente entre las respuestas como para destacar.</p>
              ) : (
                <ul className="grid gap-2">
                  {repaso.palabras.map((p) => (
                    <li key={`${p.habilidad}-${p.objetivo}`}>
                      <span className="font-medium">{p.objetivo}</span>
                      <span className="block text-sm text-tenue tabular-nums">
                        {nombreHabilidad(p.habilidad)} · no acertaron al primer intento: {fraccion(p.falloPrimerIntento, p.respondidos)}
                        {p.estudiantes > 1 && ` · ${p.estudiantes} estudiantes`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          </div>

          {recomendacion.datos && <Recomendacion datos={recomendacion.datos} />}
          {recomendacion.error && (
            <div className="mt-3"><MensajeError error={{ message: mensajeDeRecomendacion(recomendacion.error) }} alReintentar={iaHabilitada ? onRecomendar : undefined} /></div>
          )}

          {(iaHabilitada || refuerzos.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {iaHabilitada && (
                <Boton variante="secundario" cargando={recomendacion.enviando} onClick={onRecomendar}>
                  <Sparkles className="size-5" aria-hidden="true" /> {recomendacion.datos ? "Redactar de nuevo" : "Redactar recomendación con IA"}
                </Boton>
              )}
              {refuerzos.map((h) => (
                <BotonEnlace key={h} variante="fantasma" to={enlaceRefuerzo({ habilidad: h, palabras: repaso.palabras, cursoId })}>
                  Crear refuerzo: {nombreHabilidad(h)}
                </BotonEnlace>
              ))}
            </div>
          )}
          {iaHabilitada && <p className="mt-2 text-sm text-tenue">A la IA solo se envían las cifras de arriba, sin nombres. Cada recomendación usa una de tu cupo mensual; crear un refuerzo usa tu cupo diario de actividades.</p>}
        </>
      )}
    </section>
  );
};
