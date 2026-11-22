import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, BarChart3, CheckCircle2, Eye, FilePlus2, Pencil, Play, Save, Sparkles, Trash2 } from "lucide-react";
import { Boton, BotonEnlace, Cargando, Insignia, MensajeError, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { useAvisos } from "../../../../Infraestructura/ui/Avisos";
import { Confirmar } from "../../../Aula/Infraestructura/ui/PaginaCursos";
import { ESTADOS_JUEGO, HABILIDADES, TEMATICAS } from "../../Dominio/ValoresPermitidos";
import { aContrato, aFormulario, revisar } from "../../Dominio/Ejercicios";
import { useJuego, useRecursos } from "../../Aplicacion/useJuegos";
import { JuegoApiHttp } from "../JuegoApiHttp";
import { EditorEjercicios } from "./EditorEjercicios";

// Vista de solo lectura de una versión aprobada (inmutable)
const VistaVersion = ({ version }) => (
  <ol className="grid gap-3 sm:grid-cols-2">
    {version.ejercicios.map((e, i) => (
      <li key={e.id} className="rounded-2xl border border-borde bg-white p-4">
        <p className="text-xs font-medium text-tenue">Ejercicio {i + 1}</p>
        <p className="mt-1 text-sm">{e.consigna}</p>
        <p className="my-2 font-titulo text-2xl font-black text-marca-900">{e.objetivo}</p>
        {e.opciones ? (
          <div className="flex gap-2">
            {e.opciones.map((o) => (
              <span key={o.id} className={`grid size-10 place-items-center rounded-xl font-titulo font-black ${o.id === e.respuestaCorrectaId ? "bg-exito-suave text-exito ring-2 ring-exito" : "bg-slate-100 text-tenue"}`}>
                {o.texto}
                {o.id === e.respuestaCorrectaId && <span className="sr-only"> (correcta)</span>}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {e.ordenCorrecto.map((id) => (
              <span key={id} className="rounded-lg bg-marca-50 px-2.5 py-1 font-titulo font-black text-marca-800 ring-1 ring-marca-200">
                {e.piezas.find((p) => p.id === id)?.texto}
              </span>
            ))}
          </div>
        )}
        {e.pista && <p className="mt-2 text-xs text-tenue">Pista: {e.pista}</p>}
      </li>
    ))}
  </ol>
);

export const PaginaActividad = () => {
  const { id } = useParams();
  const avisar = useAvisos();
  const consulta = useJuego(id);
  const [ejercicios, setEjercicios] = useState([]);
  const [errores, setErrores] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [previa, setPrevia] = useState(null); // contrato de ejercicios en vista previa; null = editando

  const { juego, versiones = [] } = consulta.datos || {};
  const borrador = versiones.find((v) => v.estado === "borrador");
  const vigente = versiones.find((v) => v.id === juego?.versionActualId);
  const mecanica = juego?.mecanica;
  const catalogo = useRecursos(borrador?.configuracion.tematica);
  const recursos = catalogo.datos || [];

  useEffect(() => {
    setEjercicios(aFormulario(borrador?.ejercicios));
    setErrores([]);
    setPrevia(null);
  }, [borrador?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const conAccion = (nombre, funcion) => async () => {
    setOcupado(nombre);
    try {
      await funcion();
    } catch (error) {
      avisar(error.message, "error");
    } finally {
      setOcupado(null);
    }
  };

  const validar = () => {
    if (!recursos.length) {
      avisar("El catálogo de palabras todavía no cargó. Inténtalo de nuevo en un momento.", "error");
      return false;
    }
    const encontrados = revisar(ejercicios, mecanica, recursos);
    setErrores(encontrados);
    const hay = encontrados.some((e) => Object.keys(e).length);
    if (hay) avisar("Hay ejercicios por corregir. Están marcados en rojo.", "error");
    return !hay;
  };

  // La vista previa muestra lo que quedaría guardado; no se puede previsualizar algo que no pasa la revisión
  const alternarPrevia = () => {
    if (previa) {
      setPrevia(null);
      return;
    }
    if (validar()) setPrevia(aContrato(ejercicios, mecanica, recursos));
  };

  const guardar = conAccion("guardar", async () => {
    if (!validar()) return;
    await JuegoApiHttp.actualizarVersion(id, borrador.id, aContrato(ejercicios, mecanica, recursos));
    setPrevia(null);
    avisar("Borrador guardado.");
    consulta.recargar();
  });

  const aprobar = conAccion("aprobar", async () => {
    if (!validar()) return;
    const cantidad = borrador.configuracion.cantidadEjercicios;
    if (ejercicios.length !== cantidad) {
      avisar(`Para aprobar hacen falta exactamente ${cantidad} ejercicios.`, "error");
      return;
    }
    await JuegoApiHttp.actualizarVersion(id, borrador.id, aContrato(ejercicios, mecanica, recursos));
    await JuegoApiHttp.aprobarVersion(id, borrador.id);
    avisar("Actividad aprobada. Ya se puede jugar en el aula.");
    consulta.recargar();
  });

  const nuevaVersion = conAccion("nueva", async () => {
    const base = vigente || versiones[0];
    await JuegoApiHttp.crearVersion(id, {
      tematica: base.configuracion.tematica,
      cantidadEjercicios: base.configuracion.cantidadEjercicios,
      ejercicios: base.ejercicios
    });
    avisar("Nueva versión en borrador. Lo jugado antes conserva su versión.");
    consulta.recargar();
  });

  const descartar = async () => {
    await conAccion("descartar", async () => {
      await JuegoApiHttp.descartarVersion(id, borrador.id);
      avisar("Borrador descartado.");
      consulta.recargar();
    })();
    setConfirmar(null);
  };

  const archivar = async () => {
    await conAccion("archivar", async () => {
      if (juego.estado === "archivado") await JuegoApiHttp.desarchivar(id);
      else await JuegoApiHttp.archivar(id);
      avisar(juego.estado === "archivado" ? "Actividad recuperada." : "Actividad archivada. Sus resultados se conservan.");
      consulta.recargar();
    })();
    setConfirmar(null);
  };

  if (consulta.cargando && !consulta.datos) return <Cargando filas={4} />;
  if (consulta.error && !consulta.datos) return <MensajeError error={consulta.error} alReintentar={consulta.recargar} />;

  const estado = ESTADOS_JUEGO[juego.estado];
  const config = (borrador || vigente)?.configuracion;
  const archivado = juego.estado === "archivado";

  return (
    <>
      <title>{`${juego.titulo} · Letritas`}</title>
      <Link to="/panel/actividades" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-tenue hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden="true" /> Mis actividades
      </Link>

      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Insignia tono={estado.tono}>{estado.texto}</Insignia>
            {vigente && <Insignia tono="gris">Versión {vigente.numero}</Insignia>}
          </div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{juego.titulo}</h1>
          {config && (
            <p className="mt-1 text-tenue">
              {HABILIDADES[juego.habilidad]?.texto} · {TEMATICAS[config.tematica]} · {config.cantidadEjercicios} ejercicios
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {juego.estado === "listo" && <BotonEnlace to={`/aula/${id}`}><Play className="size-5" aria-hidden="true" /> Iniciar en el aula</BotonEnlace>}
          <BotonEnlace to={`/panel/resultados?juego=${id}`} variante="secundario"><BarChart3 className="size-5" aria-hidden="true" /> Resultados</BotonEnlace>
          <Boton variante="fantasma" onClick={() => setConfirmar("archivar")}>
            {archivado ? <ArchiveRestore className="size-5" aria-hidden="true" /> : <Archive className="size-5" aria-hidden="true" />}
            {archivado ? "Desarchivar" : "Archivar"}
          </Boton>
        </div>
      </header>

      {borrador && !archivado ? (
        <section aria-labelledby="titulo-borrador">
          <Tarjeta className="mb-4 flex flex-col gap-3 border-amber-200 bg-amber-50/60 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="titulo-borrador" className="font-extrabold">Borrador {borrador.numero ? `de la versión ${borrador.numero}` : ""}</h2>
              <p className="text-sm text-tenue">Revisa cada ejercicio. Nada llega a los estudiantes hasta que lo apruebes.</p>
              {juego.origen === "ia" && (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-marca-800">
                  <Sparkles className="size-4" aria-hidden="true" /> Propuesto por la IA. Puede equivocarse: corrige lo que haga falta antes de aprobar.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Boton variante="fantasma" tamano="sm" onClick={alternarPrevia}>
                {previa ? <Pencil className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                {previa ? "Volver a editar" : "Vista previa"}
              </Boton>
              <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmar("descartar")}><Trash2 className="size-4" aria-hidden="true" /> Descartar</Boton>
              <Boton variante="secundario" tamano="sm" cargando={ocupado === "guardar"} onClick={guardar}><Save className="size-4" aria-hidden="true" /> Guardar</Boton>
              <Boton tamano="sm" cargando={ocupado === "aprobar"} onClick={aprobar}><CheckCircle2 className="size-4" aria-hidden="true" /> Aprobar</Boton>
            </div>
          </Tarjeta>
          <MensajeError error={catalogo.error} alReintentar={catalogo.recargar} />
          {previa ? (
            <VistaVersion version={{ ejercicios: previa }} />
          ) : (
            <EditorEjercicios ejercicios={ejercicios} setEjercicios={setEjercicios} mecanica={mecanica} cantidad={borrador.configuracion.cantidadEjercicios} errores={errores} recursos={recursos} />
          )}
        </section>
      ) : vigente ? (
        <section aria-labelledby="titulo-vigente">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="titulo-vigente" className="text-lg font-extrabold">Lo que verán tus estudiantes</h2>
            {!archivado && (
              <Boton variante="secundario" tamano="sm" cargando={ocupado === "nueva"} onClick={nuevaVersion}>
                <FilePlus2 className="size-4" aria-hidden="true" /> Editar como versión nueva
              </Boton>
            )}
          </div>
          <VistaVersion version={vigente} />
        </section>
      ) : (
        <Tarjeta>
          <p className="text-tenue">Esta actividad no tiene versiones activas.</p>
          {!archivado && versiones[0] && <Boton className="mt-4" cargando={ocupado === "nueva"} onClick={nuevaVersion}>Crear un borrador nuevo</Boton>}
        </Tarjeta>
      )}

      <Confirmar
        abierto={confirmar === "descartar"}
        titulo="¿Descartar este borrador?"
        texto="Se pierden los cambios que no aprobaste. La versión que ya se juega no cambia."
        accion="Descartar"
        alCerrar={() => setConfirmar(null)}
        alConfirmar={descartar}
      />
      <Confirmar
        abierto={confirmar === "archivar"}
        titulo={archivado ? "¿Recuperar esta actividad?" : "¿Archivar esta actividad?"}
        texto={archivado ? "Volverá a aparecer en tu biblioteca." : "Se guardan sus resultados, pero no se podrán empezar partidas nuevas."}
        accion={archivado ? "Desarchivar" : "Archivar"}
        alCerrar={() => setConfirmar(null)}
        alConfirmar={archivar}
      />
    </>
  );
};
