// Carga, con una consulta por juego y por versión distintos (no por partida), lo que las consultas de resultados necesitan
async function cargarJuegos(juegoRepository, docenteId, sesiones) {
  const ids = [...new Set(sesiones.map((s) => s.juegoId))];
  const juegos = await Promise.all(ids.map((id) => juegoRepository.findById(id, docenteId)));
  return new Map(juegos.filter(Boolean).map((j) => [j.id, j]));
}

async function cargarVersiones(versionRepository, sesiones) {
  const pares = new Map(sesiones.map((s) => [s.versionId, s.juegoId]));
  const versiones = await Promise.all([...pares].map(([versionId, juegoId]) => versionRepository.findById(versionId, juegoId)));
  return new Map(versiones.filter(Boolean).map((v) => [v.id, v]));
}

module.exports = { cargarJuegos, cargarVersiones };
