# Instalación y puesta en marcha

Pasos para que otra persona instale y ejecute el proyecto. **Probados el 2026-11-22 sobre un clon limpio del repositorio**:
`npm ci`, `npm test` (305 de 305 pruebas pasaron) y `npm run build` del cliente (con prerender de la portada).

## Requisitos

| Qué | Versión | Nota |
|---|---|---|
| Node.js | **22.9 o superior** (`engines` de `package.json`) | Probado con Node 26 |
| PostgreSQL | Reciente (probado con 18) | La base debe **existir** antes de arrancar |
| MongoDB | Reciente, en el puerto 27017 por defecto | MongoDB crea la base sola |
| Git | | Para el repositorio y para `revisar:configuracion` |

## 1. Obtener el código

```bash
git clone https://github.com/A13XMC11/proyecto_desarrollo_2.git
cd proyecto_desarrollo_2
```

Carpetas: `server-v2` (API, Node/Express) y `client` (React + Vite).

## 2. Crear las bases de PostgreSQL

Una de desarrollo y una de pruebas (el nombre de la de pruebas **debe contener «test»**):

```bash
createdb minijuegos_dev
createdb minijuegos_test
```

## 3. Servidor

```bash
cd server-v2
npm install
cp .env.example .env
```

Editar `.env` con los datos reales de su PostgreSQL (usuario, clave, puerto) y su MongoDB:

| Variable | Para qué |
|---|---|
| `SQL_URL`, `MONGO_URI` | Bases de desarrollo |
| `SQL_URL_TEST`, `MONGO_URI_TEST` | Bases de pruebas. **Las pruebas las vacían**: nunca apunten a datos reales. El nombre debe contener «test» o se niegan a correr |
| `SESSION_SECRET` | Obligatorio en producción. En desarrollo, vacío: se usa uno temporal y las sesiones se pierden al reiniciar |
| `AI_ENABLED` | `false` (por defecto). Ver `generacion-ia.md` antes de habilitar |
| `ZONA_HORARIA` | Día del cupo diario de IA (`America/Guayaquil`) |

Arrancar (puerto 3977 por defecto):

```bash
npm run dev      # con recarga automática
npm start        # sin recarga
```

Al conectar, el servidor **crea tablas, colecciones e índices desde los modelos** (code first); no hay migraciones. Comprobación: `GET http://localhost:3977/api/health` devuelve `{"ok":true,"bases":{"sql":"ok","mongo":"ok"}}`; si alguna base no responde en 2 s devuelve 503 con esa base marcada como `"caida"`.

## 4. Cliente

```bash
cd client
npm install
npm run dev      # http://localhost:5173
```

En desarrollo Vite reenvía `/api` a `http://localhost:3977`, así que el cliente y la API comparten origen (necesario para la cookie de sesión). La API debe estar corriendo.

Versión de producción: `npm run build` genera `client/dist` (ver `despliegue.md`).

## 5. Datos de demostración

Con la API en marcha:

```bash
cd server-v2
npm run sembrar:demo -- --url=http://localhost:3977
```

Crea la cuenta `demo@letritas.ec` (clave `Demo-12345`) con un curso, 8 estudiantes, 3 actividades aprobadas, un borrador y partidas con resultados. Es repetible: si la cuenta ya tiene datos, no los duplica. Guion de uso: `guion-demostracion.md`.

## 6. Pruebas

```bash
cd server-v2
npm test
```

Ejecuta todas las pruebas con las bases de pruebas (unitarias de dominio, integración con PostgreSQL y MongoDB reales, HTTP, arquitectura y aceptación). **Si falta `SQL_URL_TEST`/`MONGO_URI_TEST`, o no hay base disponible, esas pruebas se omiten con un mensaje explícito** (no pasan en falso): revise la salida si ve «skipped».

## 7. Herramientas (`server-v2/scripts`)

| Comando | Para qué |
|---|---|
| `npm run sembrar:demo -- --url=…` | Datos ficticios para la demostración |
| `npm run medir:rendimiento` | Rendimiento y capacidad (informe en `informe-rendimiento.md`); vacía las bases de pruebas |
| `npm run medir:generacion` | Costo y latencia de la IA real; **gasta dinero**, exige `--confirmo-costo` |
| `npm run verificar:despliegue -- --url=https://…` | Comprueba HTTPS, cookies, base y generación de una versión publicada |
| `npm run revisar:configuracion` | Revisa configuración y secretos antes de entregar |
| `npm run probar:respaldo` | Respaldo y restauración de las bases de pruebas (usa `pg_dump`/`pg_restore`) |

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `role "postgres" does not exist` o `password authentication failed` | La URL de `SQL_URL` no coincide con su PostgreSQL: usuario, clave y **puerto** (algunas instalaciones usan 5433) |
| `ECONNREFUSED` a MongoDB | MongoDB no está corriendo |
| `Falta SESSION_SECRET` | Está en modo `production`: defina `SESSION_SECRET` (generar con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| Las pruebas dicen `OMITIDO` | Falta o es inválida una base de pruebas (ver §6) |
| `pg_dump: error: aborting because of server version mismatch` | El `pg_dump` del sistema es de otra versión que el servidor. Indique las herramientas correctas: `PG_BIN=/ruta/a/postgresql/18/bin npm run probar:respaldo` |
| Tras reiniciar el servidor todos tienen que volver a ingresar | `SESSION_SECRET` cambió (o no está definido en desarrollo) |
| El cliente muestra errores de red | La API no está en `localhost:3977` o el cliente se abrió por un puerto distinto del 5173 |
