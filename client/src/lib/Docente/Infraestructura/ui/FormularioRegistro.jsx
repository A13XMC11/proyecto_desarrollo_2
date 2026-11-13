import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Boton, Campo, MensajeError } from "../../../../Infraestructura/ui/componentes";
import { useSesion } from "../../Aplicacion/SesionContexto";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validar = ({ nombre, correo, contrasena }) => {
  const errores = {};
  if (nombre.trim().length < 2) errores.nombre = "Escribe tu nombre (al menos 2 letras).";
  if (!CORREO.test(correo.trim())) errores.correo = "Revisa el correo, parece incompleto.";
  if (contrasena.length < 8) errores.contrasena = "Usa al menos 8 caracteres.";
  return errores;
};

// El servidor responde en texto; lo llevamos al campo que corresponde para que el error quede junto a él
const errorDelServidor = (error) => {
  if (error.estado === 409) return { correo: "Ya hay una cuenta con este correo. ¿Quieres ingresar?" };
  const m = error.message.toLowerCase();
  if (m.includes("correo")) return { correo: "El servidor no aceptó este correo." };
  if (m.includes("contrasena")) return { contrasena: error.message.replace("contrasena", "La contraseña") };
  if (m.includes("nombre")) return { nombre: "Revisa el nombre." };
  if (m.includes("institucion")) return { institucion: "Revisa el nombre de la institución (máximo 100 caracteres)." };
  return null;
};

export const FormularioRegistro = ({ compacto = false }) => {
  const { registrar } = useSesion();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ nombre: "", correo: "", contrasena: "", institucion: "" });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [verClave, setVerClave] = useState(false);

  const cambiar = (campo) => (e) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }));
    if (errores[campo]) setErrores((er) => ({ ...er, [campo]: undefined }));
  };

  // Validación al salir del campo, no en cada tecla
  const alSalir = (campo) => () => {
    if (!datos[campo]) return;
    const encontrado = validar(datos)[campo];
    if (encontrado) setErrores((er) => ({ ...er, [campo]: encontrado }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    const encontrados = validar(datos);
    setErrores(encontrados);
    setErrorGeneral(null);
    if (Object.keys(encontrados).length) {
      document.getElementById(`registro-${Object.keys(encontrados)[0]}`)?.focus();
      return;
    }
    setEnviando(true);
    try {
      await registrar({
        nombre: datos.nombre.trim(),
        correo: datos.correo.trim(),
        contrasena: datos.contrasena,
        ...(datos.institucion.trim() && { institucion: datos.institucion.trim() })
      });
      navegar("/panel/cursos", { state: { bienvenida: true } });
    } catch (error) {
      const deCampo = errorDelServidor(error);
      if (deCampo) setErrores(deCampo);
      else setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {!compacto && <h2 className="text-2xl font-extrabold">Crea tu cuenta</h2>}
      <MensajeError error={errorGeneral} />
      <Campo id="registro-nombre" etiqueta="Tu nombre" autoComplete="name" requerido value={datos.nombre} onChange={cambiar("nombre")} onBlur={alSalir("nombre")} error={errores.nombre} />
      <Campo id="registro-correo" etiqueta="Correo" type="email" inputMode="email" autoComplete="email" requerido value={datos.correo} onChange={cambiar("correo")} onBlur={alSalir("correo")} error={errores.correo} />
      <div className="relative">
        <Campo
          id="registro-contrasena"
          etiqueta="Contraseña"
          type={verClave ? "text" : "password"}
          autoComplete="new-password"
          requerido
          value={datos.contrasena}
          onChange={cambiar("contrasena")}
          onBlur={alSalir("contrasena")}
          error={errores.contrasena}
          ayuda="Mínimo 8 caracteres."
          className="[&_input]:pr-12"
        />
        <button
          type="button"
          onClick={() => setVerClave((v) => !v)}
          className="absolute right-1 top-[1.85rem] grid size-11 cursor-pointer place-items-center rounded-lg text-tenue"
          aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {verClave ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
      </div>
      <Campo id="registro-institucion" etiqueta="Institución (opcional)" autoComplete="organization" value={datos.institucion} onChange={cambiar("institucion")} error={errores.institucion} />
      <Boton type="submit" tamano="lg" cargando={enviando} className="mt-1 w-full">
        {enviando ? "Creando tu cuenta…" : "Crear cuenta"}
      </Boton>
      <p className="text-center text-sm text-tenue">
        ¿Ya tienes cuenta?{" "}
        <Link to="/ingresar" className="font-medium text-marca-700 underline-offset-4 hover:underline">
          Ingresa aquí
        </Link>
      </p>
    </form>
  );
};
