import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";

// Mini-juego de la portada: el visitante prueba un ejercicio de vocal inicial igual al del producto.
// El movimiento reutiliza el vocabulario del juego real (SelectOption): presión 0.97, acierto y sacudida.
const PALABRAS_DEMO = [
  { palabra: "oso", vocal: "O" },
  { palabra: "elefante", vocal: "E" },
  { palabra: "abeja", vocal: "A" },
  { palabra: "oreja", vocal: "O" },
  { palabra: "estrella", vocal: "E" }
];
// Peor caso realista (solo en desarrollo, con ?datos=extremos): palabras reales muy largas, mayúsculas y tildes.
// Se queda como prueba de regresión para la próxima vez que alguien toque la tarjeta.
const PALABRAS_EXTREMAS = [
  { palabra: "electroencefalografista", vocal: "E" },
  { palabra: "ELEFANTE", vocal: "E" },
  { palabra: "anticonstitucionalmente", vocal: "A" },
  { palabra: "otorrinolaringólogo", vocal: "O" },
  { palabra: "árbol", vocal: "A" }
];
const pideDatosExtremos = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("datos") === "extremos";
// DEV va en la misma expresión que la lista: en producción se pliega a PALABRAS_DEMO y la lista extrema no entra al bundle
const palabrasIniciales = () => (import.meta.env.DEV && pideDatosExtremos() ? PALABRAS_EXTREMAS : PALABRAS_DEMO);
const OPCIONES = ["A", "E", "O"];

// Ancho medio de una letra de Nunito Black en em (las mayúsculas son más anchas). Con 100cqi (ancho de la tarjeta)
// la palabra se achica hasta caber en una línea, entre 1.5rem y 3rem.
const tamanoPalabra = (palabra) => {
  const anchoLetra = palabra === palabra.toUpperCase() ? 0.8 : 0.62;
  return `clamp(1.5rem, calc(100cqi / ${(palabra.length * anchoLetra).toFixed(2)}), 3rem)`;
};
const PAUSA_TRAS_ACIERTO_MS = 1300;

// La sacudida se lanza con WAAPI para poder repetirla si el niño vuelve a tocar la misma letra
// (una clase con keyframes no se reinicia si ya está puesta)
const sacudir = (elemento) => {
  if (!elemento || typeof elemento.animate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const curva = getComputedStyle(document.documentElement).getPropertyValue("--ease-movimiento").trim() || "ease-in-out";
  elemento.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(5px)" },
      { transform: "translateX(-3px)" },
      { transform: "translateX(0)" }
    ],
    { duration: 320, easing: curva }
  );
};

const BarraProgreso = ({ total, completados }) => (
  <span className="flex gap-1.5" aria-hidden="true">
    {Array.from({ length: total }, (_, i) => (
      <span key={i} className="h-2 w-6 overflow-hidden rounded-full bg-marca-100">
        {/* Se llena con scaleX (solo transform) desde la izquierda */}
        <span
          className={`block size-full origin-left rounded-full bg-marca-600 transition-transform duration-300 ease-[var(--ease-salida)] motion-reduce:transition-none ${
            i < completados ? "scale-x-100" : "scale-x-0"
          }`}
        />
      </span>
    ))}
  </span>
);

const BotonVocal = ({ letra, estado, deshabilitado, alElegir, refBoton }) => (
  <button
    ref={refBoton}
    type="button"
    onClick={() => alElegir(letra)}
    // aria-disabled y no disabled: un botón deshabilitado pierde el foco y el teclado se queda sin posición
    aria-disabled={deshabilitado || undefined}
    aria-label={`Letra ${letra}`}
    className={`grid h-20 cursor-pointer select-none place-items-center rounded-2xl font-titulo text-4xl font-black transition-[scale,background-color] duration-150 ease-[var(--ease-salida)] active:scale-[0.97] aria-disabled:cursor-default aria-disabled:active:scale-100 ${
      estado === "acierto"
        ? "animate-acierto bg-exito-suave text-exito ring-4 ring-exito"
        : estado === "error"
          ? "bg-error-suave text-error ring-4 ring-error"
          : "bg-marca-50 text-marca-800 ring-1 ring-marca-200 hover:bg-marca-100"
    }`}
  >
    {letra}
  </button>
);

export const TarjetaJuego = () => {
  const [PALABRAS] = useState(palabrasIniciales);
  const [indice, setIndice] = useState(0);
  const [eleccion, setEleccion] = useState(null); // { letra, correcta }
  const [falloEnActual, setFalloEnActual] = useState(false);
  const [alPrimerIntento, setAlPrimerIntento] = useState(0);
  const [resueltos, setResueltos] = useState(0);
  const temporizador = useRef(0);
  const botones = useRef({});
  const botonReiniciar = useRef(null);
  // Solo se mueve el foco si ya estaba dentro de la tarjeta: nunca se lo roba a quien está leyendo el hero
  const focoDentro = useRef(false);

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  // Termina cuando el índice pasa la última palabra (tras la pausa), no al acertarla: el último acierto también se ve
  const terminado = indice >= PALABRAS.length;

  // El botón enfocado desaparece al terminar y al reiniciar: el foco pasa al control que lo reemplaza
  useEffect(() => {
    if (!focoDentro.current) return;
    if (terminado) botonReiniciar.current?.focus();
    else if (indice === 0) botones.current[OPCIONES[0]]?.focus();
  }, [terminado, indice]);
  const actual = PALABRAS[Math.min(indice, PALABRAS.length - 1)];
  const acerto = eleccion?.correcta === true;

  const elegir = (letra) => {
    if (acerto || terminado) return;
    if (letra !== actual.vocal) {
      setEleccion({ letra, correcta: false });
      setFalloEnActual(true);
      sacudir(botones.current[letra]);
      return;
    }
    setEleccion({ letra, correcta: true });
    if (!falloEnActual) setAlPrimerIntento((n) => n + 1);
    setResueltos((n) => n + 1);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => {
      setEleccion(null);
      setFalloEnActual(false);
      setIndice((i) => i + 1);
    }, PAUSA_TRAS_ACIERTO_MS);
  };

  const reiniciar = () => {
    window.clearTimeout(temporizador.current);
    setIndice(0);
    setEleccion(null);
    setFalloEnActual(false);
    setAlPrimerIntento(0);
    setResueltos(0);
  };

  // Los mensajes no repiten la palabra (ya está en grande arriba): así su largo no depende de ella
  // y caben en el espacio reservado sin empujar la tarjeta
  const mensaje = acerto
    ? { tono: "acierto", texto: `¡Muy bien! Empieza con ${actual.vocal}.` }
    : eleccion
      ? { tono: "error", texto: "Casi. Escucha el primer sonido." }
      : null;

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-marca-100 via-marca-50 to-white" aria-hidden="true" />
      <section
        aria-label="Prueba un ejercicio"
        onFocus={() => (focoDentro.current = true)}
        onBlur={(e) => (focoDentro.current = e.currentTarget.contains(e.relatedTarget))}
        className="@container rounded-3xl border border-marca-100 bg-white p-5 shadow-xl shadow-marca-900/5 sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-tenue tabular-nums">
            {terminado ? "¡Terminaste!" : `Ejercicio ${indice + 1} de ${PALABRAS.length}`}
          </span>
          <BarraProgreso total={PALABRAS.length} completados={resueltos} />
        </div>

        {terminado ? (
          <div key="fin" className="animate-aparecer grid min-h-[16.5rem] place-items-center text-center [animation-duration:280ms]">
            <div>
              <p className="font-titulo text-5xl font-black text-marca-900 tabular-nums">
                {alPrimerIntento} de {PALABRAS.length}
              </p>
              <p className="mt-2 text-tenue">al primer intento</p>
              <button
                ref={botonReiniciar}
                type="button"
                onClick={reiniciar}
                className="mt-6 inline-flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-xl bg-marca-600 px-5 font-medium text-white transition-[scale,background-color] duration-150 ease-[var(--ease-salida)] hover:bg-marca-700 active:scale-[0.97]"
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Jugar otra vez
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-center text-tenue">¿Con qué vocal empieza?</p>
            {/* La palabra nueva entra igual que en el juego real; la anterior se va sin animación */}
            {/* Alto fijo de una línea: la tarjeta no cambia de tamaño entre palabras. Las palabras largas reducen su
                tamaño según el ancho de la tarjeta (unidades de contenedor) y, si aun así no caben, cortan con guion. */}
            <div className="my-4 grid min-h-[3.75rem] place-items-center">
              <p
                key={indice}
                lang="es"
                className="animate-aparecer max-w-full text-center font-titulo font-black leading-tight tracking-wide text-marca-900 hyphens-auto [animation-duration:280ms] [overflow-wrap:anywhere]"
                style={{ fontSize: tamanoPalabra(actual.palabra) }}
              >
                {actual.palabra}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {OPCIONES.map((letra) => (
                <BotonVocal
                  key={letra}
                  letra={letra}
                  refBoton={(el) => (botones.current[letra] = el)}
                  estado={eleccion?.letra === letra ? (eleccion.correcta ? "acierto" : "error") : null}
                  deshabilitado={acerto}
                  alElegir={elegir}
                />
              ))}
            </div>
            {/* Espacio reservado para el mensaje: el diseño no salta al aparecer */}
            <div className="mt-4 min-h-[3.25rem]" aria-live="polite">
              {mensaje && (
                <p
                  key={`${indice}-${mensaje.tono}`}
                  className={`animate-aparecer flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center font-medium text-balance [animation-duration:220ms] ${
                    mensaje.tono === "acierto" ? "bg-exito-suave text-exito" : "bg-error-suave text-error"
                  }`}
                >
                  {mensaje.tono === "acierto" && <Check className="size-5 shrink-0" aria-hidden="true" />}
                  {mensaje.texto}
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* Insignia: llega con el primer resultado, no antes (cuenta la historia del ejercicio) */}
      {resueltos > 0 && !terminado && (
        <div
          className="animate-aparecer absolute -bottom-5 -left-3 hidden rounded-2xl bg-white px-4 py-3 text-sm shadow-lg ring-1 ring-borde [animation-duration:300ms] sm:block"
          aria-hidden="true"
        >
          <span className="font-bold text-tinta tabular-nums">
            {alPrimerIntento} de {resueltos}
          </span>
          <span className="text-tenue"> al primer intento</span>
        </div>
      )}
    </div>
  );
};
