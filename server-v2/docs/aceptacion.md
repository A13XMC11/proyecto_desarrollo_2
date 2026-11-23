# Aceptación del sprint 6 (S6-01)

Lista de resultados y evidencias contra los **criterios de cierre del plan (§15)**. Estado a la fecha de redacción; lo marcado
«pendiente» depende de la publicación o de personas, no de código. Cómo reproducir todo lo automático:

```bash
cd server-v2
npm test                              # 320 pruebas, con PostgreSQL y MongoDB de pruebas
node --test tests/aceptacion/         # solo la aceptación
npm run probar:respaldo               # respaldo y restauración (ver recuperacion.md)
npm run revisar:configuracion -- --solo-repositorio
```

## 1. Criterios de cierre

| # | Criterio del plan | Estado | Evidencia |
|---|---|---|---|
| 1 | El recorrido completo pasa en la URL final | **Pendiente** | Falta la versión publicada (S5-06/S6-06). En local pasa: `tests/aceptacion/recorrido.test.js` («recorrido completo…», «sílabas…») y un recorrido real en navegador (§2). Para la URL final: `npm run verificar:despliegue` y repetir §2 |
| 2 | Dos cuentas de docente no pueden acceder a datos de la otra | **Cumplido** | `recorrido.test.js` «dos cuentas…»: 6 lecturas de ids ajenos → 404, 4 escrituras ajenas → 404, listados y resultados vacíos, ni filtrando por el curso ajeno |
| 3 | Tras reiniciar el servidor se conservan las actividades y una partida en curso se puede reanudar | **Cumplido** | `recorrido.test.js` «reinicio del servidor…»: se cierra el servidor y se levanta otro; la sesión (cookie y token CSRF) sigue válida, la biblioteca intacta, la partida sigue en curso con lo respondido, el inicio ofrece retomarla, volver a iniciar se rechaza (`PARTIDA_EN_CURSO_EXISTENTE`) y se puede terminar |
| 4 | Las actividades guardadas funcionan si se deshabilita la generación | **Cumplido** | «con la generación deshabilitada…»: la solicitud se rechaza con 503 `GENERACION_DESHABILITADA`, y tres estudiantes juegan la actividad guardada completa |
| 5 | Repetir una actividad no aumenta el contador de solicitudes de IA | **Cumplido** | La misma prueba: tras jugar 3 veces, el número de solicitudes de IA y el cupo diario no cambian |
| 6 | Los resultados coinciden con el historial de respuestas | **Cumplido** | «los resultados coinciden…»: un guion conocido (pista, fallos, intentos agotados) da exactamente 5/2/3/8/1/5/5 (respondidos, primer intento, sin ayuda, intentos, pistas, completados, disponibles) y se recalcula aparte desde el historial crudo de la partida |
| 7 | Se documentaron límites, consumo observado y problemas conocidos | **Cumplido, con una laguna** | `limites-y-problemas-conocidos.md`, `informe-rendimiento.md`. **Laguna:** el consumo de IA real no se ha medido (S4-06) |
| 8 | La verificación de capas pasa: `Dominio` y `Aplicacion` no dependen de Express, Mongoose ni del proveedor de IA, y no hay ciclos | **Cumplido** | `tests/arquitectura/capas.test.js` (8 pruebas, incluida una que comprueba que el escáner detecta una violación sintética) |
| 9 | Una base vacía queda lista solo con las migraciones; índices únicos y validación presentes | **Cumplido con una variante** | El proyecto es *code first*: no hay migraciones numeradas, el esquema sale de los modelos al arrancar. `tests/aceptacion/baseDesdeCero.test.js` arranca el **servidor real** sobre PostgreSQL y MongoDB vacíos con `SQL_SYNC_ALTER=false` y comprueba las 7 tablas, todos los índices declarados (únicos y parciales), el TTL de sesiones y los 4 canales. La validación vive en los modelos, no en `$jsonSchema`. Ver `recuperacion.md` §1 |
| 10 | Ambos integrantes pueden explicar frontend, API, datos e IA | **Pendiente (personas)** | Apoyo: `arquitectura.md` y `manual-docente.md`. Lo verifican ustedes, p. ej. en el ensayo de la demostración |

## 2. Recorrido en navegador real (local, datos de demostración)

Se levantaron la API y el cliente (Vite) contra bases de pruebas con `npm run sembrar:demo`, y se recorrió con un navegador
automatizado: ingresar → inicio → resultados → cursos → crear con IA → cuenta → biblioteca → borrador (editor y vista
previa) → aula (reanudar la partida a medias y responder).

- **0 errores y 0 avisos en la consola** en todo el recorrido.
- Todas las llamadas a la API respondieron 200 (los `ERR_ABORTED` observados son peticiones canceladas al cambiar de pantalla con rapidez).
- El inicio mostró las cifras correctas (4 actividades, 1 partida a medias «va en el ejercicio 4», 14 terminadas); resultados resumió «14 partidas terminadas» con 76 % de aciertos al primer intento; el aula **retomó exactamente en el ejercicio 4 de 5** y respondió «¡Muy bien!».
- **No** se probó en teléfono ni tableta reales ni en otros navegadores, ni se midió accesibilidad con herramientas (S5-05 lo hizo Joel; no se repitió).

## 3. Tareas del sprint

| ID | Tarea | Estado |
|---|---|---|
| S6-01 | Pruebas de aceptación y corrección de bloqueantes | **Hecho**: §1 y §2. No se encontraron bloqueantes en el producto; los defectos hallados al integrar están en §4 |
| S6-02 | Configuración, secretos, sesiones, cuotas, recuperación; migraciones desde cero, índices, respaldo y restauración probados | **Hecho** con la variante del criterio 9: `revisarConfiguracion.js`, `baseDesdeCero.test.js`, `probarRespaldo.js`, `recuperacion.md` |
| S6-03 | Interfaz, mensajes y navegación sin controles sin función | **Revisado, sin cambios**: §2 y la revisión estática (sin enlaces vacíos, sin textos provisionales, todas las rutas enlazadas existen). Observaciones menores en `limites-y-problemas-conocidos.md` |
| S6-04 | Manuales, diagramas y README | **Hecho**: `instalacion.md` (probada desde un clon limpio), `arquitectura.md`, `manual-docente.md` |
| S6-05 | Datos ficticios y ensayo | **Datos hechos** (`sembrar:demo`); guion en `guion-demostracion.md`. **Falta el ensayo con personas y el cronometraje** |
| S6-06 | Publicar la versión final y etiquetar | **Pendiente** (despliegue, fuera de este trabajo) |

## 4. Defectos encontrados durante la aceptación

| # | Hallazgo | Estado |
|---|---|---|
| 1 | El escáner de secretos nunca habría detectado una clave privada (git grep leía el patrón como opción). Lo reveló su propia prueba | Corregido |
| 2 | `scripts/` estaba en `.gitignore`: `medirGeneracion.js` no se había subido aunque `package.json` lo usaba | Corregido en el sprint 5 |
| 3 | El `pg_dump` del PATH no coincidía con la versión del servidor PostgreSQL | Resuelto con `PG_BIN` (`instalacion.md`) |
| 4 | `information_schema.tables` oculta tablas según los privilegios de la sesión | Las pruebas usan `pg_tables` |

## 5. Sprint 7 — más juegos y mayor libertad de creación

Criterios de cierre (plan §15b) y su evidencia:

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Las cuatro habilidades se crean con IA y a mano, se juegan y se ven en resultados | **Cumplido** (resultados: ver nota) | `tests/http/generacion.test.js` («habilidades nuevas… de punta a punta, con 10 ejercicios»): solicitar → aprobar → partida → intento correcto; editor a mano en navegador (cliente `Ejercicios.test.js`, 19 pruebas) |
| 2 | Un conteo o una sílaba equivocados se rechazan como contenido inválido | **Cumplido** | `HabilidadesSilabas.test.js` y `GeneradorContenidoIA.test.js`; además el servidor calcula la respuesta, así que la IA no puede equivocarla |
| 3 | Las actividades anteriores se siguen abriendo y jugando | **Cumplido** | La suite anterior pasa sin cambios, salvo la prueba que daba por apagados los 10 ejercicios |
| 4 | Una base vacía y una existente quedan listas | **Cumplido, con paso manual** | Base vacía: `baseDesdeCero.test.js`. Base existente: `ALTER TYPE` de `recuperacion.md` §1 (no probado en un alojamiento real) |
| 5 | La suite completa pasa y las capas siguen limpias | **Cumplido** | `npm test`: 373 de 373 (incluye `capas.test.js`); cliente: 19 de 19 |

Recorrido en navegador: se generó «Completar la sílaba · Cuerpo humano · 10 ejercicios» con el generador falso; el editor mostró el icono, el selector de sílaba y las opciones, y la vista previa el icono, la palabra con hueco y tres sílabas. Sin errores ni avisos en la consola.
**No se probó** con la IA real (sigue sin habilitar), en teléfonos o tabletas, ni la pantalla de resultados con las habilidades nuevas (usa los mismos indicadores por partida, pero no se revisó a mano).

## 6. Sprint 8 — temática libre (rama `feature/generacion-libre`)

El docente puede pedir actividades sobre cualquier temática (frutas, colores, sonidos de animales, medios de transporte…) además de las 5 del catálogo. **Apagada por defecto**
(`GENERACION_LIBRE_HABILITADA`). Esto **amplía el SRS** (RNF-011 y la restricción del catálogo local revisado, §2.5 y §5.4) y **debe validarse con el docente de la asignatura**.

Estado a la fecha de este paso (7 de 10): el servidor está conectado de punta a punta con el generador falso; **falta** el cliente (paso 8), las mecánicas de sonido y colores como paso aparte
(paso 9 — ya decidido que son temáticas libres de las habilidades existentes) y la medición con la IA real (paso 10).

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Solicitar → borrador → aprobar → partida → intentos → finalizar → resultados, para las 4 habilidades, con 5 y 10 ejercicios | **Cumplido con el generador falso** | `tests/http/generacionLibre.test.js` (frutas, colores y sonidos de animales) |
| 2 | La IA nunca genera código ni decide qué es correcto; el servidor calcula la respuesta | **Cumplido** | `ValidacionContenidoLibre.test.js`, `GeneradorContenidoIALibre.test.js`; la vista del estudiante no revela respuestas (`generacionLibre.test.js`) |
| 3 | Una temática bloqueada se rechaza antes de gastar cupo ni llamar al generador | **Cumplido** | `GeneracionLibre.test.js`, `generacionLibre.test.js` (política, armas, drogas, letras separadas) |
| 4 | Interruptor apagado por defecto; con la IA apagada manda GENERACION_DESHABILITADA | **Cumplido** | `GeneracionLibre.test.js`, `ConfiguracionGeneracion.test.js`, `modoTematica.test.js` |
| 5 | Idempotencia con el modo incluido (otro modo = CLAVE_REUTILIZADA) | **Cumplido** | `GeneracionLibre.test.js`, `generacionLibre.test.js` |
| 6 | Cada docente solo accede a lo suyo (ids ajenos = 404) | **Cumplido** | `generacionLibre.test.js` |
| 7 | Un rechazo por contenido sigue consumiendo cupo y deja el error consultable sin repetir términos | **Cumplido** | `GeneracionLibre.test.js` |
| 8 | Lo ya guardado (catálogo) se sigue abriendo y jugando | **Cumplido** | La suite anterior pasa sin cambios, salvo pruebas que fijaban el fail-closed del paso 5 y la lista de claves de la solicitud |
| 9 | Resultados e inicio funcionan con versiones libres | **Cumplido** | `generacionLibre.test.js` («finalizar a mano, resultados e inicio…») |
| 10 | La suite completa pasa y las capas siguen limpias | **Cumplido** | `npm test`: 967 de 967, 0 omitidas (con bases reales); `capas.test.js` 8 de 8; Dominio 404; cliente 19 de 19 |
| 11 | Con la IA real: calidad de las palabras, descartes y costo reales | **Pendiente** | Paso 10 (medición real, comparando catálogo y libre) |
| 12 | Cliente: alternador de modo, campo de temática y aviso de no escribir nombres de estudiantes | **Pendiente** | Paso 8 |
| 13 | Validación de la ampliación del SRS con el docente de la asignatura | **Pendiente** | Responsable: el equipo |

Qué **no** se probó: el recorrido en navegador (no hay pantalla todavía), la IA real, un docente humano revisando palabras e iconos, ni el filtro contra el uso adversarial (es una defensa parcial, ver C6).
