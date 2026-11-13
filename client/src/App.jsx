import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { ProveedorSesion } from "./lib/Docente/Aplicacion/SesionContexto";
import { ProveedorAvisos } from "./Infraestructura/ui/Avisos";
import { BotonEnlace } from "./Infraestructura/ui/componentes";
import { PaginaPortada } from "./Infraestructura/ui/portada/PaginaPortada";

// La portada va en el paquete inicial (es lo que ve Google y quien llega por primera vez);
// el panel y el modo aula se cargan aparte, solo cuando se entra a ellos.
const desde = (cargar, nombre) => lazy(() => cargar().then((m) => ({ default: m[nombre] })));

const PaginaRegistro = desde(() => import("./lib/Docente/Infraestructura/ui/PaginasAcceso"), "PaginaRegistro");
const PaginaIngreso = desde(() => import("./lib/Docente/Infraestructura/ui/PaginasAcceso"), "PaginaIngreso");
const PlantillaDocente = desde(() => import("./Infraestructura/ui/PlantillaDocente"), "PlantillaDocente");
const PaginaInicio = desde(() => import("./lib/Docente/Infraestructura/ui/PaginasPanel"), "PaginaInicio");
const PaginaCuenta = desde(() => import("./lib/Docente/Infraestructura/ui/PaginasPanel"), "PaginaCuenta");
const PaginaCursos = desde(() => import("./lib/Aula/Infraestructura/ui/PaginaCursos"), "PaginaCursos");
const PaginaActividades = desde(() => import("./lib/Juego/Infraestructura/ui/PaginaActividades"), "PaginaActividades");
const PaginaNuevaActividad = desde(() => import("./lib/Juego/Infraestructura/ui/PaginaNuevaActividad"), "PaginaNuevaActividad");
const PaginaActividad = desde(() => import("./lib/Juego/Infraestructura/ui/PaginaActividad"), "PaginaActividad");
const PaginaCrearConIA = desde(() => import("./lib/Generacion/Infraestructura/ui/PaginaCrearConIA"), "PaginaCrearConIA");
const PaginaResultados = desde(() => import("./lib/Partida/Infraestructura/ui/PaginaResultados"), "PaginaResultados");
const PaginaAula = desde(() => import("./lib/Partida/Infraestructura/ui/PaginaAula"), "PaginaAula");

const Espera = () => <div className="min-h-dvh bg-fondo" aria-busy="true" />;

const NoEncontrada = () => (
  <main className="grid min-h-dvh place-items-center px-4 text-center">
    <meta name="robots" content="noindex" />
    <title>Página no encontrada · Letritas</title>
    <div>
      <p className="font-titulo text-7xl font-black text-marca-200">404</p>
      <h1 className="mt-2 text-2xl font-extrabold">Esta página no existe</h1>
      <p className="mt-2 text-tenue">Puede que el enlace esté mal escrito o que la página se haya movido.</p>
      <BotonEnlace to="/" className="mt-6">Ir a la portada</BotonEnlace>
    </div>
  </main>
);

export const App = () => (
  <ProveedorSesion>
    <ProveedorAvisos>
      <Suspense fallback={<Espera />}>
        <Routes>
          <Route path="/" element={<PaginaPortada />} />
          <Route path="/registro" element={<PaginaRegistro />} />
          <Route path="/ingresar" element={<PaginaIngreso />} />
          <Route path="/panel" element={<PlantillaDocente />}>
            <Route index element={<PaginaInicio />} />
            <Route path="actividades" element={<PaginaActividades />} />
            <Route path="actividades/nueva" element={<PaginaNuevaActividad />} />
            <Route path="actividades/:id" element={<PaginaActividad />} />
            <Route path="crear" element={<PaginaCrearConIA />} />
            <Route path="cursos" element={<PaginaCursos />} />
            <Route path="resultados" element={<PaginaResultados />} />
            <Route path="cuenta" element={<PaginaCuenta />} />
          </Route>
          <Route path="/aula/partida/:partidaId" element={<PaginaAula />} />
          <Route path="/aula/:juegoId" element={<PaginaAula />} />
          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </Suspense>
    </ProveedorAvisos>
  </ProveedorSesion>
);
