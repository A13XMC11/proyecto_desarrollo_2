// Indicadores de la propuesta, calculados sobre los intentos que el servidor ya evaluó y guardó.
// Siempre numerador y denominador; una partida sin respuestas no tiene porcentaje.
// Pendiente: cuando exista GET /api/resultados, este cálculo pasa al servidor.

export const indicadoresDePartida = (partida) => {
  const porEjercicio = new Map();
  partida.intentos.forEach((i) => {
    const lista = porEjercicio.get(i.ejercicioId) || [];
    lista.push(i);
    porEjercicio.set(i.ejercicioId, lista);
  });
  const conPista = new Set(partida.pistas.map((p) => p.ejercicioId));
  const ejercicios = [...porEjercicio.entries()];

  return {
    respondidos: ejercicios.length,
    primerIntento: ejercicios.filter(([, l]) => l.some((i) => i.numeroIntento === 1 && i.esCorrecto)).length,
    sinAyuda: ejercicios.filter(([id, l]) => l.some((i) => i.esCorrecto) && !conPista.has(id)).length,
    intentosTotales: partida.intentos.length,
    pistas: conPista.size
  };
};

// Agregado por curso o estudiante: solo partidas finalizadas, sin promediar las incompletas
export const indicadoresAgregados = (partidas) =>
  partidas
    .filter((p) => p.estado === "finalizada")
    .map(indicadoresDePartida)
    .reduce(
      (acc, i) => ({
        partidas: acc.partidas + 1,
        respondidos: acc.respondidos + i.respondidos,
        primerIntento: acc.primerIntento + i.primerIntento,
        sinAyuda: acc.sinAyuda + i.sinAyuda,
        intentosTotales: acc.intentosTotales + i.intentosTotales
      }),
      { partidas: 0, respondidos: 0, primerIntento: 0, sinAyuda: 0, intentosTotales: 0 }
    );

export const porcentaje = (n, d) => (d ? `${Math.round((n / d) * 100)} %` : "Sin datos");
