import { ArrowRight, ShieldCheck } from "lucide-react";
import { BotonEnlace } from "../componentes";
import { TarjetaJuego } from "./TarjetaJuego";

// Entrada escalonada de 70 ms: se ve una vez por visita (nivel "raro"), así que tiene permiso de lucirse
const retraso = (i) => ({ animationDelay: `${i * 70}ms` });

export const Hero = () => (
  <section className="relative overflow-hidden">
    <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
      <div>
        <p className="animate-aparecer mb-4 inline-flex items-center gap-2 rounded-full bg-marca-50 px-3 py-1 text-sm font-medium text-marca-800 ring-1 ring-marca-200" style={retraso(0)}>
          Para docentes de 1.º a 3.º de EGB
        </p>
        <h1 className="animate-aparecer text-4xl font-black leading-[1.08] text-tinta sm:text-5xl lg:text-[3.5rem]" style={retraso(1)}>
          Minijuegos de lectura que <span className="text-marca-600">tú revisas</span> antes de que lleguen al aula
        </h1>
        <p className="animate-aparecer mt-5 max-w-xl text-lg leading-relaxed text-tenue" style={retraso(2)}>
          Eliges vocales o sílabas, una temática y cuántos ejercicios quieres. La IA arma un borrador, tú lo corriges
          y tus estudiantes lo juegan en la pantalla de la clase.
        </p>
        <div className="animate-aparecer mt-8 flex flex-col gap-3 sm:flex-row" style={retraso(3)}>
          <BotonEnlace to="/registro" tamano="lg">
            Crear mi cuenta gratis <ArrowRight className="size-5" aria-hidden="true" />
          </BotonEnlace>
          <BotonEnlace href="#como-funciona" variante="secundario" tamano="lg">
            Ver cómo funciona
          </BotonEnlace>
        </div>
        <p className="animate-aparecer mt-6 flex items-start gap-2 text-sm text-tenue" style={retraso(4)}>
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-marca-600" aria-hidden="true" />
          No pedimos nombres completos ni fotos de los niños. Basta un apodo o su número de lista.
        </p>
      </div>
      <div className="animate-aparecer" style={retraso(3)}>
        <TarjetaJuego />
      </div>
    </div>
  </section>
);
