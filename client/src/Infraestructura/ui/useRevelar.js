import { useEffect, useRef } from "react";

// Marca el elemento como visible la primera vez que entra en pantalla (solo portada).
// Un solo observador por elemento y se desconecta al revelar: no hay trabajo en cada scroll.
export const useRevelar = () => {
  const ref = useRef(null);
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return undefined;
    if (!("IntersectionObserver" in window)) {
      elemento.dataset.visible = "true";
      return undefined;
    }
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          elemento.dataset.visible = "true";
          observador.disconnect();
        }
      },
      { rootMargin: "0px 0px -80px 0px" }
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return ref;
};
