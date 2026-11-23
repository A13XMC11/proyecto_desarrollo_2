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

Estado a la fecha (paso 9 de 10, en cierre): servidor y cliente están conectados de punta a punta **con el generador falso**. **Falta** la medición con la IA real (paso 10), la validación del SRS y la
revisión humana de las palabras, los iconos y los términos bloqueados. Los colores y «sonidos de animales» son temáticas libres de las habilidades existentes, no mecánicas nuevas; practicar los sonidos
mismos queda como mejora futura (C5 en `limites-y-problemas-conocidos.md`).

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Solicitar → borrador → aprobar → partida → intentos → finalizar → resultados, para las 4 habilidades, con 5 y 10 ejercicios | **Cumplido con el generador falso** | `tests/http/generacionLibre.test.js` (frutas, colores y sonidos de animales) |
| 2 | La IA nunca genera código ni decide qué es correcto; el servidor calcula la respuesta | **Cumplido** | `ValidacionContenidoLibre.test.js`, `GeneradorContenidoIALibre.test.js`; la vista del estudiante no revela respuestas (`generacionLibre.test.js`) |
| 3 | Una temática bloqueada se rechaza antes de gastar cupo ni llamar al generador | **Cumplido** | `GeneracionLibre.test.js`, `generacionLibre.test.js` (política, armas, drogas, letras separadas) |
| 4 | Interruptor apagado por defecto; con la IA apagada manda GENERACION_DESHABILITADA | **Cumplido** | `GeneracionLibre.test.js`, `ConfiguracionGeneracion.test.js`, `modoTematica.test.js` |
| 5 | Idempotencia con el modo incluido (otro modo = CLAVE_REUTILIZADA) | **Cumplido** | `GeneracionLibre.test.js`, `generacionLibre.test.js` |
| 6 | Cada docente solo accede a lo suyo (ids ajenos = 404) | **Cumplido** | `generacionLibre.test.js`, `clienteHostil.test.js` |
| 7 | Un rechazo por contenido sigue consumiendo cupo y deja el error consultable sin repetir términos | **Cumplido** | `GeneracionLibre.test.js` |
| 8 | Lo ya guardado (catálogo) se sigue abriendo y jugando | **Cumplido** | La suite anterior pasa sin cambios, salvo pruebas que fijaban el fail-closed del paso 5 y la lista de claves de la solicitud |
| 9 | Resultados e inicio funcionan con versiones libres | **Cumplido** | `generacionLibre.test.js` («finalizar a mano, resultados e inicio…») |
| 10 | La suite completa pasa y las capas siguen limpias | **Cumplido** | 23 nov, `AI_ENABLED=false PERMITIR_10_EJERCICIOS=true npm test`: **1018 de 1018, 0 fallidas, 0 omitidas** (bases reales de PostgreSQL y MongoDB); `capas.test.js` incluido. Cliente: `node --test` 56 de 56 y `npm run build` compila. Antes (paso 7): 967 de 967 |
| 11 | Con la IA real: calidad de las palabras, descartes y costo reales | **Pendiente** | Paso 10 (medición real, comparando catálogo y libre) |
| 12 | Cliente: alternador de modo, campo de temática y aviso de no escribir nombres de estudiantes | **Cumplido** (prueba manual con el generador falso + pruebas de dominio) | Ver «Evidencia del paso 8» |
| 13 | Validación de la ampliación del SRS (RNF-011, §2.5 y §5.4) con el profesor de la asignatura | **Pendiente** | Responsable: el equipo. Sin esto no se enciende `GENERACION_LIBRE_HABILITADA` en un entorno real (C8) |
| 14 | Un cliente hostil por la API directa no se salta las reglas de la temática libre | **Cumplido** | `tests/http/clienteHostil.test.js`: 26 pruebas (palabras, iconos, hiatos, campos extra, consignas y pistas bloqueadas o repetidas, temáticas inválidas, versiones aprobadas inmutables, ids ajenos 404, sin sesión 401, sin CSRF 403). No se encontró ningún hueco; 5 mutaciones confirman que las pruebas detectan su rotura |
| 15 | El filtro de contenido también se aplica a la instrucción del docente | **Cumplido** | `8c654c0`: 400 `INSTRUCCION_NO_PERMITIDA` antes de reservar cupo y sin repetir el texto; pruebas en `Generacion.test.js`, `GeneracionLibre.test.js`, `generacionLibre.test.js` |
| 16 | `npm run revisar:configuracion` avisa de la temática libre y de su incoherencia con la IA | **Cumplido** | `41c1372`; `tests/aceptacion/revisarConfiguracion.test.js` (12 de 12). La corrida final está en «Verificación final» |
| 17 | Recorrido solo con teclado de la temática libre | **Cumplido con límites** (manual, **sin pruebas automáticas**) | Ver «Revisión de teclado y foco» |
| 18 | Revisión humana de `terminosBloqueados.json`, `emojisPermitidos.json` y `contenidoFalsoLibre.json`, y de la calidad pedagógica de las palabras por un docente de grados menores | **Pendiente** | Responsable: un docente humano. Hasta entonces el filtro es una defensa parcial (C6) y la aprobación del docente es la garantía real |
| 19 | Prueba en tableta o teléfono reales, y con lector de pantalla | **Pendiente** | Los iconos son emojis y se ven distinto según el sistema (C3); no se probó en dispositivos reales |

### Evidencia del paso 8 (servidor y cliente)

- **Servidor.** `GET /api/cuotas` informa `generacionLibreHabilitada` (`de1b24f`; `generacionLibre.test.js`, `modoTematica.test.js`, `GeneracionLibre.test.js`). La biblioteca distingue las actividades libres y editar como versión nueva conserva el modo
  (`48cd309`; `contenidoLibre.test.js`, `VersionConfiguraciones.test.js`). `GET /api/iconos` entrega la lista cerrada de iconos y el servidor la vuelve a comprobar al guardar (`bbbd789`; `EmojisPermitidosJson.test.js`, `contenidoLibre.test.js`).
- **Cliente** (`14fc959`). Alternador de modo con la opción bloqueada si el servidor no la habilita; campo de temática con contador, ejemplos y aviso de no escribir datos personales; mensajes por código que no repiten lo escrito; estado «generando» con `aria-live` y sin envíos duplicados;
  revisión del borrador libre (título, consigna, pista e icono; palabra y respuesta de solo lectura); etiqueta de «Temática libre» en la biblioteca. Pruebas de dominio del cliente (`Mensajes`, `TematicaLibre`, `EjerciciosLibres`): de 19 a 56.
- **Recorrido en navegador (23 nov; generador falso; base de desarrollo; navegador automatizado).** Contar sílabas · «frutas» · 5 ejercicios: pedir (cupo 3 → 2) → revisar (uva 2, papaya 3, manzana 3, guayaba 3, naranja 3) → aprobar → «Editar como versión nueva» y aprobar → jugar con el estudiante A01
  (un fallo con «Intentar otra vez» y una pista: 5 de 5, 4 al primer intento) y con A02 (5 de 5 al primer intento). Consola sin errores tras una recarga completa.

### Revisión de teclado y foco (paso 9)

Antes de esta revisión, `8102909` hizo visible el foco en las tarjetas de opción y en los campos. Al recorrer la actividad solo con teclado se encontraron y corrigieron **cinco** problemas de foco (en todos, el botón enfocado desaparecía o no cerraba y el foco caía en `BODY`, así que
la persona volvía al inicio de la página). Cada uno se **reprodujo con teclas reales antes del arreglo** y se **comprobó después**, tras recargar la página:

| | Problema | Arreglo | Commit |
|---|---|---|---|
| a | **Esc** no cerraba la lista de iconos | Esc cierra desde el botón o desde dentro de la lista y el foco vuelve al botón | `71a3658` |
| b | Al **elegir un icono** el foco caía en `BODY` | El foco vuelve al botón «Elegir otro icono» | `71a3658` |
| c | Al **aprobar** el borrador el foco caía en `BODY` | El foco pasa a «Iniciar en el aula» | `71a3658` |
| d | Al **ver una pista** (aula) el foco caía en `BODY` | El foco vuelve a la primera opción | `c734c44` |
| e | En **«¡Terminaste!»** el foco caía en `BODY` | El foco pasa al título de la pantalla; Tab llega a los botones | `c734c44` |

**Son verificaciones manuales. No hay pruebas automáticas de estos cinco arreglos**: el cliente solo tiene pruebas de dominio (`node --test`) y no tiene herramientas para probar componentes, así que un cambio futuro podría romperlos sin que ninguna prueba falle.

**Qué no se probó:**
- **Lector de pantalla.** Solo se comprobó que los avisos existen en regiones `aria-live`; no se oyó lo que anuncia un lector real.
- **Tableta, teléfono ni pantalla táctil**, ni otros navegadores que el automatizado.
- **El orden completo de Tab.** En algunos controles el foco se colocó por código («Elegir un icono», «Aprobar», «Editar como versión nueva», el botón del estudiante) y se comprobó qué pasa al activarlos, no que se llegue a ellos con Tab en el orden esperado.
- **Herramientas automáticas de accesibilidad.**
- **Otras habilidades en teclado.** Solo se recorrió contar sílabas con «frutas»; vocales, completar la sílaba y ordenar sílabas (otra mecánica, con su propio componente) se cubren con pruebas HTTP, no con recorrido manual.

### Verificación final (23 nov, sobre `67ea258`)

| Comprobación | Resultado |
|---|---|
| `AI_ENABLED=false PERMITIR_10_EJERCICIOS=true npm test` | **1018 de 1018**, 0 fallidas, 0 canceladas, **0 omitidas**; «Arquitectura: reglas de capas» en verde |
| Cliente: `node --test "src/**/*.test.js"` y `npm run build` | 56 de 56; compila |
| `npm run revisar:configuracion -- --solo-repositorio` | 5 correctas, 0 con error, 0 avisos (salida 0) |
| Escaneo de los 24 commits de la rama contra `main` (líneas añadidas) | Sin claves de Google, `sk-`, URL de base de datos con clave, clave privada, `GEMINI_API_KEY` ni `SESSION_SECRET` con valor; ningún `.env`, `.pem` ni clave versionados; sin correos personales ni rutas locales en lo añadido |

Hallazgo: `revisar:configuracion -- --solo-repositorio` **ya fallaba en `main`** (2 errores, salida 1) porque el escáner encontraba los datos de ejemplo de su propia prueba (una URL con clave de mentira y una cabecera de clave privada). Se corrigió en la prueba
(`67ea258`: los ejemplos se arman en tiempo de ejecución y el texto probado es el mismo); el escáner no cambió. El historial anterior a la rama (`main`) conserva esas cadenas de ejemplo, que no son credenciales.

### Qué **no** se probó (resumen)

La IA real; un docente humano revisando palabras e iconos; la temática libre en dispositivos reales; el recorrido en navegador de las otras habilidades y de colores o «sonidos de animales»; y el filtro contra el uso adversarial más allá de las 26 pruebas por API (es una defensa parcial, ver C6).
