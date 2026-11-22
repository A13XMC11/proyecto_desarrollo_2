import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, Lightbulb, RotateCcw } from "lucide-react";
import { Boton } from "../../../../Infraestructura/ui/componentes";
import { Dialogo } from "../../../../Infraestructura/ui/Dialogo";
import { SelectOption } from "../../../Partida/Infraestructura/ui/mecanicas/SelectOption";
import { OrderSyllables } from "../../../Partida/Infraestructura/ui/mecanicas/OrderSyllables";
import { ObjetivoGrande } from "../../../Partida/Infraestructura/ui/ObjetivoGrande";
import { MAXIMO_INTENTOS, aVistaPrevia, esCorrecta } from "../../Dominio/VistaPrevia";

// Las mismas mecánicas del modo aula, para que el docente vea exactamente lo que verá el estudiante
const MECANICAS = { seleccionar_opcion: SelectOption, ordenar_silabas: OrderSyllables };

const Contenido = ({ ejercicios }) => {
  const [indice, setIndice] = useState(0);
  const [intentos, setIntentos] = useState(0);
  const [resultado, setResultado] = useState(null); // { esCorrecto, eleccion, solucion? }
  const [verPista, setVerPista] = useState(false);

  const seccion = useRef(null);
  const siguiente = useRef(null);
  const repetir = useRef(null);

  const ejercicio = ejercicios[indice];
  const Mecanica = MECANICAS[ejercicio.tipo];
  const agotado = resultado && !resultado.esCorrecto && intentos >= MAXIMO_INTENTOS;
  const fase = !resultado ? "respondiendo" : resultado.esCorrecto || agotado ? "resuelto" : "reintentar";
  const ultimo = indice === ejercicios.length - 1;

  // Al responder, el botón pulsado queda desactivado y el foco se perdería: se lleva al siguiente paso
  useEffect(() => {
    if (fase === "resuelto") (ultimo ? repetir : siguiente).current?.focus();
  }, [fase, ultimo]);

  // Tras "Intentar otra vez" el foco vuelve a la primera opción del ejercicio
  const reintentar = () => {
    setResultado(null);
    requestAnimationFrame(() => seccion.current?.querySelector("[role=group] button:not([disabled]), [aria-label='Sílabas disponibles'] button")?.focus());
  };

  const ir = (nuevo) => {
    setIndice(nuevo);
    setIntentos(0);
    setResultado(null);
    setVerPista(false);
  };

  const responder = (eleccion) => {
    const acierto = esCorrecta(ejercicio, eleccion);
    const usados = intentos + 1;
    setIntentos(usados);
    setResultado({
      esCorrecto: acierto,
      eleccion,
      ...(!acierto && usados >= MAXIMO_INTENTOS && { solucion: ejercicio.respuesta })
    });
  };

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-tenue">{indice + 1} de {ejercicios.length}</span>
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {ejercicios.map((e, i) => (
            <span key={e.id} className={`h-2.5 flex-1 rounded-full ${i < indice ? "bg-marca-600" : i === indice ? "bg-marca-300" : "bg-marca-100"}`} />
          ))}
        </div>
      </div>

      <section ref={seccion} key={`${ejercicio.id}-${indice}`} className="animate-aparecer rounded-[2rem] bg-white p-5 ring-1 ring-marca-100 sm:p-8" aria-labelledby="previa-consigna">
        <p id="previa-consigna" className="text-center text-xl text-tenue sm:text-2xl">{ejercicio.consigna}</p>
        {ejercicio.tipo === "seleccionar_opcion" && <ObjetivoGrande objetivo={ejercicio.objetivo} icono={ejercicio.icono} tamano="sm:text-7xl" />}
        <div className={ejercicio.tipo === "ordenar_silabas" ? "mt-8" : ""}>
          <Mecanica ejercicio={ejercicio} resultado={resultado} bloqueado={fase !== "respondiendo"} alElegir={responder} alEnviar={responder} />
        </div>

        <div className="mt-6 min-h-14" aria-live="polite">
          {fase === "resuelto" && (
            <p className={`text-center text-2xl font-black ${resultado.esCorrecto ? "text-exito" : "text-marca-800"}`}>
              {resultado.esCorrecto ? (intentos === 1 ? "¡Muy bien!" : "¡Lo lograste!") : "Esta era la respuesta. ¡A la próxima!"}
            </p>
          )}
          {fase === "reintentar" && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-center text-2xl font-black text-marca-800">Casi. Te queda un intento más.</p>
              <Boton onClick={reintentar} autoFocus><RotateCcw className="size-5" aria-hidden="true" /> Intentar otra vez</Boton>
            </div>
          )}
          {fase === "respondiendo" && ejercicio.pista && (
            <div className="flex justify-center">
              {verPista ? (
                <p className="flex items-start gap-2 rounded-2xl bg-acento/20 px-5 py-3 text-lg text-amber-900">
                  <Lightbulb className="mt-1 size-5 shrink-0" aria-hidden="true" /> {ejercicio.pista}
                </p>
              ) : (
                <Boton variante="fantasma" onClick={() => setVerPista(true)}>
                  <Lightbulb className="size-5" aria-hidden="true" /> Ver una pista
                </Boton>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Boton variante="secundario" disabled={indice === 0} onClick={() => ir(indice - 1)}>
          <ArrowLeft className="size-5" aria-hidden="true" /> Anterior
        </Boton>
        <Boton ref={repetir} variante="fantasma" onClick={() => ir(indice)} disabled={!resultado && !verPista}>
          <RotateCcw className="size-5" aria-hidden="true" /> Repetir
        </Boton>
        <Boton ref={siguiente} disabled={ultimo} onClick={() => ir(indice + 1)}>
          Siguiente <ArrowRight className="size-5" aria-hidden="true" />
        </Boton>
      </div>
    </div>
  );
};

// ejercicios: contrato del servidor (los del borrador que se está editando o los de una versión aprobada)
export const VistaPrevia = ({ ejercicios, alCerrar }) => {
  // Se mezcla una vez al abrir, como hace el aula al iniciar una partida
  const [jugables, setJugables] = useState(null);
  useEffect(() => {
    setJugables(ejercicios ? aVistaPrevia(ejercicios) : null);
  }, [ejercicios]);

  return (
    <Dialogo abierto={Boolean(ejercicios)} alCerrar={alCerrar} titulo="Vista previa" ancho="max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <p className="-mt-3 mb-5 flex items-center gap-2 text-sm text-tenue">
        <Eye className="size-4 shrink-0" aria-hidden="true" /> Así lo verá el estudiante. Puedes responder para probar; nada de esto se guarda.
      </p>
      {jugables && jugables.length > 0 && <Contenido ejercicios={jugables} />}
    </Dialogo>
  );
};
