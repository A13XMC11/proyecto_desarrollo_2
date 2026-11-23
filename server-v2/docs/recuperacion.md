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

### Cambios de valores permitidos (sprint 7)

El sprint 7 añadió dos habilidades (`completar_silaba`, `contar_silabas`) y dos temáticas (`cuerpo`, `escuela`). En PostgreSQL son tipos `ENUM`:
una base **nueva** los crea completos; una base **ya existente** con `SQL_SYNC_ALTER=false` no se entera. Antes de arrancar la versión nueva sobre ella, con respaldo previo:

```sql
ALTER TYPE enum_generaciones_ia_habilidad ADD VALUE IF NOT EXISTS 'completar_silaba';
ALTER TYPE enum_generaciones_ia_habilidad ADD VALUE IF NOT EXISTS 'contar_silabas';
ALTER TYPE enum_generaciones_ia_tematica ADD VALUE IF NOT EXISTS 'cuerpo';
ALTER TYPE enum_generaciones_ia_tematica ADD VALUE IF NOT EXISTS 'escuela';
ALTER TYPE enum_estudiante_intereses_tematica ADD VALUE IF NOT EXISTS 'cuerpo';
ALTER TYPE enum_estudiante_intereses_tematica ADD VALUE IF NOT EXISTS 'escuela';
```

Es seguro repetirlo. Sin esto, pedir una generación nueva o guardar un interés nuevo falla con un error de PostgreSQL. MongoDB no necesita nada:
sus valores permitidos se validan en la aplicación y los ejercicios con `icono` conviven con los anteriores (el campo es opcional).
**Comprobado:** en las bases de pruebas, `sync({ alter: true })` añadió los valores sin perder filas.

### Temática libre: modo de temática (rama `feature/generacion-libre`, paso 3)

La temática libre cambia `generaciones_ia`: la columna `tematica` deja de ser un `ENUM` (solo admitía las 5 del catálogo) y pasa a texto de
hasta 40 caracteres, y aparece la columna `modo_tematica` (`catalogo` o `libre`). Una base **nueva** sale completa de los modelos. Una base
**ya existente** con `SQL_SYNC_ALTER=false` no cambia sola: antes de arrancar la versión nueva sobre ella, **con respaldo previo**, ejecutar
una vez (en una transacción, así queda todo o nada):

```sql
BEGIN;

-- 1. Modo de temática: las filas que ya existen quedan como "catalogo", que es lo que eran
DO $$
BEGIN
  CREATE TYPE enum_generaciones_ia_modo_tematica AS ENUM ('catalogo', 'libre');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE generaciones_ia
  ADD COLUMN IF NOT EXISTS modo_tematica enum_generaciones_ia_modo_tematica NOT NULL DEFAULT 'catalogo';

-- 2. La temática pasa de ENUM a texto de hasta 40 caracteres; los valores actuales se conservan tal cual
ALTER TABLE generaciones_ia
  ALTER COLUMN tematica TYPE VARCHAR(40) USING tematica::text;

-- 3. El tipo ENUM anterior ya no lo usa nada (el de los intereses de estudiantes es otro y no se toca)
DROP TYPE IF EXISTS enum_generaciones_ia_tematica;

COMMIT;
```

Es seguro repetirlo: la segunda vez no cambia nada. No hay que tocar MongoDB: las versiones guardadas antes **no tienen** el campo
`configuracion.modoTematica` y se leen como `catalogo` sin migrar ningún documento. `Estudiante.intereses` sigue usando las 5 temáticas del catálogo.

Para deshacerlo (solo si no se guardó ninguna generación libre; si hay alguna, antes hay que borrarla o archivarla):

```sql
BEGIN;
CREATE TYPE enum_generaciones_ia_tematica AS ENUM ('animales', 'objetos_cotidianos', 'naturaleza', 'cuerpo', 'escuela');
ALTER TABLE generaciones_ia ALTER COLUMN tematica TYPE enum_generaciones_ia_tematica USING tematica::enum_generaciones_ia_tematica;
ALTER TABLE generaciones_ia DROP COLUMN modo_tematica;
DROP TYPE enum_generaciones_ia_modo_tematica;
COMMIT;
```

**Comprobado** (2026-11-22) sobre bases de pruebas creadas con el esquema anterior y con una generación guardada, ejecutando el SQL tal cual
está arriba:

- Aplicarlo deja `tematica` como `character varying(40)` y `modo_tematica` con valor por defecto `'catalogo'`; la fila existente conserva
  su temática (`animales`) y queda con modo `catalogo`. Aplicarlo una segunda vez no cambia nada.
- Con el esquema ya ajustado y `SQL_SYNC_ALTER=false`, la versión nueva lee la generación antigua como del catálogo y guarda una de temática libre.
- Deshacerlo devuelve el esquema anterior sin perder la fila, y volver a aplicarlo lo deja igual que antes.
- **Sin el SQL manual**, en desarrollo (`SQL_SYNC_ALTER=true`, por defecto) el arranque ajusta la tabla solo y conserva las filas; únicamente deja
  sin usar el tipo `enum_generaciones_ia_tematica`, que el `DROP TYPE` de arriba elimina. En producción (`SQL_SYNC_ALTER=false`) el SQL manual es obligatorio.

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
