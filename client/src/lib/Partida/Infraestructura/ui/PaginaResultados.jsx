import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BarChart3, Play } from "lucide-react";
import { BotonEnlace, Cargando, Encabezado, EstadoVacio, Insignia, MensajeError, Selector, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { useConsulta } from "../../../../Infraestructura/http/useConsulta";
import { useCursos, useEstudiantes } from "../../../Aula/Aplicacion/useAula";
import { JuegoApiHttp } from "../../../Juego/Infraestructura/JuegoApiHttp";
import { HABILIDADES, nombreCurso, nombreEstudiante, opcionesDe } from "../../../Juego/Dominio/ValoresPermitidos";
import { indicadoresAgregados, indicadoresDePartida, porcentaje } from "../../Dominio/Indicadores";
import { PartidaApiHttp } from "../PartidaApiHttp";

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

export const PaginaResultados = () => {
  const [parametros, setParametros] = useSearchParams();
  const cursoId = parametros.get("curso") || "";
  const estudianteId = parametros.get("estudiante") || "";
  const habilidad = parametros.get("habilidad") || "";
  const juegoId = parametros.get("juego") || "";

  const cursos = useCursos();
  const estudiantes = useEstudiantes({ cursoId });
  const juegos = useConsulta(() => JuegoApiHttp.listar({ incluirArchivados: "true", limite: 50 }), []);
  const partidas = useConsulta(
    () => PartidaApiHttp.listar({ cursoId: cursoId || undefined, estudianteId: estudianteId || undefined, habilidad: habilidad || undefined }),
    [cursoId, estudianteId, habilidad]
  );

  const cambiar = (clave, valor) => {
    const nuevos = new URLSearchParams(parametros);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    if (clave === "curso") nuevos.delete("estudiante");
    setParametros(nuevos);
  };

  const lista = useMemo(
    () => (partidas.datos || []).filter((p) => !juegoId || p.juegoId === juegoId).sort((a, b) => new Date(b.iniciadaEn || b.creadoEn) - new Date(a.iniciadaEn || a.creadoEn)),
    [partidas.datos, juegoId]
  );
  const total = indicadoresAgregados(lista);
  const tituloDe = (id) => juegos.datos?.items.find((j) => j.id === id)?.titulo || "Actividad";
  const estudianteDe = (id) => estudiantes.datos?.find((e) => e.id === id);
  const juegoFiltrado = juegoId && juegos.datos?.items.find((j) => j.id === juegoId);

  return (
    <>
      <title>Resultados · Letritas</title>
      <Encabezado titulo="Resultados" descripcion="Describen cómo les fue en las actividades. No son una calificación ni un diagnóstico: sirven para decidir dónde reforzar." />

      <div className="mb-6 grid gap-3 rounded-2xl border border-borde bg-white p-4 sm:grid-cols-3">
        <Selector etiqueta="Curso" value={cursoId} onChange={(e) => cambiar("curso", e.target.value)} opciones={[{ valor: "", texto: "Todos" }, ...(cursos.datos || []).map((c) => ({ valor: c.id, texto: nombreCurso(c) }))]} />
        <Selector etiqueta="Estudiante" value={estudianteId} disabled={!cursoId} onChange={(e) => cambiar("estudiante", e.target.value)} opciones={[{ valor: "", texto: cursoId ? "Todos" : "Elige un curso primero" }, ...(estudiantes.datos || []).map((e) => ({ valor: e.id, texto: nombreEstudiante(e) }))]} />
        <Selector etiqueta="Habilidad" value={habilidad} onChange={(e) => cambiar("habilidad", e.target.value)} opciones={[{ valor: "", texto: "Todas" }, ...opcionesDe(HABILIDADES)]} />
      </div>
      {juegoFiltrado && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-tenue">
          Mostrando solo <strong className="text-tinta">{juegoFiltrado.titulo}</strong>
          <button type="button" className="cursor-pointer font-medium text-marca-700 underline underline-offset-2" onClick={() => cambiar("juego", "")}>Ver todas</button>
        </p>
      )}

      <MensajeError error={partidas.error} alReintentar={partidas.recargar} />

      {partidas.cargando && !partidas.datos ? (
        <Cargando filas={3} />
      ) : !partidas.datos ? null : lista.length === 0 ? (
        <EstadoVacio icono={BarChart3} titulo="Todavía no hay partidas" texto="Cuando tus estudiantes jueguen una actividad en el aula, sus resultados aparecerán aquí." accion={<BotonEnlace to="/panel/actividades"><Play className="size-5" aria-hidden="true" /> Ir a mis actividades</BotonEnlace>} />
      ) : (
        <>
          <h2 className="mb-3 text-lg font-extrabold">Resumen de {total.partidas} {total.partidas === 1 ? "partida terminada" : "partidas terminadas"}</h2>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Indicador titulo="Aciertos al primer intento" n={total.primerIntento} d={total.respondidos} ayuda="Aún no hay partidas terminadas." />
            <Indicador titulo="Resueltos sin pista" n={total.sinAyuda} d={total.respondidos} ayuda="Aún no hay partidas terminadas." />
            <Tarjeta>
              <p className="text-sm font-medium text-tenue">Intentos registrados</p>
              <p className="mt-1 font-titulo text-3xl font-black tabular-nums">{total.intentosTotales}</p>
              <p className="mt-1 text-sm text-tenue">en {total.respondidos} ejercicios respondidos</p>
            </Tarjeta>
          </div>

          <h2 className="mb-3 text-lg font-extrabold">Partidas</h2>
          <div className="overflow-x-auto rounded-2xl border border-borde bg-white">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-borde bg-fondo text-tenue">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Actividad</th>
                  <th scope="col" className="px-4 py-3 font-medium">Estudiante</th>
                  <th scope="col" className="px-4 py-3 font-medium">Fecha</th>
                  <th scope="col" className="px-4 py-3 font-medium">Primer intento</th>
                  <th scope="col" className="px-4 py-3 font-medium">Pistas</th>
                  <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {lista.map((p) => {
                  const ind = indicadoresDePartida(p);
                  const est = estudianteDe(p.estudianteId);
                  const estado = ESTADOS[p.estado];
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/panel/actividades/${p.juegoId}`} className="hover:text-marca-700 hover:underline">{tituloDe(p.juegoId)}</Link>
                      </td>
                      <td className="px-4 py-3">{est ? nombreEstudiante(est) : <span className="text-tenue">Elige el curso para ver nombres</span>}</td>
                      <td className="px-4 py-3 tabular-nums text-tenue">{new Date(p.iniciadaEn || p.creadoEn).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</td>
                      <td className="px-4 py-3 tabular-nums">{ind.respondidos ? `${ind.primerIntento} de ${ind.respondidos}` : "Sin respuestas"}</td>
                      <td className="px-4 py-3 tabular-nums">{ind.pistas}</td>
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
