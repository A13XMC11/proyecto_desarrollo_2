import { Lightbulb } from "lucide-react";
import { Insignia, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { HABILIDADES } from "../../../Juego/Dominio/ValoresPermitidos";
import { fraccion } from "../../Dominio/Indicadores";

const nombreHabilidad = (clave) => HABILIDADES[clave]?.texto || clave;

// Sugerencia de repaso para el docente. Es descriptiva: siempre muestra las cifras que la respaldan.
export const PanelRepaso = ({ repaso }) => {
  const aRepasar = repaso.habilidades.filter((h) => h.repasar);

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
        </>
      )}
    </section>
  );
};
