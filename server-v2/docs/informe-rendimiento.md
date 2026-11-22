# Informe de rendimiento y capacidad (S5-08)

Cubre RNF-001 y RNF-002 con un escenario documentado. **Todas las cifras salen de ejecutar
`npm run medir:rendimiento`** (código en `scripts/medirRendimiento.js`); no hay valores estimados ni copiados de otra parte.
Son mediciones **locales**: sirven para detectar cuellos de botella y comparar, no para prometer tiempos en producción.
Falta repetirlas sobre la versión publicada (ver §6).

## 1. Escenario

| | |
|---|---|
| Máquina | Apple M1 Max, 10 núcleos, 64 GB de RAM, macOS, Node v26.11.1 |
| Cómo corre | La API, PostgreSQL, MongoDB y el generador de carga están en la **misma máquina**; sin red real ni HTTPS |
| Datos | Ficticios, en las bases de pruebas (se vacían en cada corrida). Un curso por docente con estudiantes que juegan cada juego una vez (partidas de 5 ejercicios, con aciertos y fallos) |
| Lecturas | 100 peticiones en serie y 90 con 30 en vuelo a la vez, repartidas entre las cuentas |
| Aula | Todos los estudiantes de una cuenta inician y completan una partida de 5 ejercicios **a la vez** (un tercio falla una vez antes de acertar) |
| Repetición | Cada escenario se ejecutó **2 veces** (resultados en §3) |
| Escenarios | **Base:** 3 docentes × 30 estudiantes × 6 juegos (210 partidas por cuenta; aula de 30). **Volumen:** 2 docentes × 60 estudiantes × 12 juegos (780 partidas por cuenta; aula de 60) |

El tamaño del aula y la carga simultánea **no están acordados con el docente piloto** (el plan lo pide en S5-08): 30 es un
supuesto de aula, a confirmar en S5-07.

## 2. Resultados (segunda corrida)

### Escenario base
## Lecturas en serie (sin competencia)

| Operación | Peticiones | Errores | P50 (ms) | P95 (ms) | Máx. (ms) |
|---|---|---|---|---|---|
| Biblioteca (GET /api/juegos) | 100 | 0 | 1.0 | 1.4 | 2.6 |
| Biblioteca filtrada (habilidad + texto) | 100 | 0 | 1.1 | 1.5 | 2.8 |
| Inicio (GET /api/inicio) | 100 | 0 | 1.4 | 2.0 | 3.3 |
| Resultados del docente (GET /api/resultados) | 100 | 0 | 5.6 | 6.5 | 9.9 |
| Resultados de un curso | 100 | 0 | 5.5 | 6.2 | 7.7 |

## Lecturas con 30 peticiones simultáneas

| Operación | Peticiones | Errores | P50 (ms) | P95 (ms) | Máx. (ms) |
|---|---|---|---|---|---|
| Biblioteca (GET /api/juegos) | 90 | 0 | 9.9 | 35.4 | 39.3 |
| Biblioteca filtrada (habilidad + texto) | 90 | 0 | 12.2 | 18.6 | 24.4 |
| Inicio (GET /api/inicio) | 90 | 0 | 22.4 | 28.7 | 32.1 |
| Resultados del docente (GET /api/resultados) | 90 | 0 | 129.7 | 183.9 | 219.2 |
| Resultados de un curso | 90 | 0 | 129.6 | 153.3 | 213.2 |

## Aula: 30 estudiantes a la vez

| Operación | Peticiones | Errores | P50 (ms) | P95 (ms) | Máx. (ms) |
|---|---|---|---|---|---|
| Iniciar partida | 30 | 0 | 29.4 | 40.2 | 43.3 |
| Registrar intento | 180 | 0 | 22.8 | 27.8 | 29.2 |

### Escenario de volumen
## Lecturas en serie (sin competencia)

| Operación | Peticiones | Errores | P50 (ms) | P95 (ms) | Máx. (ms) |
|---|---|---|---|---|---|
| Biblioteca (GET /api/juegos) | 100 | 0 | 0.9 | 1.3 | 2.9 |
| Biblioteca filtrada (habilidad + texto) | 100 | 0 | 1.0 | 1.4 | 2.5 |
| Inicio (GET /api/inicio) | 100 | 0 | 1.6 | 2.3 | 5.9 |
| Resultados del docente (GET /api/resultados) | 100 | 0 | 15.2 | 16.1 | 21.3 |
| Resultados de un curso | 100 | 0 | 15.2 | 16.1 | 17.5 |

## Lecturas con 30 peticiones simultáneas

| Operación | Peticiones | Errores | P50 (ms) | P95 (ms) | Máx. (ms) |
|---|---|---|---|---|---|
| Biblioteca (GET /api/juegos) | 90 | 0 | 10.8 | 40.2 | 43.8 |
| Biblioteca filtrada (habilidad + texto) | 90 | 0 | 11.9 | 18.7 | 25.0 |
| Inicio (GET /api/inicio) | 90 | 0 | 22.9 | 31.8 | 36.9 |
| Resultados del docente (GET /api/resultados) | 90 | 0 | 437.2 | 539.2 | 671.3 |
| Resultados de un curso | 90 | 0 | 403.1 | 587.0 | 780.3 |

## Aula: 60 estudiantes a la vez

| Operación | Peticiones | Errores | P50 (ms) | P95 (ms) | Máx. (ms) |
|---|---|---|---|---|---|
| Iniciar partida | 60 | 0 | 59.2 | 129.0 | 148.4 |
| Registrar intento | 360 | 0 | 42.9 | 47.9 | 155.7 |

## 3. Repetibilidad

Latencia de **resultados del docente**, P50 / P95 en ms (corrida 1 y corrida 2):

| Escenario | Carga | Corrida 1 | Corrida 2 |
|---|---|---|---|
| Base: 210 partidas | en serie | 5.8 / 6.6 | 5.6 / 6.5 |
| Base: 210 partidas | 30 simultáneas | 134.5 / 169.2 | 129.7 / 183.9 |
| Volumen: 780 partidas | en serie | 15.3 / 16.4 | 15.2 / 16.1 |
| Volumen: 780 partidas | 30 simultáneas | 429.1 / 526.5 | 437.2 / 539.2 |

Las dos corridas coinciden en orden de magnitud y tendencia. Con solo dos muestras no se calcula una dispersión: es una
comprobación de que el resultado no es un accidente.

## 4. Uso de índices (S5-03: «las consultas usan índice»)

## Uso de índices (explain de MongoDB)

| Consulta | Usa índice | Recorre toda la colección | Documentos examinados | Devueltos |
|---|---|---|---|---|
| Biblioteca (docente, no archivadas, orden por fecha) | sí | no | 13 | 13 |
| Biblioteca filtrada por curso | sí | no | 13 | 13 |
| Resultados por curso (docente, curso, orden por fecha) | sí | no | 780 | 780 |
| Inicio: partidas en curso | sí | no | 0 | 0 |
| Inicio: conteo de terminadas en la semana | sí | no | 780 | 780 |

Ninguna de las consultas del inicio, la biblioteca ni los resultados recorre la colección completa: todas usan alguno
de los índices declarados en los modelos.

## 5. Lectura de los resultados

- **Biblioteca e inicio:** respuesta de pocos milisegundos en serie y por debajo de ~45 ms de P95 con 30 peticiones a la vez, en ambos volúmenes.
- **Aula:** con 30 estudiantes a la vez, registrar un intento tiene P95 de unos 28 ms y no hubo errores. Con 60 sube a ~48 ms (algunos picos de ~160 ms), también sin errores. **Iniciar la partida es el paso más lento al arrancar un aula grande**: P95 de ~40 ms con 30 alumnos y ~129 ms con 60, cuando todos pulsan «jugar» a la vez.
- **Resultados es el punto que más crece.** Pasa de ~6 ms (210 partidas) a ~15 ms (780 partidas) en serie, y con 30 consultas simultáneas de ~130 ms a ~430 ms de P50 (P95 de 184 a 539 ms). Crece de forma aproximadamente proporcional a las partidas: el servidor trae las partidas (hasta 2000, `LIMITE_RESULTADOS`) y calcula los indicadores en memoria.
  - **No se midió el caso de 2000 partidas por cuenta**, que es el máximo que el servidor procesa. Por lo observado cabe esperar que sea bastante peor, pero esto es una extrapolación, no una medición.
  - Es poco probable que 30 docentes consulten resultados al mismo tiempo; la carga simultánea de resultados es más severa que el uso real previsto.
  - Si en la versión publicada supera el umbral propuesto, la mejora natural es agregar en MongoDB en lugar de en Node. No se hizo: es parte del código de S5-03 y no hay evidencia aún de que haga falta.

## 6. Umbrales propuestos (a acordar con el docente piloto)

Son **propuestas**, no requisitos medidos. Criterio: una acción del estudiante debe sentirse inmediata y una consulta del docente no debe hacerle perder el hilo.

| Operación | Umbral propuesto (P95, versión publicada, 30 simultáneas) | Observado en local (P95) |
|---|---|---|
| Registrar intento | ≤ 300 ms | 28 ms (30 alumnos), 48 ms (60) |
| Iniciar partida | ≤ 300 ms | 40 ms (30 alumnos), 129 ms (60) |
| Biblioteca, inicio | ≤ 300 ms | ≤ 45 ms |
| Resultados | ≤ 1000 ms | 184 ms (base), 539 ms (volumen) |
| Errores 5xx en cualquiera | 0 | 0 |

## 7. Limitaciones

- Solo medición local: sin latencia de internet, sin TLS, con cliente y servidor compitiendo por la misma máquina y un equipo potente. En un alojamiento gratuito o pequeño los tiempos serán mayores.
- Dos corridas por escenario; datos ficticios y homogéneos (todos los estudiantes juegan lo mismo).
- No se midió la generación con IA (depende del proveedor y se mide en S4-06) ni el navegador del estudiante.
- Aula medida con una sola cuenta de docente; el plan no define cuántas aulas usan el sistema a la vez.

## 8. Cómo repetirlo en la versión publicada

```bash
cd server-v2
# Local, bases de pruebas (nombre con «test»), datos ficticios:
npm run medir:rendimiento
# Versión publicada, solo lectura, con una cuenta de prueba:
RENDIMIENTO_CORREO=cuenta@escuela.ec RENDIMIENTO_CONTRASENA=... npm run medir:rendimiento -- --url=https://mi-sitio
```

En modo remoto no siembra ni crea partidas; mide biblioteca, inicio y resultados de la cuenta indicada, así que
para que el resultado sea comparable esa cuenta debe tener un volumen de partidas conocido.
