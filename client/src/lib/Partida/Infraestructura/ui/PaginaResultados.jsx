import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BarChart3, Lightbulb, Play } from "lucide-react";
import { Boton, BotonEnlace, Cargando, Encabezado, EstadoVacio, Insignia, MensajeError, Selector, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { useAccion, useConsulta } from "../../../../Infraestructura/http/useConsulta";
import { useCursos, useEstudiantes } from "../../../Aula/Aplicacion/useAula";
import { HABILIDADES, nombreCurso, nombreEstudiante, opcionesDe } from "../../../Juego/Dominio/ValoresPermitidos";
import { fraccion, porcentaje } from "../../Dominio/Indicadores";
import { PartidaApiHttp } from "../PartidaApiHttp";
import { GeneracionApiHttp } from "../../../Generacion/Infraestructura/GeneracionApiHttp";
import { PanelRepaso } from "./PanelRepaso";

const ESTADOS = { en_curso: { texto: "En curso", tono: "azul" }, finalizada: { texto: "Terminada", tono: "verde" }, abandonada: { texto: "Abandonada", tono: "gris" } };

const Indicador = ({ titulo, n, d, ayuda }) => (
  <Tarjeta>
    <p className="text-sm font-medium text-tenue">{titulo}</p>
    <p className="mt-1 font-titulo text-3xl font-black tabular-nums">
      {d ? <>{n} <span className="text-lg font-bold text-tenue">de {d}</span></> : <span className="text-xl text-tenue">Sin datos</span>}
    </p>
    <p className="mt-1 text-sm text-tenue">{d ? porcentaje(n, d) : ayuda}</p>
  </Tarjeta>
);

const Celda = ({ children, className = "" }) => <td className={`px-4 py-3 tabular-nums ${className}`}>{children}</td>;
const Encabezados = ({ columnas }) => (
  <thead className="border-b border-borde bg-fondo text-tenue">
    <tr>{columnas.map((c) => <th key={c} scope="col" className="px-4 py-3 font-medium">{c}</th>)}</tr>
  </thead>
);

export const PaginaResultados = () => {
  const [parametros, setParametros] = useSearchParams();
  const cursoId = parametros.get("curso") || "";
  const estudianteId = parametros.get("estudiante") || "";
  const habilidad = parametros.get("habilidad") || "";
  const juegoId = parametros.get("juego") || "";

  const cursos = useCursos();
  const estudiantes = useEstudiantes({ cursoId });
  // Todo se filtra y se calcula en el servidor
  const resultados = useConsulta(
    () => PartidaApiHttp.resultados({ cursoId, estudianteId, habilidad, juegoId }),
    [cursoId, estudianteId, habilidad, juegoId]
  );

  // La sugerencia se pide con un botón y describe lo que el docente tiene filtrado; al cambiar un filtro se descarta
  const [repaso, setRepaso] = useState(null);
  const [recomendacion, setRecomendacion] = useState(null);
  const pedirRepaso = useCallback(() => PartidaApiHttp.repaso({ cursoId, estudianteId, habilidad, juegoId }), [cursoId, estudianteId, habilidad, juegoId]);
  const pedirRecomendacion = useCallback(() => PartidaApiHttp.recomendacion({ cursoId, estudianteId, habilidad, juegoId }), [cursoId, estudianteId, habilidad, juegoId]);
  const accionRepaso = useAccion(pedirRepaso);
  const accionRecomendacion = useAccion(pedirRecomendacion);
  const { limpiarError: limpiarErrorRepaso } = accionRepaso;
  const { limpiarError: limpiarErrorRecomendacion } = accionRecomendacion;
  useEffect(() => {
    setRepaso(null);
    setRecomendacion(null);
    limpiarErrorRepaso();
    limpiarErrorRecomendacion();
  }, [cursoId, estudianteId, habilidad, juegoId]); // eslint-disable-line react-hooks/exhaustive-deps
  const sugerirRepaso = async () => {
    try {
      setRepaso(await accionRepaso.ejecutar());
    } catch {
      // el error queda en accionRepaso.error y se muestra debajo
    }
  };
  // El servidor decide si la IA está encendida; hasta saberlo el botón de redactar no aparece
  const cuotas = useConsulta(() => GeneracionApiHttp.cuotas(), []);
  const iaHabilitada = cuotas.datos?.generacionHabilitada === true;
  const redactarRecomendacion = async () => {
    try {
      setRecomendacion({ datos: await accionRecomendacion.ejecutar() });
    } catch {
      // El código del error se traduce a un mensaje fijo en el panel
    }
  };

  const cambiar = (clave, valor) => {
    const nuevos = new URLSearchParams(parametros);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    if (clave === "curso") nuevos.delete("estudiante");
    setParametros(nuevos);
  };

  const datos = resultados.datos;
  const partidas = datos?.partidas || [];
  const total = datos?.resumen;
  const estudianteDe = (id) => estudiantes.datos?.find((e) => e.id === id);
  const tituloFiltrado = juegoId && partidas.find((p) => p.juegoId === juegoId)?.titulo;
  // La tabla por estudiante tiene sentido dentro de un curso (los nombres salen de su lista)
  const porEstudiante = cursoId && !estudianteId ? datos?.porEstudiante || [] : [];

  return (
    <>
      <title>Resultados · Letritas</title>
      <Encabezado titulo="Resultados" descripcion="Describen cómo les fue en las actividades. No son una calificación ni un diagnóstico: sirven para decidir dónde reforzar."
        acciones={<Boton variante="secundario" cargando={accionRepaso.enviando} onClick={sugerirRepaso}><Lightbulb className="size-5" aria-hidden="true" /> ¿Qué repasar?</Boton>} />

      <div className="mb-6 grid gap-3 rounded-2xl border border-borde bg-white p-4 sm:grid-cols-3">
        <Selector etiqueta="Curso" value={cursoId} onChange={(e) => cambiar("curso", e.target.value)} opciones={[{ valor: "", texto: "Todos" }, ...(cursos.datos || []).map((c) => ({ valor: c.id, texto: nombreCurso(c) }))]} />
        <Selector etiqueta="Estudiante" value={estudianteId} disabled={!cursoId} onChange={(e) => cambiar("estudiante", e.target.value)} opciones={[{ valor: "", texto: cursoId ? "Todos" : "Elige un curso primero" }, ...(estudiantes.datos || []).map((e) => ({ valor: e.id, texto: nombreEstudiante(e) }))]} />
        <Selector etiqueta="Habilidad" value={habilidad} onChange={(e) => cambiar("habilidad", e.target.value)} opciones={[{ valor: "", texto: "Todas" }, ...opcionesDe(HABILIDADES)]} />
      </div>
      {juegoId && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-tenue">
          Mostrando solo <strong className="text-tinta">{tituloFiltrado || "una actividad"}</strong>
          <button type="button" className="cursor-pointer font-medium text-marca-700 underline underline-offset-2" onClick={() => cambiar("juego", "")}>Ver todas</button>
        </p>
      )}

      <MensajeError error={accionRepaso.error} alReintentar={sugerirRepaso} />
      {repaso && (
        <PanelRepaso
          repaso={repaso} cursoId={cursoId} iaHabilitada={iaHabilitada} onRecomendar={redactarRecomendacion}
          recomendacion={{ datos: recomendacion?.datos, enviando: accionRecomendacion.enviando, error: accionRecomendacion.error }}
        />
      )}

      <MensajeError error={resultados.error} alReintentar={resultados.recargar} />

      {resultados.cargando && !datos ? (
        <Cargando filas={3} />
      ) : !datos ? null : partidas.length === 0 ? (
        <EstadoVacio icono={BarChart3} titulo="Todavía no hay partidas" texto="Cuando tus estudiantes jueguen una actividad en el aula, sus resultados aparecerán aquí." accion={<BotonEnlace to="/panel/actividades"><Play className="size-5" aria-hidden="true" /> Ir a mis actividades</BotonEnlace>} />
      ) : (
        <>
          <h2 className="mb-1 text-lg font-extrabold">Resumen de {total.partidas} {total.partidas === 1 ? "partida terminada" : "partidas terminadas"}</h2>
          <p className="mb-3 text-sm text-tenue">
            Solo cuentan las partidas terminadas.
            {(total.enCurso > 0 || total.abandonadas > 0) && ` Aparte: ${total.enCurso} en curso y ${total.abandonadas} abandonadas.`}
          </p>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador titulo="Aciertos al primer intento" n={total.primerIntento} d={total.respondidos} ayuda="Aún no hay partidas terminadas." />
            <Indicador titulo="Resueltos sin pista" n={total.sinAyuda} d={total.respondidos} ayuda="Aún no hay partidas terminadas." />
            <Indicador titulo="Ejercicios completados" n={total.completados} d={total.disponibles} ayuda="Aún no hay partidas terminadas." />
            <Tarjeta>
              <p className="text-sm font-medium text-tenue">Intentos registrados</p>
              <p className="mt-1 font-titulo text-3xl font-black tabular-nums">{total.intentosTotales}</p>
              <p className="mt-1 text-sm text-tenue">en {total.respondidos} ejercicios respondidos</p>
            </Tarjeta>
          </div>

          {porEstudiante.length > 0 && (
            <section className="mb-8" aria-labelledby="titulo-por-estudiante">
              <h2 id="titulo-por-estudiante" className="mb-3 text-lg font-extrabold">Por estudiante</h2>
              {/* Enfocable: en pantallas angostas la tabla se desplaza y con teclado también debe poder hacerlo */}
              <div tabIndex={0} role="region" aria-labelledby="titulo-por-estudiante" className="overflow-x-auto rounded-2xl border border-borde bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-500">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <Encabezados columnas={["Estudiante", "Partidas", "Primer intento", "Sin pista", "Completados"]} />
                  <tbody className="divide-y divide-borde">
                    {porEstudiante.map((g) => {
                      const est = estudianteDe(g.estudianteId);
                      return (
                        <tr key={g.estudianteId}>
                          <td className="px-4 py-3 font-medium">
                            {est ? <button type="button" className="cursor-pointer hover:text-marca-700 hover:underline" onClick={() => cambiar("estudiante", g.estudianteId)}>{nombreEstudiante(est)}</button> : "Estudiante"}
                          </td>
                          <Celda>{g.partidas}</Celda>
                          <Celda>{fraccion(g.primerIntento, g.respondidos)}</Celda>
                          <Celda>{fraccion(g.sinAyuda, g.respondidos)}</Celda>
                          <Celda>{fraccion(g.completados, g.disponibles)}</Celda>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <h2 id="titulo-partidas" className="mb-3 text-lg font-extrabold">Partidas</h2>
          <div tabIndex={0} role="region" aria-labelledby="titulo-partidas" className="overflow-x-auto rounded-2xl border border-borde bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-500">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <Encabezados columnas={["Actividad", "Estudiante", "Fecha", "Primer intento", "Completados", "Pistas", "Estado"]} />
              <tbody className="divide-y divide-borde">
                {partidas.map((p) => {
                  const ind = p.indicadores;
                  const est = estudianteDe(p.estudianteId);
                  const estado = ESTADOS[p.estado];
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/panel/actividades/${p.juegoId}`} className="hover:text-marca-700 hover:underline">{p.titulo || "Actividad"}</Link>
                      </td>
                      <td className="px-4 py-3">{est ? nombreEstudiante(est) : <span className="text-tenue">Elige el curso para ver nombres</span>}</td>
                      <Celda className="text-tenue">{new Date(p.iniciadaEn).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</Celda>
                      <Celda>{fraccion(ind.primerIntento, ind.respondidos)}</Celda>
                      <Celda>{fraccion(ind.completados, ind.disponibles, "–")}</Celda>
                      <Celda>{ind.pistas}</Celda>
                      <td className="px-4 py-3">
                        {p.estado === "en_curso" ? (
                          <Link to={`/aula/partida/${p.id}`} className="font-medium text-marca-700 underline underline-offset-2">Continuar</Link>
                        ) : (
                          <Insignia tono={estado.tono}>{estado.texto}</Insignia>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
};
