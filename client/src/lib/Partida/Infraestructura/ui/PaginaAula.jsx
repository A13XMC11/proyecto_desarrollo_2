import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { Cargando, Logo, MensajeError } from "../../../../Infraestructura/ui/componentes";
import { useConsulta } from "../../../../Infraestructura/http/useConsulta";
import { useSesion } from "../../../Docente/Aplicacion/SesionContexto";
import { Avatar } from "../../../Aula/Infraestructura/ui/Avatar";
import { AulaApiHttp } from "../../../Aula/Infraestructura/AulaApiHttp";
import { JuegoApiHttp } from "../../../Juego/Infraestructura/JuegoApiHttp";
import { PartidaApiHttp } from "../PartidaApiHttp";
import { indexarEnCurso } from "../../Dominio/PartidasEnCurso";
import { GamePlayer } from "./GamePlayer";

// Canal según el dispositivo: pantalla táctil grande = tableta
const canalActual = () => (window.matchMedia("(pointer: coarse)").matches ? "aula_tableta" : "aula_computador");

// Modo aula: pantalla simplificada. El estudiante ve solo el juego; los nombres de otros
// estudiantes aparecen únicamente en el paso de elegir quién juega, que maneja el docente.
const MarcoAula = ({ titulo, children, alSalir }) => (
  <div className="flex min-h-dvh flex-col bg-gradient-to-b from-marca-50 to-white">
    <meta name="robots" content="noindex" />
    <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
      <Logo />
      <p className="hidden truncate font-titulo text-lg font-extrabold text-marca-900 sm:block">{titulo}</p>
      <button type="button" onClick={alSalir} className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-tenue transition-colors hover:bg-white">
        <X className="size-5" aria-hidden="true" /> Salir
      </button>
    </header>
    <main className="flex flex-1 flex-col justify-center px-4 pb-10 sm:px-8">{children}</main>
  </div>
);

const ElegirEstudiante = ({ juego, alElegir, iniciando }) => {
  const consulta = useConsulta(async () => {
    const [estudiantes, enCurso] = await Promise.all([
      AulaApiHttp.listarEstudiantes({ cursoId: juego.cursoId, archivado: false }),
      PartidaApiHttp.listar({ estado: "en_curso", cursoId: juego.cursoId })
    ]);
    return {
      estudiantes: juego.estudianteId ? estudiantes.filter((e) => e.id === juego.estudianteId) : estudiantes,
      enCurso: indexarEnCurso(enCurso, juego.id)
    };
  }, [juego.id]);

  if (consulta.cargando && !consulta.datos) return <Cargando filas={2} />;
  if (consulta.error) return <MensajeError error={consulta.error} alReintentar={consulta.recargar} />;
  const { estudiantes, enCurso } = consulta.datos;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-center text-3xl font-black sm:text-4xl">¿Quién va a jugar?</h1>
      <p className="mt-2 text-center text-lg text-tenue">{juego.titulo}</p>
      {estudiantes.length === 0 ? (
        <p className="mt-10 text-center text-tenue">Este curso no tiene estudiantes activos. Agrégalos en Cursos y estudiantes.</p>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...estudiantes]
            .sort((a, b) => a.codigoLista.localeCompare(b.codigoLista, "es", { numeric: true }))
            .map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={Boolean(iniciando)}
                  onClick={() => alElegir(e, enCurso.get(e.id))}
                  className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-marca-100 transition-[scale] duration-150 ease-[var(--ease-salida)] hover:shadow-lg active:scale-[0.97] disabled:opacity-60"
                >
                  <Avatar id={e.avatarId} tamano="size-16" />
                  <span className="font-titulo text-xl font-extrabold">{e.apodo || e.codigoLista}</span>
                  <span className="text-sm text-tenue">{iniciando === e.id ? "Preparando…" : enCurso.has(e.id) ? "Continuar partida" : `N.º ${e.codigoLista}`}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
};

export const PaginaAula = () => {
  const { juegoId, partidaId: partidaDeRuta } = useParams();
  const navegar = useNavigate();
  const { docente } = useSesion();
  const juego = useConsulta(() => (juegoId ? JuegoApiHttp.obtener(juegoId) : Promise.resolve(null)), [juegoId]);
  const [partidaId, setPartidaId] = useState(partidaDeRuta || null);
  const [iniciando, setIniciando] = useState(null);
  const [error, setError] = useState(null);

  if (!docente) return <Navigate to="/ingresar" replace />;

  const salir = () => navegar(juegoId ? `/panel/actividades/${juegoId}` : "/panel");

  // Si ya hay una partida en curso de ese estudiante en este juego, se reanuda en lugar de duplicarla.
  // Si la pantalla ya la conoce se abre directo (sin pedir una nueva que el servidor rechazaría con 409).
  const elegir = async (estudiante, partidaEnCurso) => {
    if (partidaEnCurso) {
      setError(null);
      setPartidaId(partidaEnCurso);
      return;
    }
    setIniciando(estudiante.id);
    setError(null);
    try {
      const partida = await PartidaApiHttp.iniciar({ estudianteId: estudiante.id, juegoId, canal: canalActual() });
      setPartidaId(partida.id);
    } catch (e) {
      if (e.codigo === "PARTIDA_EN_CURSO_EXISTENTE") {
        const enCurso = await PartidaApiHttp.listar({ estado: "en_curso", estudianteId: estudiante.id });
        const existente = enCurso.find((p) => p.juegoId === juegoId);
        if (existente) setPartidaId(existente.id);
        else setError(e);
      } else setError(e);
    } finally {
      setIniciando(null);
    }
  };

  const titulo = juego.datos?.titulo || "";

  return (
    <MarcoAula titulo={titulo} alSalir={salir}>
      <title>{`${titulo || "Modo aula"} · Letritas`}</title>
      <MensajeError error={error || juego.error} />
      {partidaId ? (
        <GamePlayer key={partidaId} partidaId={partidaId} alSalir={salir} alOtro={() => (juegoId ? setPartidaId(null) : salir())} />
      ) : juego.cargando ? (
        <Cargando filas={2} />
      ) : juego.datos?.estado !== "listo" ? (
        <MensajeError error={{ message: "Esta actividad todavía no está aprobada. Apruébala desde su página para poder jugarla." }} />
      ) : (
        <ElegirEstudiante juego={juego.datos} alElegir={elegir} iniciando={iniciando} />
      )}
    </MarcoAula>
  );
};
