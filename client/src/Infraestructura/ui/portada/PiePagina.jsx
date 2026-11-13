import { Link } from "react-router-dom";
import { Logo } from "../componentes";

export const PiePagina = () => (
  <footer className="border-t border-borde bg-white">
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
      <div className="max-w-xs">
        <Logo />
        <p className="mt-3 text-sm leading-relaxed text-tenue">
          Minijuegos de vocales y sílabas para reforzar la lectura en los primeros años de escuela.
        </p>
      </div>
      <nav aria-label="Pie de página" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
        <p className="col-span-2 mb-1 font-bold text-tinta sm:col-span-1">Producto</p>
        <a className="py-1 text-tenue hover:text-tinta sm:col-start-1" href="#como-funciona">Cómo funciona</a>
        <a className="py-1 text-tenue hover:text-tinta sm:col-start-1" href="#precio">Precio</a>
        <a className="py-1 text-tenue hover:text-tinta sm:col-start-1" href="#preguntas">Preguntas</a>
        <p className="col-span-2 mb-1 mt-3 font-bold text-tinta sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:mt-0">Cuenta</p>
        <Link className="py-1 text-tenue hover:text-tinta sm:col-start-2 sm:row-start-2" to="/registro">Crear cuenta</Link>
        <Link className="py-1 text-tenue hover:text-tinta sm:col-start-2 sm:row-start-3" to="/ingresar">Ingresar</Link>
      </nav>
    </div>
    <div className="border-t border-borde py-5 text-center text-sm text-tenue">
      © {new Date().getFullYear()} Letritas · Proyecto académico
    </div>
  </footer>
);
