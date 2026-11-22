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
