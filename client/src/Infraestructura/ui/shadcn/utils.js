import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper estándar de shadcn: une clases y resuelve conflictos de Tailwind
export const cn = (...entradas) => twMerge(clsx(entradas));
