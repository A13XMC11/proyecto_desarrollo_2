# Cliente: Letritas (React + Vite)

Frontend de la plataforma de minijuegos. Espeja la estructura del servidor (sección 5.3 del plan):

```text
src/
├── main.jsx, App.jsx            arranque y rutas (el panel y el aula se cargan aparte)
├── entry-server.jsx             solo para prerenderizar la portada en el build
├── index.css                    Tailwind 4 + tokens de diseño (@theme) y animaciones
├── Infraestructura/
│   ├── http/                    clienteHttp.js (único fetch) y useConsulta.js
│   └── ui/                      componentes compartidos, plantillas, avisos y portada/
└── lib/<Modulo>/                Docente, Aula, Juego, Generacion, Partida
    ├── Dominio/                 solo donde hay una regla del cliente
    ├── Aplicacion/              hooks de caso de uso
    └── Infraestructura/         <Modulo>ApiHttp.js y ui/
```

## Cómo arrancar

```bash
npm install
npm run dev        # http://localhost:5173, /api va al servidor en :3977 (ver vite.config.js)
npm run build      # compila y prerenderiza la portada en dist/index.html (SEO)
```

El servidor (`../server-v2`) tiene que estar corriendo con PostgreSQL y MongoDB.

## Pendientes conocidos

- Sesión: el servidor aún no usa cookie; el cliente guarda la vista pública del docente y envía `x-docente-id`.
  Cuando exista la sesión, solo cambian `clienteHttp.js` y `SesionContexto.jsx`.
- Resultados: los indicadores se calculan en `lib/Partida/Dominio/Indicadores.js` sobre los intentos que el servidor
  ya evaluó. Deben pasar a un endpoint `GET /api/resultados`.
- Generación con IA: el servidor deja la solicitud en `pendiente`; la pantalla ya muestra estados y cupo.
- Dominio público: `index.html`, `robots.txt` y `sitemap.xml` usan `https://letritas.app` como provisional.
