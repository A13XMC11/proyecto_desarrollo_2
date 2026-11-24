import { useState } from "react";
import { KeyRound, Link2, RefreshCw, Lock } from "lucide-react";
import { Boton, MensajeError } from "../../../../Infraestructura/ui/componentes";
import { useAvisos } from "../../../../Infraestructura/ui/Avisos";
import { AulaApiHttp } from "../AulaApiHttp";

const formatear = (codigo) => `${codigo.slice(0, 4)}-${codigo.slice(4)}`;

// Acceso de los estudiantes a /jugar: un código por curso que el docente abre, cambia o cierra.
// Cada estudiante entra con ese código y su número de lista (sin cuenta ni contraseña).
export const PanelAcceso = ({ curso, alCambiar }) => {
  const avisar = useAvisos();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState(null);
  const enlace = curso.codigoAcceso ? `${window.location.origin}/jugar?codigo=${curso.codigoAcceso}` : "";

  const ejecutar = async (accion, mensaje) => {
    setTrabajando(true);
    setError(null);
    try {
      alCambiar(await accion(curso.id));
      avisar(mensaje);
    } catch (e) {
      setError(e);
    } finally {
      setTrabajando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      avisar("Enlace copiado. Compártelo con tu curso.");
    } catch {
      avisar("No se pudo copiar. Selecciona el código y cópialo a mano.");
    }
  };

  return (
    <section aria-labelledby="acceso-titulo" className="border-b border-borde bg-marca-50/40 p-5">
      <h3 id="acceso-titulo" className="flex items-center gap-2 font-extrabold"><KeyRound className="size-5 text-marca-700" aria-hidden="true" /> Acceso para estudiantes</h3>
      <MensajeError error={error} />
      {curso.codigoAcceso ? (
        <>
          <p className="mt-2 text-sm text-tenue">
            Pídeles que abran <strong className="text-tinta">{window.location.host}/jugar</strong> y escriban este código con su número de lista. Solo ven las actividades aprobadas de este curso.
          </p>
          <p className="mt-3 select-all font-mono text-3xl font-black tracking-[0.2em] text-marca-900" aria-label={`Código del curso: ${curso.codigoAcceso.split("").join(" ")}`}>{formatear(curso.codigoAcceso)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton tamano="sm" onClick={copiar}><Link2 className="size-4" aria-hidden="true" /> Copiar enlace</Boton>
            <Boton tamano="sm" variante="secundario" disabled={trabajando} onClick={() => ejecutar(AulaApiHttp.abrirAcceso, "Código nuevo. El anterior ya no funciona.")}><RefreshCw className="size-4" aria-hidden="true" /> Cambiar código</Boton>
            <Boton tamano="sm" variante="fantasma" disabled={trabajando} onClick={() => ejecutar(AulaApiHttp.cerrarAcceso, "Acceso cerrado. Nadie puede entrar con el código.")}><Lock className="size-4" aria-hidden="true" /> Cerrar acceso</Boton>
          </div>
        </>
      ) : (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-tenue">Cerrado: los estudiantes no pueden entrar por su cuenta. Ábrelo para que jueguen desde casa o desde el aula.</p>
          <Boton tamano="sm" cargando={trabajando} onClick={() => ejecutar(AulaApiHttp.abrirAcceso, "Acceso abierto. Comparte el código con tu curso.")}>Abrir acceso</Boton>
        </div>
      )}
    </section>
  );
};
