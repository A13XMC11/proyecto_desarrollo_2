import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { Home, Library, Sparkles, Users, BarChart3, UserCircle, LogOut, Menu, X } from "lucide-react";
import { Logo } from "./componentes";
import { useSesion } from "../../lib/Docente/Aplicacion/SesionContexto";

const SECCIONES = [
  { a: "/panel", texto: "Inicio", icono: Home, exacto: true },
  { a: "/panel/actividades", texto: "Mis actividades", icono: Library },
  { a: "/panel/crear", texto: "Crear con IA", icono: Sparkles },
  { a: "/panel/cursos", texto: "Cursos y estudiantes", icono: Users },
  { a: "/panel/resultados", texto: "Resultados", icono: BarChart3 },
  { a: "/panel/cuenta", texto: "Mi cuenta", icono: UserCircle }
];

// Navegación de uso diario: sin animaciones, el cambio de sección es inmediato
const Navegacion = ({ alElegir }) => {
  const { docente, salir } = useSesion();
  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Zona del docente" className="grid gap-1">
        {SECCIONES.map(({ a, texto, icono: Icono, exacto }) => (
          <NavLink
            key={a}
            to={a}
            end={exacto}
            onClick={alElegir}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors ${
                isActive ? "bg-marca-600 text-white" : "text-tenue hover:bg-marca-50 hover:text-tinta"
              }`
            }
          >
            <Icono className="size-5 shrink-0" aria-hidden="true" />
            {texto}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-borde pt-4">
        <p className="truncate px-3 text-sm font-bold text-tinta" title={docente?.nombre}>{docente?.nombre}</p>
        <p className="truncate px-3 text-xs text-tenue" title={docente?.correo}>{docente?.correo}</p>
        <button
          type="button"
          onClick={salir}
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-tenue transition-colors hover:bg-error-suave hover:text-error"
        >
          <LogOut className="size-5" aria-hidden="true" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export const PlantillaDocente = () => {
  const { docente } = useSesion();
  const ubicacion = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const principal = useRef(null);
  const botonMenu = useRef(null);
  const estabaAbierto = useRef(false);

  // Menú móvil como diálogo: Escape lo cierra y, al cerrarse, el foco vuelve al botón que lo abrió
  useEffect(() => {
    if (menuAbierto) {
      estabaAbierto.current = true;
      const alPulsar = (e) => e.key === "Escape" && setMenuAbierto(false);
      document.addEventListener("keydown", alPulsar);
      return () => document.removeEventListener("keydown", alPulsar);
    }
    if (estabaAbierto.current) {
      estabaAbierto.current = false;
      botonMenu.current?.focus();
    }
    return undefined;
  }, [menuAbierto]);

  // Al cambiar de página, el foco va al contenido para quien usa lector de pantalla
  useEffect(() => {
    principal.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [ubicacion.pathname]);

  if (!docente) return <Navigate to="/ingresar" replace state={{ desde: ubicacion.pathname }} />;

  return (
    <div className="min-h-dvh bg-fondo lg:grid lg:grid-cols-[17rem_1fr]">
      <meta name="robots" content="noindex" />
      <a href="#contenido" className="sr-only z-50 rounded-lg bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Saltar al contenido
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-borde bg-white px-4 py-6 lg:flex">
        <Link to="/panel" className="mb-8 px-2"><Logo /></Link>
        <Navegacion />
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-borde bg-white/95 px-4 backdrop-blur lg:hidden">
        <Link to="/panel"><Logo /></Link>
        <button
          ref={botonMenu}
          type="button"
          onClick={() => setMenuAbierto(true)}
          className="grid size-11 cursor-pointer place-items-center rounded-xl"
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
        >
          <Menu className="size-6" aria-hidden="true" />
        </button>
      </header>

      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" className="absolute inset-0 cursor-default bg-tinta/40" aria-label="Cerrar menú" onClick={() => setMenuAbierto(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white px-4 py-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo />
              {/* autoFocus: al abrir, el foco entra al menú (no se queda detrás de la capa oscura) */}
              <button type="button" autoFocus onClick={() => setMenuAbierto(false)} className="grid size-11 cursor-pointer place-items-center rounded-xl" aria-label="Cerrar menú">
                <X className="size-6" aria-hidden="true" />
              </button>
            </div>
            <Navegacion alElegir={() => setMenuAbierto(false)} />
          </div>
        </div>
      )}

      <main id="contenido" ref={principal} tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
};
