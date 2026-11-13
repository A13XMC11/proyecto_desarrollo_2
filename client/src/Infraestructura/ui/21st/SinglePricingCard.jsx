// Componente de 21st.dev: "Single Pricing Card" (@efferd/single-pricing-card-1)
// https://21st.dev/@efferd/components/single-pricing-card-1
// Adaptado a Letritas: un solo plan gratuito (el original compara mensual y anual), textos en español,
// colores del proyecto. Las entradas con framer-motion se reemplazaron por el revelado CSS de la portada
// y el borde animado (BorderTrail) pasó a una animación CSS: mismo efecto sin cargar una librería de JS.
import { Link } from "react-router-dom";
import { Check, PlusIcon, ShieldCheckIcon } from "lucide-react";
import { Badge } from "../shadcn/badge";
import { Button } from "../shadcn/button";
import { cn } from "../shadcn/utils";
import { useRevelar } from "../useRevelar";

const INCLUYE = [
  "Cursos y estudiantes sin límite",
  "Tu biblioteca de actividades guardadas",
  "3 actividades nuevas con IA por día",
  "Volver a jugar una actividad no gasta cupo"
];

// Equivalente CSS del BorderTrail original: un destello que recorre el borde de la tarjeta
const BorderTrail = ({ size = 100 }) => (
  <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]">
    <div
      className="borde-recorrido absolute aspect-square bg-primary"
      style={{ width: size, offsetPath: `rect(0 auto auto 0 round ${size}px)`, boxShadow: "0 0 60px 30px rgb(37 99 235 / 35%)" }}
    />
  </div>
);

export const SinglePricingCard = () => {
  const titulo = useRevelar();
  const tarjeta = useRevelar();

  return (
    <section id="precio" className="relative scroll-mt-20 overflow-hidden bg-fondo py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 sm:px-6">
        <div ref={titulo} className="revelar mx-auto max-w-xl space-y-5">
          <div className="flex justify-center">
            <div className="rounded-lg border border-border bg-background px-4 py-1 text-sm font-bold uppercase tracking-wider text-primary">Precio</div>
          </div>
          <h2 className="mt-5 text-center text-3xl font-black text-foreground sm:text-4xl">Gratis para docentes</h2>
          <p className="mt-5 text-center text-lg text-muted-foreground">
            Letritas es un proyecto académico. No hay planes de pago ni prueba que se vence.
          </p>
        </div>

        <div className="relative pt-6">
          <div
            className={cn(
              "pointer-events-none absolute inset-0 -z-0 size-full",
              "bg-[linear-gradient(to_right,rgb(37_99_235/0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgb(37_99_235/0.12)_1px,transparent_1px)]",
              "bg-[size:32px_32px]",
              "[mask-image:radial-gradient(ellipse_at_center,#fff_10%,transparent_70%)]"
            )}
          />

          <div ref={tarjeta} className="revelar relative mx-auto w-full max-w-2xl space-y-3" style={{ transitionDelay: "100ms" }}>
            <div className="relative grid border border-border bg-background p-4 md:grid-cols-2">
              <PlusIcon className="absolute -left-3 -top-3 size-5.5 text-primary" aria-hidden="true" />
              <PlusIcon className="absolute -right-3 -top-3 size-5.5 text-primary" aria-hidden="true" />
              <PlusIcon className="absolute -bottom-3 -left-3 size-5.5 text-primary" aria-hidden="true" />
              <PlusIcon className="absolute -bottom-3 -right-3 size-5.5 text-primary" aria-hidden="true" />

              <div className="w-full px-4 pb-4 pt-5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold leading-none">Cuenta docente</h3>
                    <Badge variant="secondary">Sin costo</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Para usar en tu aula desde hoy.</p>
                </div>
                <div className="mt-10 space-y-4">
                  <div className="flex items-end gap-0.5 text-xl text-muted-foreground">
                    <span>$</span>
                    <span className="-mb-0.5 font-titulo text-5xl font-black tracking-tighter text-foreground">0</span>
                    <span>/para siempre</span>
                  </div>
                  <Button className="w-full" asChild>
                    <Link to="/registro">Crear mi cuenta</Link>
                  </Button>
                </div>
              </div>

              <div className="relative w-full rounded-lg border border-border px-4 pb-4 pt-5">
                <BorderTrail size={100} />
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold leading-none">Qué incluye</h3>
                  <Badge>Todo</Badge>
                </div>
                <ul className="mt-6 grid gap-3 text-[15px]">
                  {INCLUYE.map((texto) => (
                    <li key={texto} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                      </span>
                      {texto}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-center gap-x-2 text-sm text-muted-foreground">
              <ShieldCheckIcon className="size-4" aria-hidden="true" />
              <span>El cupo de IA se renueva cada día. Sin costos ocultos.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
