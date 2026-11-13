import { BookOpenCheck, Check, GitBranch, Archive, BarChart3, Lock, Users, Wand2, ClipboardCheck, MonitorPlay } from "lucide-react";
import { useRevelar } from "../useRevelar";
import { BotonEnlace } from "../componentes";

const Revelar = ({ as: Etiq = "div", className = "", children, ...resto }) => {
  const ref = useRevelar();
  return (
    <Etiq ref={ref} className={`revelar ${className}`} {...resto}>
      {children}
    </Etiq>
  );
};

const TituloSeccion = ({ antetitulo, titulo, texto }) => (
  <Revelar className="mx-auto mb-12 max-w-2xl text-center">
    <p className="mb-2 text-sm font-bold uppercase tracking-wider text-marca-600">{antetitulo}</p>
    <h2 className="text-3xl font-black text-tinta sm:text-4xl">{titulo}</h2>
    {texto && <p className="mt-4 text-lg text-tenue">{texto}</p>}
  </Revelar>
);

const PASOS = [
  {
    icono: Users,
    titulo: "Arma tu curso",
    texto: "Registra a tus estudiantes con un apodo o su número de lista. No hace falta nada más."
  },
  {
    icono: Wand2,
    titulo: "Pide la actividad",
    texto: "Vocales con animales o sílabas con objetos de casa, de 5 o 10 ejercicios. Puedes añadir una nota, como \"practicar la A y la E\"."
  },
  {
    icono: ClipboardCheck,
    titulo: "Revísala tú",
    texto: "Nada llega a los niños sin tu visto bueno. Cambias una consigna o una pista, o descartas el borrador entero."
  },
  {
    icono: MonitorPlay,
    titulo: "Juéguenla en clase",
    texto: "Botones grandes, dos intentos por ejercicio y una pista. Si se va el internet, la partida sigue donde quedó."
  }
];

export const ComoFunciona = () => (
  <section id="como-funciona" className="scroll-mt-20 bg-fondo py-20 sm:py-28">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <TituloSeccion
        antetitulo="Cómo funciona"
        titulo="De la idea al juego en una mañana"
        texto="La IA te ahorra escribir los ejercicios. Las decisiones siguen siendo tuyas."
      />
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
          <Revelar as="li" key={titulo} style={{ transitionDelay: `${i * 60}ms` }} className="relative rounded-2xl border border-borde bg-white p-6">
            <span className="absolute right-5 top-5 font-titulo text-4xl font-black text-marca-100" aria-hidden="true">
              {i + 1}
            </span>
            <span className="mb-4 grid size-11 place-items-center rounded-xl bg-marca-600 text-white">
              <Icono className="size-5" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-extrabold">{titulo}</h3>
            <p className="mt-2 leading-relaxed text-tenue">{texto}</p>
          </Revelar>
        ))}
      </ol>
    </div>
  </section>
);

const VENTAJAS = [
  {
    icono: BarChart3,
    titulo: "Resultados con números claros",
    texto: "Ves cuántos ejercicios salieron al primer intento y cuántos con pista. Siempre \"4 de 5\", nunca un 80 % suelto que no dice de dónde sale."
  },
  {
    icono: Lock,
    titulo: "La tableta no conoce la respuesta",
    texto: "El servidor corrige cada intento. La respuesta correcta no llega al navegador hasta que el ejercicio termina."
  },
  {
    icono: GitBranch,
    titulo: "Editar no borra lo jugado",
    texto: "Si cambias una actividad que ya se jugó, se guarda como versión nueva. Los resultados anteriores siguen hablando de lo que los niños vieron."
  },
  {
    icono: Archive,
    titulo: "Archivar en lugar de borrar",
    texto: "Cuando termina el año, archivas el curso y su historial se queda guardado por si lo necesitas."
  }
];

export const EnElAula = () => (
  <section id="en-el-aula" className="scroll-mt-20 py-20 sm:py-28">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <TituloSeccion antetitulo="En el aula" titulo="Pensado para una pantalla compartida y niños de 5 a 7 años" />
      <div className="grid gap-5 md:grid-cols-2">
        {VENTAJAS.map(({ icono: Icono, titulo, texto }, i) => (
          <Revelar key={titulo} style={{ transitionDelay: `${(i % 2) * 60}ms` }} className="flex gap-4 rounded-2xl border border-borde p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca-50 text-marca-700 ring-1 ring-marca-100">
              <Icono className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-lg font-extrabold">{titulo}</h3>
              <p className="mt-1.5 leading-relaxed text-tenue">{texto}</p>
            </div>
          </Revelar>
        ))}
      </div>
    </div>
  </section>
);

const INCLUYE = [
  "Cursos y estudiantes sin límite",
  "Tu biblioteca de actividades guardadas",
  "3 actividades nuevas con IA por día",
  "Volver a jugar una actividad no gasta cupo"
];

export const Precio = () => (
  <section id="precio" className="scroll-mt-20 bg-fondo py-20 sm:py-28">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <TituloSeccion antetitulo="Precio" titulo="Gratis para docentes" texto="Letritas es un proyecto académico. No hay planes de pago ni prueba que se vence." />
      <Revelar className="mx-auto max-w-md overflow-hidden rounded-3xl bg-white shadow-xl shadow-marca-900/5 ring-1 ring-marca-100">
        <div className="bg-marca-600 px-8 py-7 text-white">
          <p className="font-medium text-marca-100">Cuenta docente</p>
          <p className="mt-1 font-titulo text-5xl font-black">
            $0 <span className="text-lg font-bold text-marca-100">para siempre</span>
          </p>
        </div>
        <div className="px-8 py-7">
          <ul className="grid gap-3">
            {INCLUYE.map((texto) => (
              <li key={texto} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-marca-100 text-marca-700">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
          <BotonEnlace to="/registro" tamano="lg" className="mt-7 w-full">
            Crear mi cuenta
          </BotonEnlace>
          <p className="mt-3 text-center text-sm text-tenue">El cupo de IA se renueva cada día.</p>
        </div>
      </Revelar>
    </div>
  </section>
);

const PREGUNTAS = [
  {
    p: "¿Los niños necesitan correo o contraseña?",
    r: "No. Tú inicias la actividad en la pantalla del aula y eliges quién juega. Los estudiantes nunca entran con una cuenta."
  },
  {
    p: "¿Qué datos de los estudiantes se guardan?",
    r: "Un código de lista (por ejemplo, 07), un apodo opcional, la edad aproximada y un avatar. Ninguno de esos datos se envía a la IA."
  },
  {
    p: "¿Y si la IA se equivoca?",
    r: "Por eso cada actividad empieza como borrador. Solo cuando tú la apruebas se puede jugar en clase."
  },
  {
    p: "¿Sirve para calificar?",
    r: "No es una calificación ni un diagnóstico. Los resultados te ayudan a ver dónde reforzar, y la última palabra es tuya."
  }
];

export const Preguntas = () => (
  <section id="preguntas" className="scroll-mt-20 py-20 sm:py-28">
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <TituloSeccion antetitulo="Preguntas" titulo="Lo que suelen preguntar otros docentes" />
      <div className="grid gap-3">
        {PREGUNTAS.map(({ p, r }) => (
          <details key={p} className="group rounded-2xl border border-borde bg-white px-5 open:bg-marca-50/40">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-bold [&::-webkit-details-marker]:hidden">
              {p}
              <span className="text-2xl leading-none text-marca-600 transition-transform duration-200 group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="pb-5 leading-relaxed text-tenue">{r}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

export const LlamadoFinal = ({ children }) => (
  <section id="registro" className="scroll-mt-20 bg-marca-900 py-20 text-white sm:py-28">
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
      <Revelar>
        <BookOpenCheck className="mb-5 size-10 text-acento" aria-hidden="true" />
        <h2 className="text-3xl font-black sm:text-4xl">Prepara la primera actividad de tu curso hoy</h2>
        <p className="mt-4 max-w-md text-lg text-marca-100">
          Crear la cuenta toma un minuto. Después registras tu curso y ya puedes armar un juego de vocales para mañana.
        </p>
      </Revelar>
      <Revelar className="rounded-3xl bg-white p-6 text-tinta shadow-2xl sm:p-8">{children}</Revelar>
    </div>
  </section>
);
