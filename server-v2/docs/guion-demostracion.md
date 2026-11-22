# Guion de la demostración (S6-05)

Recorrido de unos **10 minutos** con datos ficticios. Las cifras de este guion salen de `npm run sembrar:demo` (datos fijos: salen
igual cada vez). **El cronometraje real y el ensayo con personas están pendientes**: los tiempos de abajo son una estimación a confirmar.

## Antes de empezar (preparación)

- [ ] API y cliente en marcha (`npm run dev` en `server-v2` y en `client`, o la URL publicada)
- [ ] Datos cargados: `npm run sembrar:demo -- --url=<URL de la API>`. Para tener una copia **intacta** en cada ensayo: `DEMO_CORREO=demo2@letritas.ec npm run sembrar:demo -- --url=…`
- [ ] Cuenta: `demo@letritas.ec` / `Demo-12345` (o la que se haya sembrado)
- [ ] Generación con IA: decidir antes si se **muestra** (con generador falso: `AI_ENABLED=true`, `AI_PROVEEDOR=falso`, ver `despliegue.md` §2) o se muestra la pantalla «desactivada». **No** depender de la IA real salvo que S4-08 esté firmado
- [ ] Un navegador sin sesiones abiertas, con zoom al 110 % para que se vea desde atrás
- [ ] Plan B a mano: captura de la pantalla de resultados y el video del recorrido

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

## Si algo falla

| Problema | Qué hacer |
|---|---|
| No carga la API | Mostrar la captura de Resultados y el video; explicar que es el mismo recorrido |
| La IA no responde o está apagada | Es esperable y seguro: se muestra el aviso y se crea la actividad a mano |
| Una partida quedó mal para el ensayo siguiente | Sembrar una cuenta nueva (`DEMO_CORREO=…`) |
| Se cerró la sesión | Ingresar de nuevo: no se pierde nada |

## Lo que conviene **no** hacer en vivo
- Habilitar la IA real (cuesta dinero y depende del proveedor).
- Crear estudiantes con nombres reales o escribir datos personales en la indicación a la IA.
- Abrir la página de otro docente o cuentas de prueba distintas de la de demostración.

## Registro de ensayos

| Fecha | Quién | Duración real | Qué falló o se atascó | Cambio hecho |
|---|---|---|---|---|
| | | | | |

Criterio de cierre del plan: «demostración completa dentro del tiempo disponible». Anotar aquí el tiempo disponible: ______ min.
