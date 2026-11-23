# Guion de la demostración (S6-05)

Recorrido de unos **10 minutos** con datos ficticios. Las cifras de este guion salen de `npm run sembrar:demo` (datos fijos: salen
igual cada vez). **El cronometraje real y el ensayo con personas están pendientes**: los tiempos de abajo son una estimación a confirmar.

## Antes de empezar (preparación)

- [ ] API y cliente en marcha (`npm run dev` en `server-v2` y en `client`, o la URL publicada)
- [ ] Datos cargados: `npm run sembrar:demo -- --url=<URL de la API>`. Para tener una copia **intacta** en cada ensayo: `DEMO_CORREO=demo2@letritas.ec npm run sembrar:demo -- --url=…`
- [ ] Cuenta: `demo@letritas.ec` / `Demo-12345` (o la que se haya sembrado)
- [ ] Generación con IA: decidir antes si se **muestra** (con generador falso, ver «Encender la generación con el generador falso» abajo) o se muestra la pantalla «desactivada». **No** depender de la IA real salvo que S4-08 esté firmado
- [ ] Un navegador sin sesiones abiertas, con zoom al 110 % para que se vea desde atrás
- [ ] Plan B a mano: captura de la pantalla de resultados y el video del recorrido

## Encender la generación con el generador falso

Con el generador falso no hay proveedor, ni red, ni costo. Pero con `AI_ENABLED=true` el servidor **no arranca** si falta cualquiera de estas **seis variables obligatorias** (no tienen valor por defecto a propósito):

| Variable | Qué es | Valor para esta demostración (ficticio) |
|---|---|---|
| `AI_TIEMPO_LIMITE_MS` | tiempo máximo de una generación | `30000` |
| `AI_MARGEN_CONCILIACION_MS` | margen antes de dar por interrumpida una generación | `60000` |
| `AI_PRESUPUESTO_MENSUAL` | presupuesto global del mes | `1` |
| `AI_COSTO_MAXIMO_LLAMADA` | costo máximo reservado por llamada | `0.01` |
| `AI_TARIFA_ENTRADA_MTOK` | tarifa por millón de tokens de entrada | `0` |
| `AI_TARIFA_SALIDA_MTOK` | tarifa por millón de tokens de salida | `0` |

Se ponen **en la terminal, no en el `.env`** (así el `.env` no se toca y al cerrar la terminal vuelve todo a apagado). Ejemplo en Git Bash, desde `server-v2`:

```bash
AI_ENABLED=true AI_PROVEEDOR=falso GENERACION_LIBRE_HABILITADA=true PERMITIR_10_EJERCICIOS=true \
AI_TIEMPO_LIMITE_MS=30000 AI_MARGEN_CONCILIACION_MS=60000 AI_PRESUPUESTO_MENSUAL=1 \
AI_COSTO_MAXIMO_LLAMADA=0.01 AI_TARIFA_ENTRADA_MTOK=0 AI_TARIFA_SALIDA_MTOK=0 npm start
```

En PowerShell cada variable se define antes con `$env:NOMBRE = "valor"` y luego se ejecuta `npm start`. Después, `npm run dev` en `client` (puerto 5173; el proxy envía `/api` al 3977).

- `GENERACION_LIBRE_HABILITADA=true` enciende **«Otra temática»**. Sin ella (apagada por defecto) esa opción aparece bloqueada con «No está disponible por ahora»: es el comportamiento seguro y también se puede mostrar.
- `GENERADOR_FALSO_DEMORA_MS=1500` (opcional) simula una espera para mostrar el estado «generando». Debe ser menor que `AI_TIEMPO_LIMITE_MS`.
- Con `AI_ENABLED=false` (por defecto) todo lo demás funciona y generar responde «todavía no está habilitada».
- El generador falso **no entiende la temática**: es contenido de ejemplo. Reconoce por nombre frutas, colores, animales, transporte, escuela, cuerpo y comida; cualquier otra recibe palabras genéricas y el título lleva «(contenido de ejemplo)». Para la demostración use **frutas** o **colores**.
- `npm test` **vacía** las bases de pruebas (nombres con «test»). La demostración debe correr contra las bases de desarrollo (`SQL_URL` y `MONGO_URI`); si alguna vez apuntó el servidor a las de pruebas, los datos sembrados se pierden.

## Qué hay en los datos

1 curso (1.º EGB A) con **8 estudiantes** (`A01` a `A08`, sin nombres), **3 actividades aprobadas** (Vocales con animales —con dos versiones—, Sílabas de la naturaleza, Vocales de la casa), **1 borrador** por revisar (Sílabas con animales), **14 partidas terminadas** con resultados variados y **1 partida a medias** (A07, en el ejercicio 3 de «Sílabas de la naturaleza»).

## Recorrido

| Min | Qué se muestra | Qué se dice | Resultado esperado |
|---|---|---|---|
| 0:00 | Portada → **Ingresar** | «Es para docentes de primeros grados: prepara, juega en el aula y ve cómo le fue» | Entra al Inicio |
| 0:45 | **Inicio** | «Lo primero que ve es dónde continuar y un panorama corto» | 1 curso, 4 actividades, **1 partida a medias**, **14 terminadas** esta semana |
| 1:30 | **Cursos y estudiantes** | «Los estudiantes se identifican con un código de lista; no se guardan nombres completos» | 8 estudiantes `A01`–`A08` |
| 2:30 | **Crear con IA** | «Pide una actividad. La IA solo propone; el docente revisa y aprueba. Tiene un cupo diario» | Formulario y cupo del día. Si se genera: borrador listo en segundos |
| 4:00 | **Revisar el borrador** (Sílabas con animales) → **Vista previa** → corregir una consigna → **Guardar** → **Aprobar** | «Nada llega a los estudiantes sin su aprobación. Así lo verá el estudiante» | La vista previa responde como el aula; al aprobar pasa a «Lista» |
| 5:30 | **Iniciar en el aula** (la actividad recién aprobada) → elegir `A08` → jugar un ejercicio | «El estudiante ve un ejercicio a la vez, con dos intentos y mensajes positivos» | «¡Muy bien!» y avance |
| 6:30 | **Salir** y volver al **Inicio**: la partida aparece en «Para retomar» → **Continuar** | «Si se interrumpe, no se pierde: sigue donde se quedó» | Retoma en el ejercicio donde quedó |
| 7:30 | **Resultados** | «No son una nota: son números con su total para decidir dónde reforzar» | **14 partidas terminadas**; aciertos al primer intento **53 de 70 (76 %)**; sin pista **63 de 70 (90 %)**; completados **70 de 70**; **87 intentos** |
| 8:30 | **Mis actividades** → **Vocales con animales** → **Editar como versión nueva** | «Una versión aprobada no cambia; lo jugado antes conserva su versión» | Aparece un borrador nuevo; la versión vigente sigue intacta |
| 9:30 | Cierre | «Repetir una actividad no gasta IA, y todo se guarda en el servidor» | — |

## Tramo opcional: temática libre (≈3 min, con el generador falso)

Se intercala en el minuto 2:30 (Crear con IA) o se muestra al final. Necesita `GENERACION_LIBRE_HABILITADA=true` (ver arriba) y gasta **1 de las 3 generaciones diarias** de la cuenta.

| Qué se hace | Qué se dice | Resultado esperado |
|---|---|---|
| **Crear con IA** → **Contar sílabas** → **Otra temática** → escribir **frutas** (o **colores**) → 5 ejercicios → **Generar actividad** | «Ya no está limitado al catálogo: escribe una temática y la IA propone las palabras» | Aparece «Contar sílabas · Temática libre: frutas · 5 ejercicios» en «Tus solicitudes» y el cupo baja en uno |
| **Revisar** | «La palabra y la respuesta correcta las calcula el sistema, no la IA, y no se pueden cambiar. Usted corrige la consigna, la pista y el icono» | Con frutas y el generador falso salen uva, papaya, manzana, guayaba y naranja, con respuestas **2, 3, 3, 3, 3** (el generador es determinista) |
| Señalar el aviso del icono → **Elegir otro icono** (opcional) | «El sistema solo comprueba que el icono sea seguro, no que sea el dibujo correcto: eso lo revisa usted» | Se abre la lista por tipo; **Esc** la cierra y el foco vuelve al botón |
| **Aprobar** → **Iniciar en el aula** → un estudiante | «Nada llega al estudiante sin su aprobación» | «Actividad aprobada», el foco queda en «Iniciar en el aula» y el ejercicio muestra la palabra grande y tres números |

Qué decir y qué **no** prometer:
- **No** prometa «qué sonido hace el animal». «Sonidos de animales» genera los **nombres** de los animales (perro, vaca…), porque el sistema no admite onomatopeyas (límite C5 en `limites-y-problemas-conocidos.md`). Para la demostración use **frutas** o **colores**.
- Con el generador falso la calidad de las palabras **no** es la de la IA real: diga que es contenido de ejemplo para probar el flujo.
- Con **colores** las palabras no llevan icono (el color se enseña con el nombre escrito).
- Si ensaya y deja una actividad con un icono cambiado a propósito, **no la use en la demostración**: siembre una cuenta nueva con `DEMO_CORREO` o archive la actividad (ver «Si algo falla»).

## Si algo falla

| Problema | Qué hacer |
|---|---|
| El servidor no arranca con `AI_ENABLED=true` y el mensaje habla de `tiempoLimiteMs`, `margenConciliacionMs`, `presupuestoMensual`, `costoMaximoLlamada`, `tarifaEntrada` o `tarifaSalida` | Falta una de las seis variables obligatorias (ver «Encender la generación…»). Es por diseño: no hay valores por defecto |
| «Otra temática» aparece bloqueada | Falta `GENERACION_LIBRE_HABILITADA=true` o `AI_ENABLED=true`. Reiniciar el servidor con ellas |
| Una actividad de ensayo quedó con datos de prueba | En **Mis actividades** abrirla y **Archivar** (conserva resultados, no se borra), o sembrar una cuenta nueva con `DEMO_CORREO` |
| No carga la API | Mostrar la captura de Resultados y el video; explicar que es el mismo recorrido |
| La IA no responde o está apagada | Es esperable y seguro: se muestra el aviso y se crea la actividad a mano |
| Una partida quedó mal para el ensayo siguiente | Sembrar una cuenta nueva (`DEMO_CORREO=…`) |
| Se cerró la sesión | Ingresar de nuevo: no se pierde nada |

## Lo que conviene **no** hacer en vivo
- Habilitar la IA real (cuesta dinero y depende del proveedor).
- Encender la temática libre con la IA real: antes hay que medir su costo y validar la ampliación del SRS con el docente de la asignatura (`aceptacion.md` §6, criterio 13).
- Escribir en «Otra temática» algo que no sea frutas, colores u otra de la lista: el generador falso devolvería palabras genéricas marcadas como «contenido de ejemplo».
- Crear estudiantes con nombres reales o escribir datos personales en la indicación a la IA.
- Abrir la página de otro docente o cuentas de prueba distintas de la de demostración.

## Registro de ensayos

| Fecha | Quién | Duración real | Qué falló o se atascó | Cambio hecho |
|---|---|---|---|---|
| | | | | |

Criterio de cierre del plan: «demostración completa dentro del tiempo disponible». Anotar aquí el tiempo disponible: ______ min.
