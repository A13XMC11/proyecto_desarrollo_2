// Componente de 21st.dev: "Classic Header with Sheet Menu" (@ln-dev7/header-17)
// https://21st.dev/@ln-dev7/components/header-17
// Adaptado a Letritas: JSX en lugar de TSX, textos en español, enlaces del router, logo propio,
// barra fija con sombra al desplazar y botones según la sesión del docente.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Menu } from "lucide-react";
import { Button } from "../shadcn/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../shadcn/sheet";
import { Logo } from "../componentes";
import { useSesion } from "../../../lib/Docente/Aplicacion/SesionContexto";

const navLinks = [
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "En el aula", href: "#en-el-aula" },
  { label: "Precio", href: "#precio" },
  { label: "Preguntas", href: "#preguntas" }
];

export const Header17 = () => {
  const { docente: docenteGuardado } = useSesion();
  const [open, setOpen] = useState(false);
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

  const Acciones = ({ movil = false }) =>
    docente ? (
      <Button asChild className={movil ? "w-full rounded-full" : "rounded-full px-5"}>
        <Link to="/panel" onClick={() => setOpen(false)}>Ir a mi panel <ArrowRight /></Link>
      </Button>
    ) : (
      <>
        <Button asChild variant={movil ? "outline" : "ghost"} className={movil ? "w-full rounded-md" : ""}>
          <Link to="/ingresar" onClick={() => setOpen(false)}>Ingresar</Link>
        </Button>
        <Button asChild className={movil ? "w-full rounded-full" : "rounded-full px-5"}>
          <Link to="/registro" onClick={() => setOpen(false)}>Crear cuenta <ArrowRight /></Link>
        </Button>
      </>
    );

  return (
    <section
      className={`sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md transition-[border-color] duration-200 ${
        conSombra ? "border-border shadow-[0_1px_8px_rgb(15_23_42/0.05)]" : "border-transparent"
      }`}
    >
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* min-h-11 en pantallas táctiles (tabletas): zona de toque de 44 px */}
        <Link to="/" aria-label="Letritas, inicio" className="flex items-center rounded-md pointer-coarse:min-h-11">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Principal">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="flex items-center rounded-md px-3 py-2 pointer-coarse:min-h-11 text-[15px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Acciones />
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menú"
              className="grid size-11 cursor-pointer place-items-center rounded-full border border-border text-foreground transition-colors hover:bg-muted md:hidden"
            >
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-72 flex-col border-border p-6">
            <SheetHeader className="mb-6">
              <SheetTitle asChild>
                <Link to="/" onClick={() => setOpen(false)} className="w-fit">
                  <Logo />
                </Link>
              </SheetTitle>
              <SheetDescription className="sr-only">Navegación de la portada</SheetDescription>
            </SheetHeader>

            <nav className="flex flex-col gap-1" aria-label="Principal móvil">
              {navLinks.map((link) => (
                <a key={link.label} href={link.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted">
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-2 border-t border-border pt-6">
              <Acciones movil />
            </div>
          </SheetContent>
        </Sheet>
      </header>
    </section>
  );
};
