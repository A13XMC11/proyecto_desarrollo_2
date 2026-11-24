# Arquitectura

Para entender el proyecto y poder explicarlo: **frontend, API, datos e IA**. Los diagramas usan Mermaid (se ven en GitHub y en
la mayoría de editores). Describen el código tal como está; el detalle por archivo está en `server-v2/README.md`.

## 1. Vista general

```mermaid
flowchart LR
  subgraph Navegador
    C["Cliente React (Vite)<br/>panel del docente + modo aula"]
  end
  C -- "/api/* (mismo origen,<br/>cookie de sesión + CSRF)" --> A
  subgraph Servidor["Servidor Node (Express)"]
    A["API REST<br/>módulos: Docente, Aula, Juego,<br/>Canal, Generacion, Partida"]
  end
  A -- "Sequelize" --> P[("PostgreSQL<br/>docentes, cursos, estudiantes,<br/>generaciones y cuotas de IA")]
  A -- "Mongoose" --> M[("MongoDB<br/>juegos, versiones, partidas,<br/>interacciones, canales, sesiones")]
  A -. "solo al generar contenido" .-> G["Proveedor de IA (OpenAI)<br/>apagado por defecto"]
```

- **Dos bases a propósito.** PostgreSQL para lo que necesita claves foráneas, unicidad y operaciones atómicas por fila (cuentas, cursos, estudiantes y **control de IA**: cupos y reservas). MongoDB para documentos que se leen enteros (juegos con sus ejercicios, partidas con sus intentos). Los ids de PostgreSQL se guardan como texto en MongoDB; no hay claves foráneas entre motores, así que **la propiedad se comprueba en la aplicación** antes de escribir.
- **Mismo origen.** El cliente llama a `/api` con rutas relativas y la cookie es `SameSite=Lax`: en desarrollo lo hace el proxy de Vite y en producción debe hacerlo un proxy (ver `despliegue.md`).
- **La IA solo participa al generar.** Jugar, ver resultados o repetir una actividad no llaman al proveedor.

## 2. Capas de cada módulo (arquitectura hexagonal)

```mermaid
flowchart TB
  subgraph Infraestructura
    H["http/ (Routes, Controller, index.js que compone)"]
    R["Repositorios y Modelos<br/>(Sequelize o Mongoose)"]
    X["Adaptadores externos<br/>(catálogo JSON, generador de IA)"]
  end
  subgraph Aplicacion
    U["Casos de uso: uno por archivo<br/>p. ej. IniciarPartida, SolicitarGeneracion"]
  end
  subgraph Dominio
    E["Entidades y reglas<br/>(validan al construirse)"]
    PO["Ports (interfaces):<br/>I...Repository, IGeneradorContenido"]
  end
  H --> U
  U --> E
  U --> PO
  R -. "implementa" .-> PO
  X -. "implementa" .-> PO
  R --> E
```

Reglas que verifica `tests/arquitectura/capas.test.js` (si se rompen, la prueba falla):
- `Dominio` solo importa `Dominio` y `validator`.
- `Aplicacion` no importa `Infraestructura`, `express`, `mongoose` ni `sequelize`; entre módulos solo importa `Dominio`.
- `Infraestructura` no importa `Aplicacion` ni `Infraestructura` ajenas (solo `http/index.js` compone).
- No hay ciclos entre módulos.

**Cambiar un motor o un proveedor toca solo `Infraestructura`.** Por ejemplo, pasar del generador falso al de IA cambia solo `crearGenerador()` en `Generacion/Infraestructura/http/index.js`.

## 3. Módulos

| Módulo | Qué hace | Datos | Rutas principales |
|---|---|---|---|
| Docente | Registro, sesión, cuenta | PostgreSQL | `/api/docentes` |
| Aula | Cursos y estudiantes (códigos de lista, sin nombres completos) | PostgreSQL | `/api/cursos`, `/api/estudiantes` |
| Juego | Actividades, versiones (borrador → aprobada, inmutable), catálogo de recursos | MongoDB | `/api/juegos`, `/api/recursos` |
| Partida | Jugar: iniciar, intentos evaluados **en el servidor**, pistas, resultados, inicio del docente | MongoDB | `/api/partidas`, `/api/resultados`, `/api/inicio` |
| Generacion | Pedir una actividad a la IA con cupo y presupuesto; conciliación | PostgreSQL (+ borrador en MongoDB) | `/api/generaciones`, `/api/cuotas` |
| Canal | Origen de cada acción (docente/aula × computador/tableta) | MongoDB | `/api/canales` |

El cliente tiene la misma estructura (`client/src/lib/<Módulo>/{Dominio, Aplicacion, Infraestructura}`): llamadas HTTP, hooks y pantallas por módulo.

## 4. Seguridad y sesión

```mermaid
sequenceDiagram
  participant N as Navegador
  participant S as API
  participant M as MongoDB (sesiones)
  N->>S: POST /api/docentes/sesion (correo, contraseña)
  S->>M: crea sesión nueva (regenera el id) + token CSRF
  S-->>N: Set-Cookie letritas.sid (HttpOnly, SameSite=Lax, Secure en producción) + cabecera X-CSRF-Token
  N->>S: POST /api/juegos (cookie + X-CSRF-Token)
  S->>M: lee la sesión
  S->>S: ¿docente en sesión? ¿token CSRF válido? ¿el recurso es suyo?
  S-->>N: 201 / 404 si es de otro docente
```

- La identidad sale **solo de la sesión**, nunca de un dato que envíe el cliente. Un id ajeno responde 404.
- La sesión vive en MongoDB (sobrevive a reinicios) y caduca a las 4 h sin actividad o 12 h en total.
- El cliente **nunca recibe respuestas correctas antes de contestar**: el servidor evalúa cada intento y la retroalimentación sale de textos fijos del servidor, no de la IA.

## 5. Generación con IA

```mermaid
sequenceDiagram
  participant D as Docente
  participant S as SolicitarGeneracion
  participant Q as PostgreSQL (cupos)
  participant G as Generador (IA o falso)
  participant V as Validación pedagógica
  participant M as MongoDB (borrador)
  D->>S: POST /api/generaciones (Idempotency-Key)
  S->>S: valida parámetros y que el curso/estudiante sean suyos
  S->>S: ¿AI_ENABLED? si no, 503 y no se gasta nada
  S->>Q: reserva atómica: 1 simultánea, cupo diario, costo máximo de la llamada
  S->>G: UNA llamada con tiempo límite (sin reintentos)
  G-->>S: datos (nunca código): recursos elegidos y textos
  S->>V: valida contra el catálogo (respuesta correcta, sílabas, pistas...)
  alt contenido válido
    S->>M: guarda juego y versión en BORRADOR
    S->>Q: registra el consumo real y libera lo no usado
  else inválido o fallo del proveedor
    S->>Q: el cupo diario queda consumido (pudo haber costo)
  end
  S-->>D: generación completada o fallida con un motivo comprensible
  D->>M: revisa, corrige y APRUEBA (obligatorio) antes de que lo vea un estudiante
```

Puntos que conviene saber explicar:
- La IA **elige recursos del catálogo y redacta consignas y pistas**; el servidor arma los ids, las opciones y las sílabas. Aunque el modelo invente algo, la validación lo rechaza.
- **Idempotencia:** la misma `Idempotency-Key` devuelve la misma generación (restricción única por docente en PostgreSQL); doble clic no gasta dos veces.
- **Conciliación al arrancar y al consultar:** una caída entre pasos no duplica el borrador ni deja reservas colgadas; las vencidas pasan a `interrumpida` sin reintentar.

```mermaid
stateDiagram-v2
  [*] --> pendiente
  pendiente --> procesando: cupo reservado
  pendiente --> fallida: sin cupo / apagada
  procesando --> completada: borrador guardado
  procesando --> fallida: error o contenido inválido
  procesando --> interrumpida: vence el tiempo
  completada --> [*]
  fallida --> [*]
  interrumpida --> [*]
```

## 6. Partida y versiones

- Una actividad tiene versiones: **borrador → aprobada**. Una versión aprobada **no se modifica**; editar crea una versión nueva.
- Una partida **congela la versión** con la que empezó: lo jugado antes conserva su contenido aunque se publique otra versión.
- Cada ejercicio admite 2 intentos; al segundo fallo se muestra la solución y se avanza. Las operaciones llevan un `operacionId`: reenviar la misma no cuenta dos veces.
- Solo una partida «en curso» por estudiante y actividad (índice único parcial en MongoDB).
