// Los indicadores (§7.3) los calcula el servidor en GET /api/resultados. Aquí solo se presentan:
// siempre numerador y denominador; sin denominador no hay porcentaje.

export const porcentaje = (n, d) => (d ? `${Math.round((n / d) * 100)} %` : "Sin datos");

export const fraccion = (n, d, vacio = "Sin respuestas") => (d ? `${n} de ${d}` : vacio);
