import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LogOut, Play } from "lucide-react";
import { Boton, Campo, Cargando, EstadoVacio, Logo, MensajeError, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { Avatar } from "../../../Aula/Infraestructura/ui/Avatar";
import { GamePlayer } from "../../../Partida/Infraestructura/ui/GamePlayer";
import { AccesoApiHttp } from "../AccesoApiHttp";

const canalActual = () => (window.matchMedia("(pointer: coarse)").matches ? "aula_tableta" : "aula_computador");
const ETIQUETAS = { otro: "Jugar otra actividad", salir: "Salir" };

const Marco = ({ estudiante, alSalir, children }) => (
  <div className="flex min-h-dvh flex-col bg-gradient-to-b from-marca-50 to-white">
    <meta name="robots" content="noindex" />
    <title>Jugar · Letritas</title>
    <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
      <Logo />
      {estudiante && (
        <div className="flex items-center gap-3">
          <Avatar id={estudiante.avatarId} />
          <span className="hidden font-titulo font-extrabold text-marca-900 sm:block">{estudiante.apodo || `N.º ${estudiante.codigoLista}`}</span>
          <button type="button" onClick={alSalir} className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-tenue transition-colors hover:bg-white">
            <LogOut className="size-5" aria-hidden="true" /> Salir
          </button>
        </div>
      )}
    </header>
    <main className="flex flex-1 flex-col justify-center px-4 pb-10 sm:px-8">{children}</main>
  </div>
);

const FormularioIngreso = ({ codigoInicial, alEntrar }) => {
  const [codigoAcceso, setCodigoAcceso] = useState(codigoInicial);
  const [codigoLista, setCodigoLista] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      alEntrar(await AccesoApiHttp.ingresar({ codigoAcceso, codigoLista }));
    } catch (err) {
      setError(err);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta className="mx-auto w-full max-w-md p-6 sm:p-8">
      <h1 className="text-center text-3xl font-black">¡A jugar!</h1>
      <p className="mt-2 text-center text-tenue">Escribe el código de tu curso y tu número de lista. Tu profe te los da.</p>
      <form onSubmit={enviar} noValidate className="mt-6 grid gap-4">
        <MensajeError error={error} />
        <Campo etiqueta="Código del curso" requerido autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={9} style={{ textTransform: "uppercase", fontFamily: "ui-monospace, monospace", letterSpacing: "0.15em" }} value={codigoAcceso} onChange={(e) => setCodigoAcceso(e.target.value)} />
        <Campo etiqueta="Tu número de lista" requerido autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={6} style={{ textTransform: "uppercase" }} value={codigoLista} onChange={(e) => setCodigoLista(e.target.value)} />
        <Boton type="submit" tamano="lg" cargando={enviando} disabled={!codigoAcceso.trim() || !codigoLista.trim()}>Entrar</Boton>
      </form>
    </Tarjeta>
  );
};

const ElegirActividad = ({ estudiante, alElegir, iniciando, error }) => {
  const [juegos, setJuegos] = useState(null);
  const [fallo, setFallo] = useState(null);
  useEffect(() => {
    let vigente = true;
    AccesoApiHttp.juegos().then((l) => vigente && setJuegos(l)).catch((e) => vigente && setFallo(e));
    return () => { vigente = false; };
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-center text-3xl font-black sm:text-4xl">¡Hola{estudiante.apodo ? `, ${estudiante.apodo}` : ""}!</h1>
      <p className="mt-2 text-center text-lg text-tenue">¿Qué quieres jugar hoy?</p>
      <div className="mt-6"><MensajeError error={error || fallo} /></div>
      {!juegos && !fallo ? (
        <Cargando filas={2} />
      ) : juegos?.length === 0 ? (
        <EstadoVacio titulo="Todavía no hay actividades" texto="Tu profe aún no ha preparado ninguna. Vuelve más tarde." />
      ) : (
        <ul className="mt-6 flex flex-wrap justify-center gap-4">
          {(juegos || []).map((j) => (
            <li key={j.id} className="w-full sm:w-[calc(50%-0.5rem)]">
              <button type="button" disabled={Boolean(iniciando)} onClick={() => alElegir(j)} className="flex w-full cursor-pointer items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-marca-100 transition-[scale] duration-150 ease-[var(--ease-salida)] hover:shadow-lg active:scale-[0.97] disabled:opacity-60">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-marca-100 text-marca-700"><Play className="size-6" aria-hidden="true" /></span>
                <span>
                  <span className="block font-titulo text-xl font-extrabold">{j.titulo}</span>
                  <span className="text-sm text-tenue">{iniciando === j.id ? "Preparando…" : j.partidaEnCurso ? "Continuar" : "Empezar"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const PaginaJugar = () => {
  const [parametros] = useSearchParams();
  const [estudiante, setEstudiante] = useState(undefined); // undefined: comprobando; null: sin sesión
  const [partidaId, setPartidaId] = useState(null);
  const [iniciando, setIniciando] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0); // fuerza recargar la lista al volver de una partida

  // Si ya había sesión (recarga de la página) se retoma; esta llamada también recupera el token CSRF
  useEffect(() => {
    AccesoApiHttp.yo().then(setEstudiante).catch(() => setEstudiante(null));
  }, []);

  const salir = useCallback(async () => {
    await AccesoApiHttp.salir().catch(() => {});
    setPartidaId(null);
    setEstudiante(null);
  }, []);

  const elegir = async (juego) => {
    if (juego.partidaEnCurso) return setPartidaId(juego.partidaEnCurso);
    setIniciando(juego.id);
    setError(null);
    try {
      setPartidaId((await AccesoApiHttp.iniciar({ juegoId: juego.id, canal: canalActual() })).id);
    } catch (e) {
      if (e.estado === 401) setEstudiante(null);
      setError(e);
    } finally {
      setIniciando(null);
    }
  };

  const volverALista = () => {
    setPartidaId(null);
    setVersion((v) => v + 1);
  };

  return (
    <Marco estudiante={estudiante} alSalir={salir}>
      {estudiante === undefined ? (
        <Cargando filas={2} />
      ) : !estudiante ? (
        <FormularioIngreso codigoInicial={(parametros.get("codigo") || "").toUpperCase()} alEntrar={setEstudiante} />
      ) : partidaId ? (
        <GamePlayer key={partidaId} partidaId={partidaId} api={AccesoApiHttp} etiquetas={ETIQUETAS} alSalir={salir} alOtro={volverALista} />
      ) : (
        <ElegirActividad key={version} estudiante={estudiante} alElegir={elegir} iniciando={iniciando} error={error} />
      )}
    </Marco>
  );
};
