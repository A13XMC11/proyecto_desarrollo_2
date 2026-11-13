import { BarraNavegacion } from "./BarraNavegacion";
import { Hero } from "./Hero";
import { ComoFunciona, EnElAula, LlamadoFinal, Precio, Preguntas } from "./Secciones";
import { PiePagina } from "./PiePagina";
import { FormularioRegistro } from "../../../lib/Docente/Infraestructura/ui/FormularioRegistro";

export const PaginaPortada = () => (
  <>
    <a href="#principal" className="sr-only z-50 rounded-lg bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
      Saltar al contenido
    </a>
    <BarraNavegacion />
    <main id="principal">
      <Hero />
      <ComoFunciona />
      <EnElAula />
      <Precio />
      <Preguntas />
      <LlamadoFinal>
        <FormularioRegistro />
      </LlamadoFinal>
    </main>
    <PiePagina />
  </>
);
