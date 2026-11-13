import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { BotonEnlace, Logo } from "../componentes";
import { useSesion } from "../../../lib/Docente/Aplicacion/SesionContexto";

const ENLACES = [
  { href: "#como-funciona", texto: "Cómo funciona" },
  { href: "#en-el-aula", texto: "En el aula" },
  { href: "#precio", texto: "Precio" },
  { href: "#preguntas", texto: "Preguntas" }
];

export const BarraNavegacion = () => {
  const { docente: docenteGuardado } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [conSombra, setConSombra] = useState(false);
  // La portada se prerenderiza sin sesión: la sesión se muestra tras montar para que la hidratación coincida
  const [montado, setMontado] = useState(false);
  const docente = montado ? docenteGuardado : null;

  // Solo cambia una clase al cruzar 8px: no hay trabajo por cada evento de scroll
  useEffect(() => {
    setMontado(true);
    const alDesplazar = () => setConSombra(window.scrollY > 8);
    alDesplazar();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => window.removeEventListener("scroll", alDesplazar);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/90 backdrop-blur-md transition-[border-color] duration-200 ${
        conSombra ? "border-borde shadow-[0_1px_8px_rgb(15_23_42/0.05)]" : "border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Principal">
        <Link to="/" aria-label="Letritas, inicio" className="rounded-lg">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {ENLACES.map(({ href, texto }) => (
            <li key={href}>
              <a href={href} className="rounded-lg px-3 py-2 text-[15px] text-tenue transition-colors hover:text-tinta">
                {texto}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          {docente ? (
            <BotonEnlace to="/panel">Ir a mi panel</BotonEnlace>
          ) : (
            <>
              <BotonEnlace to="/ingresar" variante="fantasma">Ingresar</BotonEnlace>
              <BotonEnlace to="/registro">Crear cuenta</BotonEnlace>
            </>
          )}
        </div>

        <button
          type="button"
          className="grid size-11 cursor-pointer place-items-center rounded-xl text-tinta md:hidden"
          aria-expanded={abierto}
          aria-controls="menu-movil"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
        </button>
      </nav>

      {abierto && (
        <div id="menu-movil" className="animate-aparecer border-t border-borde bg-white px-4 pb-5 pt-2 [animation-duration:220ms] md:hidden">
          <ul className="grid">
            {ENLACES.map(({ href, texto }) => (
              <li key={href}>
                <a href={href} onClick={() => setAbierto(false)} className="block rounded-xl px-3 py-3 text-base text-tinta">
                  {texto}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2">
            {docente ? (
              <BotonEnlace to="/panel">Ir a mi panel</BotonEnlace>
            ) : (
              <>
                <BotonEnlace to="/registro">Crear cuenta</BotonEnlace>
                <BotonEnlace to="/ingresar" variante="secundario">Ingresar</BotonEnlace>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
