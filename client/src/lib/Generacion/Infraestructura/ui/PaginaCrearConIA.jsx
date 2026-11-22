import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Info, Sparkles, X } from "lucide-react";
import { AreaTexto, Boton, BotonEnlace, Cargando, Encabezado, EstadoVacio, Insignia, MensajeError, Selector, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { useAvisos } from "../../../../Infraestructura/ui/Avisos";
import { nuevoIdOperacion } from "../../../../Infraestructura/http/clienteHttp";
import { useConsulta } from "../../../../Infraestructura/http/useConsulta";
import { useCursos, useEstudiantes } from "../../../Aula/Aplicacion/useAula";
import { CANTIDADES_EJERCICIOS, ESTADOS_GENERACION, HABILIDADES, MENSAJES_ERROR_GENERACION, TEMATICAS, nombreCurso, nombreEstudiante, opcionesDe } from "../../../Juego/Dominio/ValoresPermitidos";
import { GeneracionApiHttp } from "../GeneracionApiHttp";

const LIMITE_DIARIO_INICIAL = 3; // solo mientras llega el valor real del servidor
const MAX_INSTRUCCION = 500;

const Cupo = ({ cuotas }) => {
  const usadas = cuotas ? Math.round((cuotas.diaria?.consumido || 0) + (cuotas.diaria?.reservado || 0)) : null;
  const limite = cuotas?.maximoDiario ?? LIMITE_DIARIO_INICIAL;
  const libres = usadas === null ? null : Math.max(0, limite - usadas);
  return (
    <Tarjeta>
      <p className="text-sm font-medium text-tenue">Cupo de hoy</p>
      {libres === null ? (
        <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <>
          <p className="mt-1 font-titulo text-3xl font-black">
            {libres} <span className="text-lg font-bold text-tenue">de {limite} disponibles</span>
          </p>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: limite }, (_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i < libres ? "bg-marca-600" : "bg-marca-100"}`} />
            ))}
          </div>
        </>
      )}
      <p className="mt-3 text-sm text-tenue">Volver a jugar una actividad guardada no gasta cupo.</p>
    </Tarjeta>
  );
};

export const PaginaCrearConIA = () => {
  const avisar = useAvisos();
  const cursos = useCursos({ archivado: false });
  const [datos, setDatos] = useState({ cursoId: "", estudianteId: "", habilidad: "vocales", tematica: "animales", cantidad: 5, instruccion: "" });
  const cursoId = datos.cursoId || cursos.datos?.[0]?.id || "";
  const estudiantes = useEstudiantes({ cursoId, archivado: false });
  const generaciones = useConsulta(() => GeneracionApiHttp.listar(), []);
  const cuotas = useConsulta(() => GeneracionApiHttp.cuotas(), []);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // Una clave por solicitud: si el envío se repite (doble clic, red lenta), el servidor devuelve la misma
  const clave = useRef(nuevoIdOperacion());

  const poner = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value, ...(campo === "cursoId" && { estudianteId: "" }) }));

  const enviar = async (e) => {
    e.preventDefault();
    if (datos.instruccion.length > MAX_INSTRUCCION) return;
    setEnviando(true);
    setError(null);
    try {
      const generacion = await GeneracionApiHttp.solicitar(clave.current, {
        cursoId,
        estudianteId: datos.estudianteId || undefined,
        habilidad: datos.habilidad,
        tematica: datos.tematica,
        cantidad: Number(datos.cantidad),
        instruccion: datos.instruccion.trim() || undefined
      });
      clave.current = nuevoIdOperacion();
      // La solicitud normalmente se resuelve en la misma llamada. Un reintento con la misma clave puede devolver
      // una generación todavía en curso o interrumpida: eso no es un fallo de la IA y no debe presentarse como tal.
      if (generacion.estado === "completada") {
        setDatos((d) => ({ ...d, instruccion: "" }));
        avisar("Borrador listo. Revísalo antes de usarlo en clase.");
      } else if (generacion.estado === "fallida") {
        avisar(MENSAJES_ERROR_GENERACION[generacion.errorCodigo] || "No se pudo crear la actividad. Puedes intentarlo de nuevo.", "error");
      } else if (generacion.estado === "interrumpida") {
        avisar("La solicitud se interrumpió antes de terminar. Puedes intentarlo de nuevo.", "error");
      } else {
        avisar("Tu solicitud sigue en marcha. Aparecerá en la lista cuando termine.");
      }
      generaciones.recargar();
      cuotas.recargar();
    } catch (err) {
      setError(err);
      // Un rechazo del servidor (sin cupo, apagada, otra en curso) cierra esa solicitud: la siguiente lleva clave nueva.
      // Un corte de red no trae código: se conserva la clave y el reintento no duplica nada.
      if (err.codigo) clave.current = nuevoIdOperacion();
      generaciones.recargar();
      cuotas.recargar();
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async (id) => {
    try {
      await GeneracionApiHttp.cancelar(id);
      avisar("Solicitud cancelada.");
      generaciones.recargar();
    } catch (err) {
      avisar(err.message, "error");
    }
  };

  if (cursos.datos && cursos.datos.length === 0) {
    return <EstadoVacio icono={GraduationCap} titulo="Primero crea un curso" texto="La IA arma la actividad pensando en un curso o en un estudiante concreto." accion={<BotonEnlace to="/panel/cursos">Ir a cursos</BotonEnlace>} />;
  }

  const lista = [...(generaciones.datos || [])].sort((a, b) => new Date(b.creadaEn) - new Date(a.creadaEn));

  return (
    <>
      <title>Crear con IA · Letritas</title>
      <Encabezado titulo="Crear actividad con IA" descripcion="Dinos qué quieres practicar. Recibirás un borrador para revisar antes de usarlo en clase." />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Tarjeta>
          <form onSubmit={enviar} noValidate className="grid gap-5">
            <MensajeError error={error || cursos.error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Selector etiqueta="¿Para qué curso?" value={cursoId} onChange={poner("cursoId")} opciones={(cursos.datos || []).map((c) => ({ valor: c.id, texto: nombreCurso(c) }))} />
              <Selector etiqueta="¿Para quién?" value={datos.estudianteId} onChange={poner("estudianteId")} opciones={[{ valor: "", texto: "Todo el curso" }, ...(estudiantes.datos || []).map((e) => ({ valor: e.id, texto: nombreEstudiante(e) }))]} />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">¿Qué quieres practicar?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(HABILIDADES).map(([valor, info]) => (
                  <label key={valor} className={`cursor-pointer rounded-2xl border-2 p-4 transition-colors ${datos.habilidad === valor ? "border-marca-600 bg-marca-50" : "border-borde hover:border-marca-200"}`}>
                    <input type="radio" name="habilidad" value={valor} checked={datos.habilidad === valor} onChange={poner("habilidad")} className="sr-only" />
                    <span className="block font-extrabold">{info.texto}</span>
                    <span className="text-sm text-tenue">{info.mecanicaTexto}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Selector etiqueta="Temática" value={datos.tematica} onChange={poner("tematica")} opciones={opcionesDe(TEMATICAS)} />
              <Selector etiqueta="¿Cuántos ejercicios?" value={datos.cantidad} onChange={poner("cantidad")} opciones={CANTIDADES_EJERCICIOS.map((n) => ({ valor: n, texto: `${n} ejercicios` }))} />
            </div>

            <AreaTexto
              etiqueta="¿Quieres añadir algo? (opcional)"
              value={datos.instruccion}
              maxLength={MAX_INSTRUCCION}
              onChange={poner("instruccion")}
              placeholder="Practicar especialmente la A y la E"
              ayuda={`${datos.instruccion.length} de ${MAX_INSTRUCCION} caracteres. No escribas nombres de estudiantes.`}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Boton type="submit" tamano="lg" cargando={enviando}>
                <Sparkles className="size-5" aria-hidden="true" /> {enviando ? "Generando…" : "Generar actividad"}
              </Boton>
              <p role="status" className="text-sm text-tenue">{enviando ? "Esto puede tardar unos segundos. No cierres esta página." : ""}</p>
            </div>
          </form>
        </Tarjeta>

        <div className="grid content-start gap-4">
          <Cupo cuotas={cuotas.datos} />
          <div className="flex gap-3 rounded-2xl bg-marca-50 p-4 text-sm text-marca-900 ring-1 ring-marca-100">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>
              La IA solo propone un borrador con las palabras del catálogo. Tú lo revisas y lo apruebas antes de que llegue a los estudiantes. También puedes{" "}
              <Link to="/panel/actividades/nueva" className="font-medium underline underline-offset-2">crear la actividad a mano</Link>.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-10" aria-labelledby="titulo-solicitudes">
        <h2 id="titulo-solicitudes" className="mb-4 text-xl font-extrabold">Tus solicitudes</h2>
        <MensajeError error={generaciones.error} alReintentar={generaciones.recargar} />
        {generaciones.cargando && !generaciones.datos ? (
          <Cargando filas={2} alto="h-16" />
        ) : !generaciones.datos ? null : lista.length === 0 ? (
          <p className="text-tenue">Todavía no pediste ninguna actividad.</p>
        ) : (
          <ul className="grid gap-2">
            {lista.map((g) => {
              const estado = ESTADOS_GENERACION[g.estado] || ESTADOS_GENERACION.pendiente;
              const activa = g.estado === "pendiente" || g.estado === "procesando";
              const p = g.parametros || {};
              return (
                <li key={g.id} className="flex flex-col gap-3 rounded-2xl border border-borde bg-white p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {HABILIDADES[p.habilidad]?.texto} · {TEMATICAS[p.tematica]} · {p.cantidad} ejercicios
                    </p>
                    <p className="text-sm text-tenue">
                      {new Date(g.creadaEn).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}
                      {p.instruccion && ` · "${p.instruccion}"`}
                    </p>
                    {g.errorCodigo && MENSAJES_ERROR_GENERACION[g.errorCodigo] && (
                      <p className="mt-1 text-sm text-tenue">{MENSAJES_ERROR_GENERACION[g.errorCodigo]}</p>
                    )}
                    {g.estado === "interrumpida" && <p className="mt-1 text-sm text-tenue">Se interrumpió antes de terminar. No se reintenta sola.</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Insignia tono={estado.tono}>{estado.texto}</Insignia>
                    {g.juegoId && <BotonEnlace to={`/panel/actividades/${g.juegoId}`} tamano="sm">Revisar</BotonEnlace>}
                    {activa && (
                      <Boton variante="fantasma" tamano="sm" onClick={() => cancelar(g.id)} aria-label="Cancelar solicitud">
                        <X className="size-4" aria-hidden="true" /> Cancelar
                      </Boton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
};
