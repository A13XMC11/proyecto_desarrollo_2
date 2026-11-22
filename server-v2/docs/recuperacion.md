# Configuración, secretos y recuperación (S6-02)

Qué se decidió, cómo se demuestra y cómo se recupera el servicio. Todo lo marcado «probado» se ejecutó en este repositorio
(bases de pruebas locales); lo marcado «no probado» es el procedimiento previsto para producción.

## 1. Esquema y «migraciones»: decisión y variante

El plan pide «migraciones numeradas e idempotentes» y «una base vacía lista solo con las migraciones». El equipo adoptó el marco
HX-ODM-JS **code first**: no hay migraciones ni DDL escrito a mano; **el esquema sale de los modelos** al conectar
(`sequelize.sync` en PostgreSQL y `Model.init()` en MongoDB). El criterio se cumple con esa variante:

- **Probado:** `tests/aceptacion/baseDesdeCero.test.js` vacía las dos bases, arranca el servidor real (`node index.js`) con `SQL_SYNC_ALTER=false` y comprueba que quedan las 7 tablas, todos los índices que declaran los modelos (con su unicidad y los parciales), el índice TTL de las sesiones y los 4 canales. También que el modelo rechaza un docente inválido y que el índice único impide repetir el correo.
- **Validación de datos:** vive en los modelos (Sequelize y Mongoose) y en las entidades de Dominio, no en `$jsonSchema` ni en restricciones `CHECK` escritas a mano.

**Costo de la variante (decisión consciente):** con `SQL_SYNC_ALTER=false` las tablas existentes **no cambian**. Si un modelo cambia después
del primer despliegue hay que arrancar una vez con `SQL_SYNC_ALTER=true`, con respaldo previo, y volver a `false`. No hay historial de
cambios ni forma de deshacerlos. Si el proyecto crece, el paso natural son migraciones numeradas.

## 2. Respaldo y restauración

### Demostrado (una vez, sobre las bases de pruebas)

`npm run probar:respaldo` (con `PG_BIN` si `pg_dump` no coincide con la versión del servidor):

1. Siembra la demostración con la API.
2. Respalda PostgreSQL (`pg_dump -Fc`) y MongoDB (volcado lógico en EJSON, con las definiciones de índices).
3. **Destruye** el esquema de PostgreSQL y la base de MongoDB.
4. Restaura con `pg_restore` y con el volcado de MongoDB.
5. Comprueba que coincide todo: mismas filas por tabla, mismos documentos por colección y los mismos 16 índices; arranca el servidor real sobre lo restaurado y comprueba que **la sesión de antes sigue válida**, que **la contraseña funciona**, que la API devuelve datos **idénticos campo por campo** (cursos, biblioteca, resultados, inicio) y que **una partida a medias continúa**.

Resultado de la ejecución del 2026-11-22: correcto. 16 filas y 29 documentos; respaldo de PostgreSQL 20 kB en ~1 s; restauración de PostgreSQL ~0,3 s y de MongoDB ~0,5 s. Son volúmenes de demostración: no extrapolar tiempos a datos reales.

### Procedimiento para producción (no probado contra un alojamiento real)

| Paso | PostgreSQL | MongoDB |
|---|---|---|
| Respaldar | `pg_dump -Fc --no-owner -h HOST -U USUARIO -d BASE -f respaldo.dump` (clave por `PGPASSWORD`) | `mongodump --uri="$MONGO_URI" --out=respaldo-mongo` |
| Restaurar | `pg_restore --no-owner --clean --if-exists -h HOST -U USUARIO -d BASE respaldo.dump` | `mongorestore --uri="$MONGO_URI" --drop respaldo-mongo` |
| Después | Arrancar la API con `SQL_SYNC_ALTER=false` y ejecutar `npm run verificar:despliegue` | Ídem |

- **Preferir los respaldos automáticos del proveedor** (programados, con retención) y usar estos comandos para copias propias y para probar.
- En **este equipo `mongodump` no está instalado**, así que la prueba usa un volcado lógico propio (documentos e índices). Demuestra el procedimiento y que los índices vuelven, pero **no prueba `mongodump`/`mongorestore`**.
- Los respaldos contienen datos de estudiantes y el hash de las contraseñas: se guardan cifrados, con acceso restringido, y la supresión de datos debe alcanzarlos (ver `datos-estudiantes.md`).
- Restaurar **la colección `sesiones`** mantiene abiertas las sesiones de antes; si no se quiere, omitirla (los docentes solo volverán a ingresar).
- No hay una frecuencia ni una retención definidas: es una decisión del equipo y del alojamiento.

## 3. Recuperación ante fallos del servicio

| Situación | Qué ocurre | Evidencia |
|---|---|---|
| Se reinicia el servidor | La sesión sobrevive (vive en MongoDB, no en memoria) siempre que `SESSION_SECRET` sea el mismo; las actividades se conservan; una partida en curso se retoma | `tests/aceptacion/recorrido.test.js` (reinicio) |
| Se reinicia con generaciones a medias | Al arrancar se concilian: las que ya tienen juego se completan sin duplicar y las vencidas pasan a `interrumpida`, **sin reintentar** (el proveedor pudo cobrar) | `tests/lib/Generacion/Aplicacion/FlujoGeneracion.test.js` |
| Cambia `SESSION_SECRET` | Las cookies existentes dejan de valer: todos vuelven a ingresar. Para rotarlo sin cortar sesiones, poner el nuevo **primero** y el anterior después, separados por coma | `src/Infraestructura/http/sesion.js` |
| Se apaga la generación (`AI_ENABLED=false`) | Biblioteca y partidas siguen; generar responde 503 `GENERACION_DESHABILITADA` | `recorrido.test.js` |
| Se agota el cupo o el presupuesto de IA | El servidor lo rechaza aunque el botón no esté desactivado (la reserva es atómica en PostgreSQL) | `FlujoGeneracion.test.js` |
| Cae una de las dos bases | No hay comportamiento definido ni probado: lo que la necesite fallará con error 500 y no hay reintentos ni cola. Se revisa en el ensayo con el alojamiento real | No probado |

## 4. Revisión de configuración y secretos

`npm run revisar:configuracion` revisa el entorno del despliegue (`node --env-file=… scripts/revisarConfiguracion.js`) y el repositorio
(`-- --solo-repositorio`). Falla (código 1) si encuentra: `NODE_ENV` distinto de `production`, `SESSION_SECRET` ausente o corto, bases de pruebas o locales
como destino, `SQL_SYNC_ALTER` distinto de `false`, `APP_ORIGIN` que no sea HTTPS, una zona horaria inválida, una configuración de IA inconsistente, archivos
`.env` versionados o credenciales en archivos versionados (claves de Google, tipo `sk-`, URL de base de datos con contraseña, claves privadas).
Habilitar la IA siempre produce un **aviso**: debe constar la autorización y el presupuesto.

Estado actual: el repositorio sale limpio (sin `.env` versionados ni credenciales). Las pruebas (`tests/aceptacion/revisarConfiguracion.test.js`) comprueban que
el escáner **detecta** cada tipo de problema; una de ellas descubrió que no detectaba claves privadas y se corrigió.

### Sesiones y cuentas (revisado)
- Cookie `letritas.sid`: `HttpOnly`, `SameSite=Lax`, `Secure` con `NODE_ENV=production`. Caduca a las 4 h sin actividad y a las 12 h desde el inicio.
- Token CSRF por sesión exigido en toda escritura; el id de sesión se regenera al ingresar (evita la fijación de sesión).
- Cerrar sesión la borra del almacén (revocación real).
- La contraseña se guarda con hash; no hay recuperación de contraseña por correo (no existe esa función).
- **No hay límite de intentos de acceso** (fuerza bruta) ni bloqueo de cuentas, y el servidor **no añade cabeceras de seguridad HTTP** (ni `helmet` ni equivalentes): lagunas conocidas, ver `limites-y-problemas-conocidos.md`.
