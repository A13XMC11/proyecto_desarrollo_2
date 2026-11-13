import { useCallback, useEffect, useRef, useState } from "react";
import { nuevoIdOperacion } from "../../../Infraestructura/http/clienteHttp";
import { PartidaApiHttp } from "../Infraestructura/PartidaApiHttp";

// Estado de una partida en el aula. El servidor decide si una respuesta es correcta y cuándo se avanza;
// aquí solo se refleja lo que responde. Cada envío lleva un operacionId: si la red falla y se reintenta,
// se reutiliza el mismo y el intento no cuenta dos veces.
//
// fases: cargando | respondiendo | reintentar | resuelto | terminada | error
export const usePartida = (partidaId) => {
  const [partida, setPartida] = useState(null);
  const [indice, setIndice] = useState(0);
  const [fase, setFase] = useState("cargando");
  const [resultado, setResultado] = useState(null); // { esCorrecto, eleccion, solucion }
  const [pista, setPista] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const siguiente = useRef(null); // { ejercicioActual, terminada } que devolvió el servidor
  const operacionPendiente = useRef(null); // { clave, id } para reintentos tras un fallo de red

  const cargar = useCallback(async () => {
    setFase("cargando");
    setError(null);
    try {
      const datos = await PartidaApiHttp.jugable(partidaId);
      setPartida(datos);
      setIndice(Math.min(datos.ejercicioActual, datos.ejercicios.length - 1));
      setFase(datos.estado === "en_curso" ? "respondiendo" : "terminada");
    } catch (e) {
      setError(e);
      setFase("error");
    }
  }, [partidaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejercicio = partida?.ejercicios[indice];

  const idOperacion = (clave) => {
    if (operacionPendiente.current?.clave !== clave) operacionPendiente.current = { clave, id: nuevoIdOperacion() };
    return operacionPendiente.current.id;
  };

  const actualizarEjercicio = (cambios) =>
    setPartida((p) => ({ ...p, ejercicios: p.ejercicios.map((e, i) => (i === indice ? { ...e, ...cambios } : e)) }));

  const responder = async (eleccion) => {
    if (!ejercicio || enviando || fase !== "respondiendo") return;
    setEnviando(true);
    setError(null);
    try {
      const r = await PartidaApiHttp.intento(partidaId, {
        ejercicioId: ejercicio.id,
        eleccion,
        operacionId: idOperacion(`intento:${ejercicio.id}:${ejercicio.intentos}`)
      });
      operacionPendiente.current = null;
      actualizarEjercicio({ intentos: r.numeroIntento, acertado: r.esCorrecto, ...(r.solucion && { solucion: r.solucion }) });
      setResultado({ esCorrecto: r.esCorrecto, eleccion, solucion: r.solucion });
      siguiente.current = { ejercicioActual: r.ejercicioActual, terminada: r.terminada };
      setFase(r.esCorrecto || r.solucion ? "resuelto" : "reintentar");
    } catch (e) {
      setError(e);
      if (e.codigo === "PARTIDA_TERMINADA") setFase("terminada");
      else if (e.codigo === "EJERCICIO_NO_ACTUAL" || e.codigo === "INTENTOS_AGOTADOS") cargar();
    } finally {
      setEnviando(false);
    }
  };

  const reintentar = () => {
    setResultado(null);
    setFase("respondiendo");
  };

  const continuar = () => {
    const s = siguiente.current;
    setResultado(null);
    setPista(null);
    if (!s || s.terminada) {
      setPartida((p) => ({ ...p, estado: "finalizada" }));
      setFase("terminada");
    } else {
      setIndice(s.ejercicioActual);
      setFase("respondiendo");
    }
  };

  const pedirPista = async () => {
    if (!ejercicio?.tienePista || pista || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await PartidaApiHttp.pista(partidaId, { ejercicioId: ejercicio.id, operacionId: idOperacion(`pista:${ejercicio.id}`) });
      operacionPendiente.current = null;
      setPista(r.pista);
      actualizarEjercicio({ usoPista: true });
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };

  return { partida, ejercicio, indice, fase, resultado, pista, enviando, error, responder, reintentar, continuar, pedirPista, recargar: cargar };
};
