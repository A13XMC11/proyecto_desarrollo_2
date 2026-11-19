import { useConsulta } from "../../../Infraestructura/http/useConsulta";
import { JuegoApiHttp } from "../Infraestructura/JuegoApiHttp";

export const useJuegos = (filtros = {}) =>
  useConsulta(() => JuegoApiHttp.listar(filtros), [JSON.stringify(filtros)]);

// Juego y sus versiones juntos: la pantalla de detalle necesita los dos
export const useJuego = (id) =>
  useConsulta(async () => {
    const [juego, versiones] = await Promise.all([JuegoApiHttp.obtener(id), JuegoApiHttp.listarVersiones(id)]);
    return { juego, versiones: [...versiones].sort((a, b) => (b.numero || 0) - (a.numero || 0)) };
  }, [id]);

// Palabras del catálogo de una temática (de ahí salen los ejercicios)
export const useRecursos = (tematica) =>
  useConsulta(() => (tematica ? JuegoApiHttp.recursos(tematica) : Promise.resolve([])), [tematica]);
