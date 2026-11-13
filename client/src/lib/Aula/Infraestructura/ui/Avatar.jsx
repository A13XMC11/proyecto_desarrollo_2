import { Bird, Cat, Fish, Rabbit, Squirrel, Turtle, User } from "lucide-react";

const ICONOS = { gato: Cat, ave: Bird, tortuga: Turtle, pez: Fish, conejo: Rabbit, ardilla: Squirrel };
const FONDOS = {
  gato: "bg-amber-100 text-amber-800",
  ave: "bg-sky-100 text-sky-800",
  tortuga: "bg-emerald-100 text-emerald-800",
  pez: "bg-marca-100 text-marca-800",
  conejo: "bg-rose-100 text-rose-800",
  ardilla: "bg-orange-100 text-orange-800"
};

export const Avatar = ({ id, tamano = "size-10" }) => {
  const Icono = ICONOS[id] || User;
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${FONDOS[id] || "bg-slate-100 text-slate-600"} ${tamano}`} aria-hidden="true">
      <Icono className="size-[55%]" />
    </span>
  );
};
