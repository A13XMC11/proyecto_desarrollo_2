import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { BotonEnlace } from "../componentes";

// Entrada escalonada de 70 ms: se ve una vez por visita (nivel "raro"), así que tiene permiso de lucirse
const retraso = (i) => ({ animationDelay: `${i * 70}ms` });

// Ilustración hecha con HTML: no pesa como una imagen y no mueve el diseño al cargar
const VistaJuego = () => (
  <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
    <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-marca-100 via-marca-50 to-white" />
    <div className="rounded-3xl border border-marca-100 bg-white p-6 shadow-xl shadow-marca-900/5">
      <div className="mb-5 flex items-center justify-between text-sm">
        <span className="font-medium text-tenue">Ejercicio 2 de 5</span>
        <span className="flex gap-1.5">
          {[1, 1, 0, 0, 0].map((hecho, i) => (
            <span key={i} className={`h-2 w-6 rounded-full ${hecho ? "bg-marca-600" : "bg-marca-100"}`} />
          ))}
        </span>
      </div>
      <p className="text-center text-tenue">¿Con qué vocal empieza?</p>
      <p className="my-4 text-center font-titulo text-5xl font-black tracking-wide text-marca-900">oso</p>
      <div className="grid grid-cols-3 gap-3">
        {["A", "E", "O"].map((letra) => (
          <span
            key={letra}
            className={`grid h-20 place-items-center rounded-2xl font-titulo text-4xl font-black ${
              letra === "O"
                ? "bg-exito-suave text-exito ring-2 ring-exito"
                : "bg-marca-50 text-marca-800 ring-1 ring-marca-200"
            }`}
          >
            {letra}
          </span>
        ))}
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-exito-suave py-2.5 font-medium text-exito">
        <Check className="size-5" /> ¡Muy bien! Oso empieza con O
      </p>
    </div>
    <div className="absolute -bottom-5 -left-3 hidden rounded-2xl bg-white px-4 py-3 text-sm shadow-lg ring-1 ring-borde sm:block">
      <span className="font-bold text-tinta">4 de 5</span>
      <span className="text-tenue"> al primer intento</span>
    </div>
  </div>
);

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
        <VistaJuego />
      </div>
    </div>
  </section>
);
