// Partida en curso de cada estudiante en un juego (estudianteId -> partidaId). Una sola por estudiante y juego.
export const indexarEnCurso = (partidas, juegoId) =>
  new Map(partidas.filter((p) => p.juegoId === juegoId).map((p) => [p.estudianteId, p.id]));
