# Límites, consumo observado y problemas conocidos

Criterio de cierre del sprint 6: «se documentaron límites, consumo observado y problemas conocidos». Es una lista honesta de lo que el
sistema **no** hace o no se ha comprobado, para que nadie lo descubra en la demostración.

## 1. Límites del producto

| Qué | Límite | Dónde se fija |
|---|---|---|
| Habilidades y mecánicas | Vocales (elegir opción) y sílabas (ordenar) | `ValoresPermitidos` |
| Temáticas | Animales, objetos cotidianos, naturaleza | ídem |
| Catálogo de palabras | 21 palabras (7 por temática), **sin imágenes ni audio**; revisado por el equipo, **pendiente de contraste con un docente de grados menores** | `learning-resources.json` |
| Ejercicios por actividad | 5 (10 solo con `PERMITIR_10_EJERCICIOS=true`) | variable de entorno |
| Intentos por ejercicio | 2; al segundo fallo se muestra la solución y se avanza | dominio |
| Instrucción libre a la IA | 500 caracteres, sin HTML, URL ni correos | `Generacion` |
| Generaciones con IA | 3 por docente y día (`AI_MAX_DIARIAS`), 1 simultánea, 0 reintentos al proveedor, presupuesto global mensual | variables de entorno |
| Generación | **Apagada por defecto** (`AI_ENABLED=false`) hasta la autorización y el presupuesto (S4-08) | variable de entorno |
| Palabras que ofrece la IA | Vocales: solo con vocal inicial. Sílabas: de 2 a 3 sílabas | `RecursosParaGeneracion` |
| Sesión del docente | 4 h sin actividad, 12 h como máximo | `sesion.js` |
| Resultados | Cada consulta procesa como máximo las 2000 partidas más recientes | `LIMITE_RESULTADOS` |
| Estudiante | Código de lista de 1 a 6 caracteres, apodo opcional de hasta 20, franja de edad 5 a 7, curso de 1.º a 3.º EGB | modelos |
| Cuentas | Solo docentes; los estudiantes no tienen cuenta y juegan desde la sesión del docente | diseño |

## 2. Consumo observado

- **IA real: no hay medición.** Con el generador falso el costo es cero. Falta ejecutar `npm run medir:generacion` con la clave y el
  presupuesto aprobados (S4-06/S4-08). Hasta entonces `AI_MAX_TOKENS_SALIDA`, `AI_TIEMPO_LIMITE_MS`, las tarifas y el costo máximo por llamada **no tienen valor por defecto** a propósito, y la IA no arranca sin ellos.
- **Rendimiento local** (no de producción): `informe-rendimiento.md`. Con 30 estudiantes jugando a la vez, registrar un intento tiene P95 de ~28 ms y sin errores; biblioteca e inicio quedan por debajo de ~45 ms con 30 peticiones simultáneas; **resultados es lo que más crece** (~130 ms con 210 partidas y ~430 ms con 780, con 30 consultas simultáneas).
- Cuotas: la reserva de cupo es atómica; con peticiones simultáneas no se supera el límite (`FlujoGeneracion.test.js`).

## 3. Problemas conocidos

Prioridad: **Alta** si afecta seguridad o datos de personas; **Media** si afecta la operación o puede sorprender en producción; **Baja** si es una mejora.

### Seguridad
| # | Problema | Prioridad | Qué haría falta |
|---|---|---|---|
| S1 | **No hay límite de intentos de acceso** ni bloqueo de cuentas: un atacante puede probar contraseñas sin freno. Tampoco hay límite de registros | Alta | Limitar por IP y por cuenta en `/api/docentes/sesion` y `/api/docentes` (p. ej. `express-rate-limit`). Es una práctica básica de seguridad para cualquier endpoint de acceso; el plan solo limita el consumo de IA (RNF-012) |
| S2 | El servidor **no añade cabeceras de seguridad HTTP** (HSTS, `X-Content-Type-Options`, `X-Frame-Options`/CSP…) | Media | `helmet` o configurarlas en el proxy delante |
| S3 | No hay recuperación de contraseña ni cambio de contraseña desde la cuenta | Media | Decidir si hace falta para la entrega |

### Datos de estudiantes (detalle en `datos-estudiantes.md`)
| # | Problema | Prioridad |
|---|---|---|
| D1 | **No existe borrado real** de estudiantes, cursos ni de la cuenta con datos: «eliminar» archiva | Alta si se usan datos reales |
| D2 | `apodo` es texto libre y puede contener un nombre real | Alta si se usan datos reales |
| D3 | Sin plazo de conservación, sin exportación y sin aviso de privacidad ni registro del consentimiento | Alta si se usan datos reales |
| D4 | Decisión de la institución sobre base jurídica y autorización de representantes: **pendiente** (S5-09). Hasta entonces, solo datos ficticios | Alta |

### Operación
| # | Problema | Prioridad |
|---|---|---|
| O1 | Sin migraciones: con `SQL_SYNC_ALTER=false` las tablas existentes no cambian al cambiar un modelo (`recuperacion.md` §1) | Media |
| O2 | `mongodump`/`mongorestore` no se han probado (no están instalados en el equipo de desarrollo); se probó un volcado lógico | Media |
| O3 | Frecuencia y retención de respaldos sin definir | Media |
| O4 | Caída de una de las bases: sin comportamiento definido ni probado | Media |
| O5 | `GET /api/resultados` crece de forma aproximadamente lineal con las partidas (hasta 2000); no se midió el máximo | Media |
| O6 | La solicitud de generación **permanece abierta hasta terminar** (hasta `AI_TIEMPO_LIMITE_MS`). Si el proxy del alojamiento corta peticiones largas, el docente vería un error aunque la generación siga; el estado se puede consultar después | Media: verificar al desplegar |
| O7 | La versión publicada, HTTPS y cookies reales: **sin comprobar** hasta publicar (`despliegue.md`) | Media |

### IA
| # | Problema | Prioridad |
|---|---|---|
| I1 | Proveedor real sin medir ni habilitar (S4-06 a S4-08) | Media |
| I2 | El adaptador de Gemini se escribió sin poder comprobar toda su documentación (nombre exacto de `responseJsonSchema`, encabezado de autenticación): se verifica en la primera llamada real; un rechazo falla sin reintentar | Media |
| I3 | Documentación heredada que habla de «la API de Claude» como proveedor, mientras el plan y el adaptador usan Gemini | Baja: aclarar |
| I4 | Una respuesta que cumple todas las reglas puede seguir siendo pedagógicamente pobre: por eso la aprobación del docente es obligatoria | Baja: por diseño |

### Interfaz (observaciones menores, no corregidas)
| # | Observación |
|---|---|
| U1 | En Resultados, la columna «Estudiante» dice «Elige el curso para ver nombres» con el filtro en «Todos» aunque solo exista un curso |
| U2 | No se ha probado en teléfonos ni tabletas reales ni en otros navegadores que el automatizado |
| U3 | El recorrido no se midió con herramientas de accesibilidad (la revisión de teclado y foco la hizo Joel en S5-05) |

## 4. Fuera de alcance (decidido en el plan)

Cuentas de familias, boletines o calificaciones oficiales, pagos, chat con el estudiante, aplicación móvil nativa, rankings, varios idiomas y generación libre de código.
