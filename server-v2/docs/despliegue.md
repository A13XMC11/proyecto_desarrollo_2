# Despliegue de la versión de prueba (S5-06)

Objetivo del plan: «acceso, cookies, base y generación funcionan por HTTPS». Esta guía deja el camino y la forma de
**demostrarlo** con `npm run verificar:despliegue`. Elegir el alojamiento y crear las cuentas es decisión del equipo; aquí
no se asume ninguno. Lo marcado como *ejemplo* no se ha probado en un proveedor real.

## 1. Lo que hay que desplegar

| Pieza | Qué es | Detalle verificado en el código |
|---|---|---|
| Cliente | Sitio estático (`client/dist`) | `npm run build` (Vite + prerender de la portada) genera ~0,6 MB. Las rutas del panel son de React Router: el alojamiento debe devolver `index.html` para cualquier ruta que no sea un archivo |
| API | Proceso Node ≥ 22.9 (`server-v2`, `npm start`) | Puerto en `PORT` (3977 por defecto). **No sirve el cliente**: solo `/api/*` |
| PostgreSQL | Docentes, cursos, estudiantes, generaciones y cuotas de IA | Las tablas faltantes se crean al arrancar (`sync`); ver §4 |
| MongoDB | Juegos, versiones, partidas, interacciones y **sesiones** | Colecciones e índices se crean al conectar. Las sesiones viven en la colección `sesiones` con índice TTL |

### Restricción clave: mismo origen

El cliente llama a `/api/...` con **rutas relativas** (`window.location.origin`) y la cookie de sesión es `SameSite=Lax`.
Por eso el navegador debe ver cliente y API bajo **el mismo dominio**. Dos formas:

1. **Proxy de `/api` (recomendado).** El sitio estático reenvía `/api/*` al servidor Node. No hace falta CORS.
2. **Un solo servidor delante (Caddy, nginx…)** que sirve `dist` y proxea `/api`.

Si se publicaran en dominios distintos habría que cambiar el cliente y la política de cookies; no es el camino previsto.

*Ejemplo (no probado) con un sitio estático que admita reescrituras, p. ej. `vercel.json` del cliente:*

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://TU-API.example/api/:path*" },
    { "source": "/((?!assets/|favicon.svg|robots.txt|sitemap.xml).*)", "destination": "/index.html" }
  ]
}
```

La reescritura hacia la API debe conservar `Set-Cookie`, `X-CSRF-Token` y `X-Forwarded-Proto`. El verificador (§6) lo comprueba.

## 2. Variables de entorno de la API

| Variable | Valor en la versión de prueba | Por qué |
|---|---|---|
| `NODE_ENV` | `production` | Activa cookie `Secure` y `trust proxy`. **Sin esto la cookie no es Secure** |
| `SESSION_SECRET` | Cadena aleatoria larga | **Obligatoria**: con `production` el servidor no arranca sin ella. Generar con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Admite varias separadas por coma (rotación) |
| `SQL_URL` | URL de PostgreSQL gestionado, con `?sslmode=require` si el proveedor lo exige | Comprobado: el parámetro de la URL llega al controlador de PostgreSQL |
| `MONGO_URI` | URI de MongoDB (p. ej. `mongodb+srv://…`) con el nombre de la base | |
| `SQL_SYNC_ALTER` | `false` | Solo crea lo que falta; no altera tablas existentes (ver §4) |
| `APP_ORIGIN` | **Vacío** con proxy de mismo origen | Solo para CORS si el cliente estuviera en otro origen |
| `ZONA_HORARIA` | `America/Guayaquil` | Día calendario del cupo diario de IA |
| `AI_ENABLED` | `false` | Hasta cerrar S4-08 (presupuesto y autorización). Con `false` la biblioteca y el juego funcionan |
| `PORT` | El que indique el alojamiento | |

No subir `.env` al repositorio (ya está en `.gitignore`). El proveedor guarda los secretos.

### Probar la generación sin gastar nada

Con el generador falso la generación se puede habilitar con costo cero (probado):

```text
AI_ENABLED=true  AI_PROVEEDOR=falso
AI_TIEMPO_LIMITE_MS=30000  AI_MARGEN_CONCILIACION_MS=60000
AI_PRESUPUESTO_MENSUAL=1  AI_COSTO_MAXIMO_LLAMADA=0.01
AI_TARIFA_ENTRADA_MTOK=0  AI_TARIFA_SALIDA_MTOK=0
```

Para el proveedor real (`AI_PROVEEDOR=openai` o `gemini`) ver `docs/generacion-ia.md`; no se enciende sin el presupuesto firmado.

## 3. Pasos

1. Crear PostgreSQL y MongoDB gestionados. Copiar sus URL.
2. Desplegar la API: `npm ci --omit=dev` y `npm start` en `server-v2`, con las variables de §2.
3. Construir y publicar el cliente: en `client`, `npm ci && npm run build`, y publicar `dist`.
4. Configurar el proxy de `/api` y el reenvío a `index.html` (§1).
5. Ejecutar el verificador (§6) y guardar su salida como evidencia.

## 4. Base de datos: lo que hay que saber

- **Código primero, sin migraciones.** El esquema sale de los modelos. En una base vacía, `SQL_SYNC_ALTER=false` crea todas las tablas y MongoDB crea colecciones e índices: sirve para el primer despliegue.
- **Cambios de modelo después del primer despliegue:** con `SQL_SYNC_ALTER=false` las tablas existentes **no** se modifican. Para aplicarlos hay que arrancar una vez con `SQL_SYNC_ALTER=true` (con respaldo previo) y volver a `false`. Es un riesgo conocido; las migraciones numeradas son trabajo de S6-02.
- **Respaldo y restauración** (S6-02) no se han probado todavía.
- La zona horaria de las fechas se guarda en UTC; solo el cupo diario usa `ZONA_HORARIA`.

## 5. Qué demuestra cada comprobación

`npm run verificar:despliegue -- --url=https://tu-sitio [--origen=…] [--probar-generacion]` imprime ✔/✘ y sale con código 1 si algo falla:

| Criterio del plan | Comprobación |
|---|---|
| HTTPS | La URL es `https://` y la cookie lleva `Secure` |
| Cookies | `HttpOnly`, `Secure`, `SameSite` y caducidad presentes |
| Acceso | Registro (o inicio de sesión con `VERIFICAR_CORREO`/`VERIFICAR_CONTRASENA`), `401` sin sesión, y cierre que la revoca en el servidor |
| Base | La sesión persiste en MongoDB; `/api/inicio` y la biblioteca leen de las dos bases |
| Seguridad | Una escritura sin token CSRF devuelve `403`; CORS no abre la API a otros orígenes |
| Generación | Informa si está habilitada. Con `--probar-generacion`: una generación completa un borrador y repetir la clave no genera otra; si la IA está apagada, responde `503 GENERACION_DESHABILITADA` |

`--probar-generacion` crea un curso y un estudiante de prueba (la cuenta de verificación se conserva en ese caso) y, con IA real, **cuesta una llamada**.

Probado en local contra el servidor real en modo producción simulando el proxy HTTPS (`--simular-https`):
IA apagada y IA con el generador falso. **Todavía no se ha ejecutado contra un sitio publicado**: esa ejecución es la evidencia de S5-06.

## 6. Lista de cierre de S5-06

- [ ] API, cliente, PostgreSQL y MongoDB publicados; URL anotada: ______________________
- [ ] `verificar:despliegue` sin fallos contra esa URL; salida guardada
- [ ] Probado en un navegador real: registro, crear actividad a mano, jugar una partida, ver resultados
- [ ] Probado desde un teléfono o tableta (el aula usa esos dispositivos)
- [ ] `AI_ENABLED` en el valor decidido y anotado (`false` hasta S4-08)
- [ ] `SESSION_SECRET` guardado solo en el gestor de secretos del proveedor
- [ ] Medición en la versión publicada: `npm run medir:rendimiento -- --url=…` (ver `informe-rendimiento.md`)
