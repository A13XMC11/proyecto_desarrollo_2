import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { GraduationCap, Info, ShieldAlert, Sparkles, X } from "lucide-react";
import { AreaTexto, Boton, BotonEnlace, Campo, Cargando, Encabezado, EstadoVacio, Insignia, MensajeError, Selector, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { useAvisos } from "../../../../Infraestructura/ui/Avisos";
import { nuevoIdOperacion } from "../../../../Infraestructura/http/clienteHttp";
import { useConsulta } from "../../../../Infraestructura/http/useConsulta";
import { useCursos, useEstudiantes } from "../../../Aula/Aplicacion/useAula";
import { CANTIDADES_EJERCICIOS, ESTADOS_GENERACION, HABILIDADES, MODOS_TEMATICA, MOTIVOS_GENERACION, TEMATICAS, nombreCurso, nombreEstudiante, opcionesDe } from "../../../Juego/Dominio/ValoresPermitidos";
import { nombreTematica } from "../../../Juego/Dominio/Tematica";
import { EJEMPLOS_TEMATICA, MAX_TEMATICA, ayudaTematica, normalizarTematica, revisarTematica } from "../../Dominio/TematicaLibre";
import { mensajeDeError } from "../../Dominio/Mensajes";
import { leerRefuerzo } from "../../../Partida/Dominio/Refuerzo";
import { GeneracionApiHttp } from "../GeneracionApiHttp";

const MAX_INSTRUCCION = 500;
// Mientras haya una solicitud en cola o generándose, la lista se consulta sola cada pocos segundos
const INTERVALO_SEGUIMIENTO_MS = 3000;
// Mientras se espera la respuesta de una solicitud propia se consulta más seguido, para que se vea «Generando»
const INTERVALO_ENVIANDO_MS = 700;

const esActiva = (g) => g.estado === "pendiente" || g.estado === "procesando";
const AVISO_DATOS = "No escribas nombres de estudiantes ni datos personales; el texto se envía a la IA.";
const motivoDe = (g) => (g.estado === "fallida" ? MOTIVOS_GENERACION[g.errorCodigo] : g.estado === "interrumpida" ? MOTIVOS_GENERACION.interrumpida : null);

const Cupo = ({ cuotas }) => {
  // El límite lo fija el servidor; desactivar un botón no bastaría para aplicarlo. El 3 solo rige mientras llega.
  const limite = cuotas?.limiteDiario ?? 3;
  const usadas = cuotas ? Math.round((cuotas.diaria?.consumido || 0) + (cuotas.diaria?.reservado || 0)) : null;
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
  // Desde «¿Qué repasar?» se llega con la habilidad, el curso y las palabras ya puestas (validadas al leerlas)
  const [parametros] = useSearchParams();
  const [datos, setDatos] = useState(() => ({
    cursoId: "", estudianteId: "", habilidad: "vocales", modo: "catalogo", tematica: "animales", tematicaLibre: "", cantidad: 5, instruccion: "",
    ...leerRefuerzo(parametros, Object.keys(HABILIDADES))
  }));
  const [tocada, setTocada] = useState(false); // el error de forma de la temática solo se muestra tras escribir o intentar enviar
  const [anuncio, setAnuncio] = useState(""); // lo que lee un lector de pantalla cuando cambia el estado
  // Un curso que ya no existe (enlace viejo) cae al primero de la lista
  const cursoId = (cursos.datos || []).some((c) => c.id === datos.cursoId) ? datos.cursoId : cursos.datos?.[0]?.id || "";
  const estudiantes = useEstudiantes({ cursoId, archivado: false });
  const generaciones = useConsulta(() => GeneracionApiHttp.listar(), []);
  const cuotas = useConsulta(() => GeneracionApiHttp.cuotas(), []);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // Una clave por solicitud: si el envío se repite (doble clic, red lenta), el servidor devuelve la misma
  const clave = useRef(nuevoIdOperacion());
  // Varios clics en el mismo instante: el estado de React aún no cambió, así que el cerrojo es una referencia
  const enCurso = useRef(false);

  const hayActivas = (generaciones.datos || []).some(esActiva);
  const libre = datos.modo === "libre";
  // El servidor decide si la temática libre está disponible; hasta saberlo se mantiene desactivada
  const libreHabilitada = cuotas.datos?.generacionLibreHabilitada === true;
  const errorTematica = libre ? revisarTematica(datos.tematicaLibre) : null;
  const ayudaLibre = libre ? ayudaTematica(datos.tematicaLibre) : null;
  const recargarGeneraciones = generaciones.recargar;
  const recargarCuotas = cuotas.recargar;
  useEffect(() => {
    // Mientras se envía, la lista también se consulta: así se ve la solicitud «Generando» (y se puede cancelar)
    if (!hayActivas && !enviando) return undefined;
    const temporizador = setInterval(recargarGeneraciones, enviando ? INTERVALO_ENVIANDO_MS : INTERVALO_SEGUIMIENTO_MS);
    return () => {
      clearInterval(temporizador);
      // Al terminar la última, el cupo cambió (se consumió o se devolvió)
      recargarCuotas();
    };
  }, [hayActivas, enviando, recargarGeneraciones, recargarCuotas]);

  const poner = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value, ...(campo === "cursoId" && { estudianteId: "" }) }));

  const enviar = async (e) => {
    e.preventDefault();
    // Un solo envío a la vez: varios clics seguidos no crean varias solicitudes
    if (enCurso.current || enviando || hayActivas) return;
    if (datos.instruccion.length > MAX_INSTRUCCION) return;
    if (errorTematica) {
      setTocada(true);
      return;
    }
    enCurso.current = true;
    setEnviando(true);
    setError(null);
    setAnuncio("Generando la actividad. Esto puede tardar unos segundos.");
    try {
      const generacion = await GeneracionApiHttp.solicitar(clave.current, {
        cursoId,
        estudianteId: datos.estudianteId || undefined,
        habilidad: datos.habilidad,
        modoTematica: datos.modo,
        tematica: libre ? normalizarTematica(datos.tematicaLibre) : datos.tematica,
        cantidad: Number(datos.cantidad),
        instruccion: datos.instruccion.trim() || undefined
      });
      clave.current = nuevoIdOperacion();
      // La solicitud normalmente se resuelve en la misma llamada. Un reintento con la misma clave puede devolver
      // una generación todavía en curso o interrumpida: eso no es un fallo de la IA y no debe presentarse como tal.
      if (generacion.estado === "completada") {
        setDatos((d) => ({ ...d, instruccion: "" }));
        avisar("Borrador listo. Revísalo antes de usarlo en clase.");
        setAnuncio("La actividad está lista para revisar. Aparece en la lista de tus solicitudes.");
      } else if (generacion.estado === "fallida") {
        const motivo = MOTIVOS_GENERACION[generacion.errorCodigo] || "No se pudo crear la actividad. Puedes intentarlo de nuevo.";
        avisar(motivo, "error");
        setAnuncio(`No se pudo crear la actividad. ${motivo}`);
      } else if (generacion.estado === "interrumpida") {
        avisar("La solicitud se interrumpió antes de terminar. Puedes intentarlo de nuevo.", "error");
        setAnuncio("La solicitud se interrumpió antes de terminar.");
      } else {
        avisar("Tu solicitud sigue en marcha. Aparecerá en la lista cuando termine.");
        setAnuncio("Tu solicitud sigue en marcha.");
      }
      generaciones.recargar();
      cuotas.recargar();
    } catch (err) {
      // El mensaje sale de un texto fijo por código: nunca repite lo que escribió el docente
      setError({ message: mensajeDeError(err) });
      setAnuncio(`No se pudo pedir la actividad. ${mensajeDeError(err)}`);
      // Un rechazo del servidor (sin cupo, apagada, otra en curso) cierra esa solicitud: la siguiente lleva clave nueva.
      // Un corte de red no trae código: se conserva la clave y el reintento no duplica nada.
      if (err.codigo) clave.current = nuevoIdOperacion();
      generaciones.recargar();
      cuotas.recargar();
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  const cancelar = async (id) => {
    try {
      await GeneracionApiHttp.cancelar(id);
      avisar("Solicitud cancelada.");
      generaciones.recargar();
    } catch (err) {
      avisar(mensajeDeError(err), "error");
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

            <fieldset>
              <legend className="mb-2 text-sm font-medium">¿Sobre qué temática?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(MODOS_TEMATICA).map(([valor, texto]) => {
                  const bloqueado = valor === "libre" && !libreHabilitada;
                  return (
                    <label key={valor} className={`rounded-2xl border-2 p-4 transition-colors ${bloqueado ? "cursor-not-allowed border-borde bg-slate-50 text-tenue" : datos.modo === valor ? "cursor-pointer border-marca-600 bg-marca-50" : "cursor-pointer border-borde hover:border-marca-200"}`}>
                      <input type="radio" name="modo" value={valor} checked={datos.modo === valor} disabled={bloqueado} onChange={poner("modo")} className="sr-only" aria-describedby={`modo-${valor}`} />
                      <span className="block font-extrabold">{texto}</span>
                      <span id={`modo-${valor}`} className="text-sm text-tenue">
                        {valor === "catalogo"
                          ? "Palabras ya revisadas de 5 temáticas."
                          : !cuotas.datos
                            ? "Comprobando si está disponible…"
                            : bloqueado
                              ? "No está disponible por ahora. Usa una temática del catálogo."
                              : "Escribe cualquier temática: frutas, colores, medios de transporte…"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              {libre ? (
                <Campo
                  className="sm:col-span-2"
                  etiqueta="Escribe la temática"
                  value={datos.tematicaLibre}
                  maxLength={MAX_TEMATICA}
                  onChange={(e) => { setTocada(true); poner("tematicaLibre")(e); }}
                  onBlur={() => setTocada(true)}
                  error={tocada ? errorTematica : undefined}
                  ayuda={`${datos.tematicaLibre.length} de ${MAX_TEMATICA} caracteres. Solo letras y espacios.`}
                  placeholder="frutas"
                  autoComplete="off"
                  spellCheck={false}
                />
              ) : (
                <Selector etiqueta="Temática" value={datos.tematica} onChange={poner("tematica")} opciones={opcionesDe(TEMATICAS)} />
              )}
              {!libre && <Selector etiqueta="¿Cuántos ejercicios?" value={datos.cantidad} onChange={poner("cantidad")} opciones={CANTIDADES_EJERCICIOS.map((n) => ({ valor: n, texto: `${n} ejercicios` }))} />}
            </div>

            {libre && (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ejemplos de temáticas">
                  <span className="text-sm text-tenue">Por ejemplo:</span>
                  {EJEMPLOS_TEMATICA.map((ejemplo) => (
                    <Boton key={ejemplo} variante="secundario" tamano="sm" onClick={() => { setTocada(true); setDatos((d) => ({ ...d, tematicaLibre: ejemplo })); }}>
                      {ejemplo}
                    </Boton>
                  ))}
                </div>
                {ayudaLibre && <p className="rounded-xl bg-slate-50 p-3 text-sm text-tinta ring-1 ring-borde">{ayudaLibre}</p>}
                <p id="aviso-datos" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
                  <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> {AVISO_DATOS}
                </p>
                <Selector className="sm:max-w-xs" etiqueta="¿Cuántos ejercicios?" value={datos.cantidad} onChange={poner("cantidad")} opciones={CANTIDADES_EJERCICIOS.map((n) => ({ valor: n, texto: `${n} ejercicios` }))} />
              </div>
            )}

            <AreaTexto
              etiqueta="¿Quieres añadir algo? (opcional)"
              value={datos.instruccion}
              maxLength={MAX_INSTRUCCION}
              onChange={poner("instruccion")}
              placeholder="Practicar especialmente la A y la E"
              ayuda={`${datos.instruccion.length} de ${MAX_INSTRUCCION} caracteres. ${libre ? AVISO_DATOS : "No escribas nombres de estudiantes."}`}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Boton type="submit" tamano="lg" cargando={enviando} disabled={hayActivas && !enviando}>
                <Sparkles className="size-5" aria-hidden="true" /> {enviando ? "Generando…" : "Generar actividad"}
              </Boton>
              {/* Región viva: anuncia a lectores de pantalla cuándo empieza, termina o falla la generación */}
              <p role="status" aria-live="polite" className="text-sm text-tenue">
                {enviando ? "Esto puede tardar unos segundos. No cierres esta página." : hayActivas ? "Ya tienes una actividad generándose. Cuando termine podrás pedir otra." : anuncio}
              </p>
            </div>
          </form>
        </Tarjeta>

        <div className="grid content-start gap-4">
          <Cupo cuotas={cuotas.datos} />
          <div className="flex gap-3 rounded-2xl bg-marca-50 p-4 text-sm text-marca-900 ring-1 ring-marca-100">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            {cuotas.datos && !cuotas.datos.generacionHabilitada ? (
              <p>
                La generación con IA está desactivada por ahora. Puedes{" "}
                <Link to="/panel/actividades/nueva" className="font-medium underline underline-offset-2">crear la actividad a mano</Link>.
              </p>
            ) : (
              <p>
                {libre
                  ? "Recibirás un borrador: la IA propone las palabras, el sistema revisa que sean adecuadas y calcula las respuestas, y tú lo revisas y apruebas antes de usarlo en clase. No se envían datos de tus estudiantes."
                  : "Recibirás un borrador: revísalo y apruébalo antes de usarlo en clase. Solo se usan palabras del catálogo revisado y nunca se envían datos de tus estudiantes."}
              </p>
            )}
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
              const activa = esActiva(g);
              const motivo = motivoDe(g);
              const p = g.parametros || {};
              return (
                <li key={g.id} className="flex flex-col gap-3 rounded-2xl border border-borde bg-white p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {HABILIDADES[p.habilidad]?.texto} · {nombreTematica(p)} · {p.cantidad} ejercicios
                    </p>
                    <p className="text-sm text-tenue">
                      {new Date(g.creadaEn).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}
                      {p.instruccion && ` · "${p.instruccion}"`}
                    </p>
                    {motivo && <p className="mt-1 text-sm text-tenue">{motivo}</p>}
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
