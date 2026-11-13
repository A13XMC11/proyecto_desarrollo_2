import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Boton, Campo, Logo, MensajeError } from "../../../../Infraestructura/ui/componentes";
import { useSesion } from "../../Aplicacion/SesionContexto";
import { FormularioRegistro } from "./FormularioRegistro";

const MarcoAcceso = ({ titulo, descripcion, children }) => (
  <main className="grid min-h-dvh lg:grid-cols-2">
    <div className="flex flex-col px-4 py-8 sm:px-10">
      <Link to="/" className="self-start rounded-lg" aria-label="Volver a la portada">
        <Logo />
      </Link>
      <div className="mx-auto my-auto w-full max-w-sm py-10">
        <h1 className="text-3xl font-black">{titulo}</h1>
        <p className="mb-8 mt-2 text-tenue">{descripcion}</p>
        {children}
      </div>
    </div>
    <aside className="relative hidden overflow-hidden bg-marca-600 lg:block" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.18),transparent_45%)]" />
      <div className="relative flex h-full flex-col justify-end p-14 text-white">
        <p className="font-titulo text-[7rem] font-black leading-none tracking-tight text-white/90">a e i o u</p>
        <p className="mt-6 max-w-sm text-lg text-marca-100">
          Cinco vocales, muchas palabras. Un rato de juego al día suma más de lo que parece.
        </p>
      </div>
    </aside>
  </main>
);

export const PaginaRegistro = () => {
  const { docente } = useSesion();
  if (docente) return <Navigate to="/panel" replace />;
  return (
    <MarcoAcceso titulo="Crea tu cuenta" descripcion="Gratis. Solo necesitas un correo.">
      <title>Crear cuenta · Letritas</title>
      <meta name="description" content="Crea tu cuenta de docente en Letritas y arma minijuegos de vocales y sílabas para tu curso." />
      <FormularioRegistro compacto />
    </MarcoAcceso>
  );
};

export const PaginaIngreso = () => {
  const { docente, ingresar } = useSesion();
  const navegar = useNavigate();
  const { state } = useLocation();
  const [datos, setDatos] = useState({ correo: "", contrasena: "" });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (docente) return <Navigate to={state?.desde || "/panel"} replace />;

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    if (!datos.correo.trim() || !datos.contrasena) {
      setError({ message: "Escribe tu correo y tu contraseña." });
      return;
    }
    setEnviando(true);
    try {
      await ingresar({ correo: datos.correo.trim(), contrasena: datos.contrasena });
      navegar(state?.desde || "/panel", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <MarcoAcceso titulo="Hola de nuevo" descripcion="Ingresa para ver tus cursos y actividades.">
      <title>Ingresar · Letritas</title>
      <form onSubmit={enviar} noValidate className="grid gap-4">
        <MensajeError error={error} />
        <Campo etiqueta="Correo" type="email" inputMode="email" autoComplete="email" value={datos.correo} onChange={(e) => setDatos((d) => ({ ...d, correo: e.target.value }))} />
        <Campo etiqueta="Contraseña" type="password" autoComplete="current-password" value={datos.contrasena} onChange={(e) => setDatos((d) => ({ ...d, contrasena: e.target.value }))} />
        <Boton type="submit" tamano="lg" cargando={enviando} className="mt-1 w-full">
          {enviando ? "Ingresando…" : "Ingresar"}
        </Boton>
        <p className="text-center text-sm text-tenue">
          ¿Aún no tienes cuenta?{" "}
          <Link to="/registro" className="font-medium text-marca-700 underline-offset-4 hover:underline">
            Créala gratis
          </Link>
        </p>
      </form>
    </MarcoAcceso>
  );
};
