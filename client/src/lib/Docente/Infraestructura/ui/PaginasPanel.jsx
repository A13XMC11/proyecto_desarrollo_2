import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Play, Sparkles, Users } from "lucide-react";
import { Boton, BotonEnlace, Campo, Cargando, Encabezado, MensajeError, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { useAvisos } from "../../../../Infraestructura/ui/Avisos";
import { useConsulta } from "../../../../Infraestructura/http/useConsulta";
import { useCursos } from "../../../Aula/Aplicacion/useAula";
import { PartidaApiHttp } from "../../../Partida/Infraestructura/PartidaApiHttp";
import { GeneracionApiHttp } from "../../../Generacion/Infraestructura/GeneracionApiHttp";
import { TarjetaActividad } from "../../../Juego/Infraestructura/ui/PaginaActividades";
import { useSesion } from "../../Aplicacion/SesionContexto";

const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

export const PaginaInicio = () => {
  const { docente } = useSesion();
  // Los cursos se piden aparte porque las tarjetas de actividad muestran su nombre
  const cursos = useCursos({ archivado: false });
  // Resumen calculado en el servidor (GET /api/inicio): una sola petición
  const resumen = useConsulta(() => PartidaApiHttp.inicio(), []);
  const r = resumen.datos;
  const nombre = docente?.nombre?.split(" ")[0];
  const sinCursos = r && r.cursosActivos === 0;
  const enCurso = r?.enCurso.partidas || [];
  const recientes = r?.actividades.recientes || [];

  return (
    <>
      <title>Inicio · Letritas</title>
      <Encabezado
        titulo={`${saludo()}, ${nombre}`}
        descripcion="Aquí tienes lo último que preparaste y las partidas que quedaron a medias."
        acciones={<BotonEnlace to="/panel/crear"><Sparkles className="size-5" aria-hidden="true" /> Crear actividad</BotonEnlace>}
      />

      {sinCursos && (
        <Tarjeta className="mb-8 flex flex-col gap-4 border-marca-200 bg-marca-50 sm:flex-row sm:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-marca-600 text-white">
            <GraduationCap className="size-6" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h2 className="font-extrabold">Empieza por tu curso</h2>
            <p className="text-tenue">Crea el curso, agrega a tus estudiantes y después arma la primera actividad.</p>
          </div>
          <BotonEnlace to="/panel/cursos">Crear curso</BotonEnlace>
        </Tarjeta>
      )}

      <MensajeError error={resumen.error} alReintentar={resumen.recargar} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta>
          <p className="flex items-center gap-2 text-sm font-medium text-tenue"><Users className="size-4" aria-hidden="true" /> Cursos activos</p>
          <p className="mt-1 font-titulo text-3xl font-black tabular-nums">{r ? r.cursosActivos : "–"}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm font-medium text-tenue">Actividades en tu biblioteca</p>
          <p className="mt-1 font-titulo text-3xl font-black tabular-nums">{r ? r.actividades.total : "–"}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm font-medium text-tenue">Partidas a medias</p>
          <p className="mt-1 font-titulo text-3xl font-black tabular-nums">{r ? r.enCurso.total : "–"}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm font-medium text-tenue">Partidas terminadas esta semana</p>
          <p className="mt-1 font-titulo text-3xl font-black tabular-nums">{r ? r.terminadasSemana : "–"}</p>
          {r?.terminadasSemana > 0 && <Link to="/panel/resultados" className="mt-1 inline-block text-sm font-medium text-marca-700 hover:underline">Ver resultados</Link>}
        </Tarjeta>
      </div>

      {enCurso.length > 0 && (
        <section className="mb-10" aria-labelledby="titulo-en-curso">
          <h2 id="titulo-en-curso" className="mb-3 text-lg font-extrabold">Para retomar</h2>
          <ul className="grid gap-2">
            {enCurso.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-borde bg-white px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.titulo || "Actividad"}</span>
                  <span className="text-sm text-tenue">Va en el ejercicio {p.ejercicioActual + 1}</span>
                </span>
                <BotonEnlace to={`/aula/partida/${p.id}`} tamano="sm"><Play className="size-4" aria-hidden="true" /> Continuar</BotonEnlace>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="titulo-recientes">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="titulo-recientes" className="text-lg font-extrabold">Actividades recientes</h2>
          <Link to="/panel/actividades" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-marca-700 hover:underline">
            Ver todas <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {resumen.cargando && !r ? (
          <div className="grid gap-4 sm:grid-cols-3"><Cargando filas={1} alto="h-48" /></div>
        ) : !r ? null : recientes.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recientes.map((j) => <TarjetaActividad key={j.id} juego={j} cursos={cursos.datos || []} />)}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-borde p-6 text-center text-tenue">Aún no tienes actividades. Cuando crees la primera, aparecerá aquí.</p>
        )}
      </section>
    </>
  );
};

export const PaginaCuenta = () => {
  const { docente, actualizar } = useSesion();
  const avisar = useAvisos();
  const cuotas = useConsulta(() => GeneracionApiHttp.cuotas(), []);
  const [datos, setDatos] = useState({ nombre: docente?.nombre || "", institucion: docente?.institucion || "" });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    if (datos.nombre.trim().length < 2) {
      setError({ message: "El nombre necesita al menos 2 letras." });
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await actualizar({ nombre: datos.nombre.trim(), institucion: datos.institucion.trim() || null });
      avisar("Datos guardados.");
    } catch (err) {
      setError(err);
    } finally {
      setEnviando(false);
    }
  };

  const usadas = cuotas.datos ? Math.round((cuotas.datos.diaria?.consumido || 0) + (cuotas.datos.diaria?.reservado || 0)) : null;

  return (
    <>
      <title>Mi cuenta · Letritas</title>
      <Encabezado titulo="Mi cuenta" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Tarjeta>
          <form onSubmit={guardar} noValidate className="grid gap-4">
            <MensajeError error={error} />
            <Campo etiqueta="Nombre" autoComplete="name" value={datos.nombre} onChange={(e) => setDatos((d) => ({ ...d, nombre: e.target.value }))} />
            <Campo etiqueta="Correo" value={docente?.correo || ""} disabled readOnly ayuda="El correo no se puede cambiar por ahora." />
            <Campo etiqueta="Institución" autoComplete="organization" value={datos.institucion} onChange={(e) => setDatos((d) => ({ ...d, institucion: e.target.value }))} />
            <Boton type="submit" cargando={enviando} className="sm:justify-self-start">Guardar cambios</Boton>
          </form>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm font-medium text-tenue">Generaciones con IA hoy</p>
          {usadas === null ? <Cargando filas={1} alto="h-10" /> : (
            <p className="mt-1 font-titulo text-3xl font-black tabular-nums">{usadas} <span className="text-lg font-bold text-tenue">de {cuotas.datos?.limiteDiario ?? 3} usadas</span></p>
          )}
          <p className="mt-2 text-sm text-tenue">El cupo vuelve a {cuotas.datos?.limiteDiario ?? 3} cada día.</p>
        </Tarjeta>
      </div>
    </>
  );
};
