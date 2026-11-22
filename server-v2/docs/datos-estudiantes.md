# Datos de estudiantes: inventario y decisión pendiente (S5-09)

El plan exige una **decisión escrita** de la institución o del docente piloto sobre la base jurídica, la autorización de
representantes y las condiciones de acceso, conservación y supresión **antes de usar datos reales de estudiantes**.
Este documento no es esa decisión ni asesoría jurídica: reúne lo que el sistema hace hoy, para que quien decida lo tenga
delante, y deja la plantilla para firmarla.

> **Regla vigente hasta que exista la decisión: solo datos ficticios.** Códigos de lista inventados (`A01`…), sin nombres
> reales, sin datos de personas reales.

## 1. Qué guarda el sistema hoy (verificado en los modelos)

### Estudiante (PostgreSQL, tabla `estudiantes`)
| Campo | Qué es | Obligatorio |
|---|---|---|
| `codigoLista` | Código de 1 a 6 letras o números (p. ej. `A01`), único por curso | Sí |
| `apodo` | Texto libre de hasta 20 caracteres | No |
| `franjaEdad` | 5, 6 o 7 | Sí |
| `avatarId` | Avatar elegido de una lista | Sí |
| intereses | Temáticas de interés (animales, objetos cotidianos, naturaleza) | No |
| `archivado` | Indicador | — |

**No se guarda:** nombre completo, apellido, fotografía, fecha de nacimiento, correo, teléfono, dirección, datos de
representantes ni cédula. (El campo `apodo` es texto libre: puede contener un nombre si el docente lo escribe; la
interfaz debería advertirlo.)

### Actividad del estudiante (MongoDB)
- **Partidas:** a qué juego y versión jugó, ejercicio actual, intentos, pistas, ejercicios resueltos, soluciones reveladas, fechas, estado.
- **Interacciones:** eventos de uso (`inicio_partida`, `intento`, `pista`, `reanudacion`, `fin_partida` y `consulta_resultados`) con el canal (docente o aula; computador o tableta) y fecha.
- La aplicación no guarda la dirección IP ni el navegador del estudiante. El **alojamiento** (proxy, servidor, base) puede registrarlos en sus propios registros: es un punto a revisar con el proveedor elegido.

### Docente (PostgreSQL, tabla `usuarios`)
Nombre, correo, institución (opcional) y **hash** de la contraseña (nunca la contraseña). La sesión (cookie `HttpOnly`)
se guarda en MongoDB y caduca por inactividad (4 h) y por duración máxima (12 h).

### Con la IA
La solicitud al proveedor lleva solo habilidad, mecánica, temática, franja de edad, cantidad, la instrucción escrita por
el docente (máx. 500 caracteres, sin HTML, URL ni correos) y los recursos del catálogo. **No** se envían nombres,
códigos de lista ni identificadores de estudiantes o docentes. Riesgo residual: la instrucción es texto libre y la
interfaz pide al docente no escribir nombres, pero no hay forma de impedirlo del todo.

## 2. Salvaguardas que ya existen

- Cada docente solo accede a sus datos (se filtra por su sesión; un id ajeno responde 404).
- Escrituras protegidas por sesión y token CSRF; cookie `HttpOnly`, `Secure` en producción.
- La contraseña se guarda con hash.
- Los resultados se calculan en el servidor; el estudiante nunca ve respuestas correctas antes de contestar.

## 3. Lagunas encontradas (relevantes para «conservación y supresión»)

Son hechos del código actual, no se han corregido: cambiarlos es una decisión del equipo.

1. **No hay borrado real de estudiantes ni de cursos.** «Eliminar» archiva (el estudiante deja de verse pero sus datos y su historial de partidas se conservan). No existe un procedimiento para suprimir los datos de un estudiante a petición.
2. **Una cuenta de docente solo se puede eliminar si no tiene datos asociados.** Un docente con cursos o actividades no puede borrar su cuenta ni sus datos desde la aplicación.
3. **No hay plazo de conservación.** Las partidas e interacciones no caducan.
4. **No hay exportación** de los datos de un estudiante.
5. **Sin aviso de privacidad en la aplicación** ni registro del consentimiento.
6. **Respaldos:** aún no definidos (S6-02); cuando existan, la supresión también debe alcanzarlos.

## 4. Decisión a tomar (plantilla)

Completar con la institución o el docente piloto. Dejar «pendiente» lo que no se haya acordado.

| Punto | Decisión | Quién decide | Fecha |
|---|---|---|---|
| ¿Se usarán datos reales de estudiantes en la prueba piloto? (sí / no) | | | |
| Base jurídica del tratamiento (p. ej. autorización de los representantes, o la que indique la institución) | | | |
| Forma y soporte de la autorización de representantes | | | |
| Quién tiene acceso a los datos (docente, institución, equipo del proyecto) | | | |
| ¿Se permite el campo `apodo`? ¿Con qué regla (sin nombres reales)? | | | |
| Plazo de conservación de partidas e interacciones | | | |
| Procedimiento y plazo para suprimir los datos de un estudiante o de un curso | | | |
| Qué ocurre con los datos al terminar el proyecto / el año lectivo | | | |
| Dónde están alojados los datos (país y proveedor) y si la institución lo acepta | | | |
| Responsable de atender solicitudes de familias | | | |

Referencia a revisar con quien corresponda en la institución: lo que disponga la normativa de protección de datos
personales del país (en Ecuador, la Ley Orgánica de Protección de Datos Personales) para datos de niñas y niños. Este
proyecto no la interpreta.

## 5. Cierre de S5-09

- [ ] Decisión escrita y firmada por quien corresponde (adjuntar)
- [ ] Si la respuesta es «sí, datos reales»: laguna 1 y 2 resueltas o aceptadas por escrito, aviso de privacidad visible, y regla del campo `apodo` aplicada
- [ ] Si la respuesta es «no»: se mantiene la regla de solo datos ficticios y así consta en el informe de la prueba piloto
