import { useId } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";

// Primitivas compartidas. Presión: scale(0.97) en 150ms con curva fuerte; el hover de Tailwind 4
// ya solo se aplica en dispositivos con puntero, así que no hay hovers falsos en tabletas.

const VARIANTES = {
  primario: "bg-marca-600 text-white shadow-sm shadow-marca-600/20 hover:bg-marca-700",
  secundario: "bg-white text-marca-800 ring-1 ring-inset ring-marca-200 hover:bg-marca-50",
  fantasma: "text-marca-800 hover:bg-marca-50",
  peligro: "bg-white text-error ring-1 ring-inset ring-error/30 hover:bg-error-suave"
};

const TAMANOS = {
  md: "min-h-11 px-4 text-[15px]",
  lg: "min-h-13 px-6 text-base",
  sm: "min-h-9 px-3 text-sm"
};

const clasesBoton = (variante, tamano, extra = "") =>
  `inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-xl font-medium
   transition-[scale,background-color,color] duration-150 ease-[var(--ease-salida)]
   active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50
   ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`;

export const Boton = ({ variante = "primario", tamano = "md", cargando = false, children, className, ...resto }) => (
  <button
    type="button"
    className={clasesBoton(variante, tamano, className)}
    aria-busy={cargando || undefined}
    {...resto}
    disabled={cargando || resto.disabled}
  >
    {cargando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
    {children}
  </button>
);

// Con `to` navega dentro de la app; con `href` es un ancla normal (por ejemplo, a una sección de la portada)
export const BotonEnlace = ({ variante = "primario", tamano = "md", children, className, href, ...resto }) =>
  href ? (
    <a href={href} className={clasesBoton(variante, tamano, className)} {...resto}>
      {children}
    </a>
  ) : (
    <Link className={clasesBoton(variante, tamano, className)} {...resto}>
      {children}
    </Link>
  );

const clasesEntrada = (error) =>
  `w-full min-h-11 rounded-xl border bg-white px-3.5 text-base text-tinta placeholder:text-slate-400
   transition-[border-color] duration-150 focus:outline-none focus:ring-4
   ${error ? "border-error focus:ring-error/30" : "border-borde focus:border-marca-600 focus:ring-marca-600/30"}`;

const Etiqueta = ({ id, texto, requerido }) => (
  <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-tinta">
    {texto}
    {requerido && <span className="text-error" aria-hidden="true"> *</span>}
  </label>
);

const Ayuda = ({ id, error, ayuda }) =>
  error ? (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-error">
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {error}
    </p>
  ) : ayuda ? (
    <p id={id} className="mt-1.5 text-sm text-tenue">{ayuda}</p>
  ) : null;

export const Campo = ({ id: idExterno, etiqueta, error, ayuda, requerido, className = "", ...resto }) => {
  const idGenerado = useId();
  const id = idExterno || idGenerado;
  return (
    <div className={className}>
      <Etiqueta id={id} texto={etiqueta} requerido={requerido} />
      <input
        id={id}
        className={clasesEntrada(error)}
        required={requerido}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error || ayuda ? `${id}-ayuda` : undefined}
        {...resto}
      />
      <Ayuda id={`${id}-ayuda`} error={error} ayuda={ayuda} />
    </div>
  );
};

export const AreaTexto = ({ etiqueta, error, ayuda, className = "", ...resto }) => {
  const id = useId();
  return (
    <div className={className}>
      <Etiqueta id={id} texto={etiqueta} />
      <textarea
        id={id}
        className={`${clasesEntrada(error)} min-h-24 py-2.5`}
        aria-describedby={error || ayuda ? `${id}-ayuda` : undefined}
        {...resto}
      />
      <Ayuda id={`${id}-ayuda`} error={error} ayuda={ayuda} />
    </div>
  );
};

export const Selector = ({ etiqueta, opciones, error, ayuda, requerido, className = "", ...resto }) => {
  const id = useId();
  return (
    <div className={className}>
      <Etiqueta id={id} texto={etiqueta} requerido={requerido} />
      <div className="relative">
        <select
          id={id}
          className={`${clasesEntrada(error)} cursor-pointer appearance-none pr-10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
          required={requerido}
          aria-describedby={error || ayuda ? `${id}-ayuda` : undefined}
          {...resto}
        >
          {opciones.map(({ valor, texto }) => (
            <option key={valor} value={valor}>{texto}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-tenue" aria-hidden="true" />
      </div>
      <Ayuda id={`${id}-ayuda`} error={error} ayuda={ayuda} />
    </div>
  );
};

export const Tarjeta = ({ as: Etiq = "div", className = "", children, ...resto }) => (
  <Etiq className={`rounded-2xl border border-borde bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] ${className}`} {...resto}>
    {children}
  </Etiq>
);

const TONOS = {
  azul: "bg-marca-50 text-marca-800 ring-marca-200",
  gris: "bg-slate-100 text-slate-700 ring-slate-200",
  verde: "bg-exito-suave text-exito ring-green-200",
  ambar: "bg-amber-50 text-amber-800 ring-amber-200",
  rojo: "bg-error-suave text-error ring-red-200"
};

export const Insignia = ({ tono = "azul", children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONOS[tono]}`}>
    {children}
  </span>
);

export const Encabezado = ({ titulo, descripcion, acciones }) => (
  <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-2xl font-extrabold text-tinta sm:text-3xl">{titulo}</h1>
      {descripcion && <p className="mt-1 max-w-prose text-tenue">{descripcion}</p>}
    </div>
    {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
  </header>
);

export const EstadoVacio = ({ icono: Icono, titulo, texto, accion }) => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-marca-200 bg-marca-50/40 px-6 py-12 text-center">
    {Icono && (
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-white text-marca-600 shadow-sm">
        <Icono className="size-6" aria-hidden="true" />
      </span>
    )}
    <h2 className="text-lg font-bold">{titulo}</h2>
    {texto && <p className="mt-1 max-w-sm text-tenue">{texto}</p>}
    {accion && <div className="mt-5">{accion}</div>}
  </div>
);

// Esqueleto: reserva el espacio del contenido para que nada salte al cargar
export const Cargando = ({ filas = 3, alto = "h-20" }) => (
  <div className="grid gap-3" role="status" aria-label="Cargando">
    {Array.from({ length: filas }, (_, i) => (
      <div key={i} className={`${alto} animate-pulse rounded-2xl bg-slate-100`} />
    ))}
  </div>
);

export const MensajeError = ({ error, alReintentar }) =>
  error ? (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-error-suave/60 p-4 text-error sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {error.message || "Algo salió mal."}
      </p>
      {alReintentar && (
        <Boton variante="peligro" tamano="sm" onClick={alReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  ) : null;

export const Logo = ({ claro = false }) => (
  <span className={`inline-flex items-center gap-2 font-titulo text-xl font-black ${claro ? "text-white" : "text-tinta"}`}>
    <svg viewBox="0 0 64 64" className="size-8" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill={claro ? "#fff" : "#2563eb"} />
      <path d="M20 44V20h7v18h15v6z" fill={claro ? "#2563eb" : "#fff"} />
      <circle cx="45" cy="22" r="5" fill="#fbbf24" />
    </svg>
    Letritas
  </span>
);
