import { useEffect, useRef } from "react";
import { ArrowRight, Lightbulb, PartyPopper, RotateCcw } from "lucide-react";
import { Boton, MensajeError } from "../../../../Infraestructura/ui/componentes";
import { usePartida } from "../../Aplicacion/usePartida";
import { SelectOption } from "./mecanicas/SelectOption";
import { OrderSyllables } from "./mecanicas/OrderSyllables";

// El motor elige el componente según el tipo permitido; nunca ejecuta código generado
const MECANICAS = { seleccionar_opcion: SelectOption, ordenar_silabas: OrderSyllables };

const Progreso = ({ ejercicios, indice }) => (
  <div className="flex items-center gap-3">
    <span className="text-sm font-medium text-tenue">
      {indice + 1} de {ejercicios.length}
    </span>
    <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={ejercicios.length} aria-valuenow={indice + 1} aria-label="Progreso">
      {ejercicios.map((e, i) => (
        <span key={e.id} className={`h-2.5 flex-1 rounded-full transition-colors duration-300 ${i < indice ? "bg-marca-600" : i === indice ? "bg-marca-300" : "bg-marca-100"}`} />
      ))}
    </div>
  </div>
);

const Final = ({ partida, alOtro, alSalir }) => {
  const total = partida.ejercicios.length;
  const primerIntento = partida.ejercicios.filter((e) => e.acertado && e.intentos === 1).length;
  const resueltos = partida.ejercicios.filter((e) => e.acertado).length;
  return (
    <div className="animate-aparecer mx-auto grid max-w-lg justify-items-center text-center">
      <span className="mb-5 grid size-20 place-items-center rounded-full bg-acento/25 text-amber-700">
        <PartyPopper className="size-10" aria-hidden="true" />
      </span>
      <h2 className="text-4xl font-black">¡Terminaste!</h2>
      <p className="mt-3 text-xl text-tenue">
        Resolviste <strong className="text-tinta">{resueltos} de {total}</strong> ejercicios.
      </p>
      <p className="mt-1 text-tenue">{primerIntento} de {total} al primer intento.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Boton tamano="lg" onClick={alOtro}>Que juegue otro estudiante</Boton>
        <Boton tamano="lg" variante="secundario" onClick={alSalir}>Volver al panel</Boton>
      </div>
    </div>
  );
};

export const GamePlayer = ({ partidaId, alOtro, alSalir }) => {
  const { partida, ejercicio, indice, fase, resultado, pista, enviando, error, responder, reintentar, continuar, pedirPista, recargar } = usePartida(partidaId);
  const seccion = useRef(null);

  // Cada vez que toca responder (ejercicio nuevo o "Intentar otra vez"), el foco va a la primera opción:
  // el botón que se pulsó desaparece y, sin esto, quien usa teclado perdería su lugar
  useEffect(() => {
    if (fase !== "respondiendo") return;
    seccion.current?.querySelector("[role=group] button:not([disabled]), [aria-label='Sílabas disponibles'] button:not([disabled])")?.focus({ preventScroll: true });
  }, [fase, ejercicio?.id]);

  if (fase === "cargando") {
    return <div className="mx-auto h-96 w-full max-w-3xl animate-pulse rounded-3xl bg-white/70" role="status" aria-label="Cargando la actividad" />;
  }
  if (fase === "error") return <MensajeError error={error} alReintentar={recargar} />;
  if (fase === "terminada") return <Final partida={partida} alOtro={alOtro} alSalir={alSalir} />;

  const Mecanica = MECANICAS[ejercicio.tipo];
  const bloqueado = enviando || fase !== "respondiendo";

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <Progreso ejercicios={partida.ejercicios} indice={indice} />

      <section ref={seccion} key={ejercicio.id} className="animate-aparecer rounded-[2rem] bg-white p-5 shadow-xl shadow-marca-900/5 ring-1 ring-marca-100 sm:p-10" aria-labelledby="consigna">
        <p id="consigna" className="text-center text-xl text-tenue sm:text-2xl">{ejercicio.consigna}</p>
        {ejercicio.objetivo && ejercicio.tipo === "seleccionar_opcion" && (
          <p className="my-6 text-center font-titulo text-6xl font-black tracking-wide text-marca-900 sm:text-8xl">{ejercicio.objetivo}</p>
        )}
        <div className={ejercicio.tipo === "ordenar_silabas" ? "mt-8" : ""}>
          <Mecanica ejercicio={ejercicio} resultado={resultado} bloqueado={bloqueado} alElegir={responder} alEnviar={responder} />
        </div>

        <div className="mt-8 min-h-14" aria-live="polite">
          {fase === "resuelto" && (
            <div className="animate-aparecer flex flex-col items-center gap-4 [animation-duration:280ms]">
              <p className={`text-center text-2xl font-black ${resultado.esCorrecto ? "text-exito" : "text-marca-800"}`}>
                {resultado.esCorrecto ? (ejercicio.intentos === 1 ? "¡Muy bien!" : "¡Lo lograste!") : "Esta era la respuesta. ¡A la próxima!"}
              </p>
              <Boton tamano="lg" onClick={continuar} autoFocus>
                {partida.ejercicios.length === indice + 1 ? "Ver cómo me fue" : "Siguiente"} <ArrowRight className="size-5" aria-hidden="true" />
              </Boton>
            </div>
          )}
          {fase === "reintentar" && (
            <div className="animate-aparecer flex flex-col items-center gap-4 [animation-duration:280ms]">
              <p className="text-center text-2xl font-black text-marca-800">Casi. Te queda un intento más.</p>
              <Boton tamano="lg" onClick={reintentar} autoFocus>
                <RotateCcw className="size-5" aria-hidden="true" /> Intentar otra vez
              </Boton>
            </div>
          )}
          {fase === "respondiendo" && ejercicio.tienePista && (
            <div className="flex justify-center">
              {pista ? (
                <p className="animate-aparecer flex items-start gap-2 rounded-2xl bg-acento/20 px-5 py-3 text-lg text-amber-900 [animation-duration:280ms]">
                  <Lightbulb className="mt-1 size-5 shrink-0" aria-hidden="true" /> {pista}
                </p>
              ) : (
                <Boton variante="fantasma" onClick={pedirPista} disabled={enviando}>
                  <Lightbulb className="size-5" aria-hidden="true" /> Ver una pista
                </Boton>
              )}
            </div>
          )}
        </div>
      </section>

      {error && <MensajeError error={{ message: error.estado === 0 ? "Se perdió la conexión. Toca la respuesta otra vez; no se contará doble." : error.message }} />}
    </div>
  );
};
