// La palabra (o las sílabas con un hueco) que se muestra en grande sobre las opciones, con su icono.
// El icono es un emoji: ayuda a quien aún no lee con soltura, pero no se anuncia a lectores de pantalla.
const HUECO = "__";

export const ObjetivoGrande = ({ objetivo, icono, tamano = "sm:text-8xl" }) => {
  if (!objetivo) return null;
  const partes = objetivo.split(/\s+/);
  const hayHueco = partes.includes(HUECO);
  const lectura = partes.map((p) => (p === HUECO ? "espacio vacío" : p)).join(", ");
  return (
    <div className="my-6 grid justify-items-center gap-3">
      {icono && <span className="text-7xl leading-none sm:text-8xl" aria-hidden="true">{icono}</span>}
      <p
        className={`flex flex-wrap items-end justify-center gap-x-3 text-center font-titulo text-5xl font-black tracking-wide text-marca-900 sm:gap-x-4 ${tamano}`}
        aria-label={hayHueco ? lectura : undefined}
      >
        {hayHueco
          ? partes.map((p, i) =>
              p === HUECO ? (
                <span key={i} className="inline-block h-1.5 w-[1.4em] translate-y-[-0.1em] rounded-full bg-marca-300" aria-hidden="true" />
              ) : (
                <span key={i} aria-hidden="true">{p}</span>
              )
            )
          : objetivo}
      </p>
    </div>
  );
};
