import { useState } from "react";
import { Boton, Campo, MensajeError, Selector } from "../../../../Infraestructura/ui/componentes";
import { AVATARES, FRANJAS_EDAD, GRADOS, TEMATICAS, anioLectivoActual } from "../../../Juego/Dominio/ValoresPermitidos";
import { AulaApiHttp } from "../AulaApiHttp";
import { Avatar } from "./Avatar";

const traducirConflicto = (error, texto) => (error.estado === 409 ? { ...error, message: texto } : error);

export const FormularioCurso = ({ curso, alGuardar }) => {
  const [datos, setDatos] = useState({
    grado: curso?.grado || GRADOS[0],
    paralelo: curso?.paralelo || "A",
    anioLectivo: curso?.anioLectivo || anioLectivoActual()
  });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    const encontrados = {};
    if (!/^[A-Za-z]$/.test(datos.paralelo.trim())) encontrados.paralelo = "Una sola letra, de la A a la Z.";
    const [ini, fin] = datos.anioLectivo.split("-").map(Number);
    if (!/^\d{4}-\d{4}$/.test(datos.anioLectivo.trim()) || fin !== ini + 1) encontrados.anioLectivo = "Usa el formato 2026-2027.";
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;

    setEnviando(true);
    setError(null);
    try {
      const cuerpo = { ...datos, paralelo: datos.paralelo.trim().toUpperCase(), anioLectivo: datos.anioLectivo.trim() };
      const guardado = curso ? await AulaApiHttp.actualizarCurso(curso.id, cuerpo) : await AulaApiHttp.crearCurso(cuerpo);
      alGuardar(guardado);
    } catch (err) {
      setError(traducirConflicto(err, "Ya tienes un curso con ese grado, paralelo y año lectivo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      <MensajeError error={error} />
      <Selector etiqueta="Grado" requerido value={datos.grado} onChange={(e) => setDatos((d) => ({ ...d, grado: e.target.value }))} opciones={GRADOS.map((g) => ({ valor: g, texto: g }))} />
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Paralelo" requerido maxLength={1} value={datos.paralelo} onChange={(e) => setDatos((d) => ({ ...d, paralelo: e.target.value }))} error={errores.paralelo} />
        <Campo etiqueta="Año lectivo" requerido inputMode="numeric" value={datos.anioLectivo} onChange={(e) => setDatos((d) => ({ ...d, anioLectivo: e.target.value }))} error={errores.anioLectivo} />
      </div>
      <Boton type="submit" cargando={enviando} className="mt-2">{curso ? "Guardar cambios" : "Crear curso"}</Boton>
    </form>
  );
};

export const FormularioEstudiante = ({ cursoId, estudiante, alGuardar }) => {
  const [datos, setDatos] = useState({
    codigoLista: estudiante?.codigoLista || "",
    apodo: estudiante?.apodo || "",
    franjaEdad: estudiante?.franjaEdad || 6,
    avatarId: estudiante?.avatarId || AVATARES[0],
    intereses: estudiante?.intereses || []
  });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const alternarInteres = (tematica) =>
    setDatos((d) => ({
      ...d,
      intereses: d.intereses.includes(tematica) ? d.intereses.filter((t) => t !== tematica) : [...d.intereses, tematica]
    }));

  const enviar = async (e) => {
    e.preventDefault();
    const encontrados = {};
    if (!/^[A-Za-z0-9]{1,6}$/.test(datos.codigoLista.trim())) encontrados.codigoLista = "De 1 a 6 letras o números, por ejemplo 07.";
    if (datos.apodo.trim().split(/\s+/).length > 2) encontrados.apodo = "Máximo dos palabras.";
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;

    setEnviando(true);
    setError(null);
    const cuerpo = {
      codigoLista: datos.codigoLista.trim().toUpperCase(),
      apodo: datos.apodo.trim() || null,
      franjaEdad: Number(datos.franjaEdad),
      avatarId: datos.avatarId,
      intereses: datos.intereses
    };
    try {
      const guardado = estudiante
        ? await AulaApiHttp.actualizarEstudiante(estudiante.id, cuerpo)
        : await AulaApiHttp.crearEstudiante({ ...cuerpo, cursoId, apodo: cuerpo.apodo || undefined });
      alGuardar(guardado);
    } catch (err) {
      setError(traducirConflicto(err, "Ese código de lista ya lo usa otro estudiante del curso."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      <MensajeError error={error} />
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Código de lista" requerido maxLength={6} value={datos.codigoLista} onChange={(e) => setDatos((d) => ({ ...d, codigoLista: e.target.value }))} error={errores.codigoLista} ayuda="Por ejemplo, 07" />
        <Campo etiqueta="Apodo (opcional)" maxLength={20} value={datos.apodo} onChange={(e) => setDatos((d) => ({ ...d, apodo: e.target.value }))} error={errores.apodo} ayuda="Sin apellidos" />
      </div>
      <Selector
        etiqueta="Edad"
        value={datos.franjaEdad}
        onChange={(e) => setDatos((d) => ({ ...d, franjaEdad: e.target.value }))}
        opciones={FRANJAS_EDAD.map((n) => ({ valor: n, texto: `${n} años` }))}
      />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Avatar</legend>
        <div className="flex flex-wrap gap-2">
          {AVATARES.map((id) => (
            <label key={id} className="cursor-pointer">
              <input type="radio" name="avatar" value={id} checked={datos.avatarId === id} onChange={() => setDatos((d) => ({ ...d, avatarId: id }))} className="peer sr-only" />
              <span className="block rounded-full p-1 ring-2 ring-transparent transition-shadow peer-checked:ring-marca-600 peer-focus-visible:ring-marca-300">
                <Avatar id={id} tamano="size-11" />
              </span>
              <span className="sr-only">{id}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Le gustan (opcional)</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TEMATICAS).map(([valor, texto]) => {
            const activo = datos.intereses.includes(valor);
            return (
              <button
                key={valor}
                type="button"
                aria-pressed={activo}
                onClick={() => alternarInteres(valor)}
                className={`min-h-10 cursor-pointer rounded-full px-4 text-sm font-medium ring-1 ring-inset transition-colors ${
                  activo ? "bg-marca-600 text-white ring-marca-600" : "bg-white text-tenue ring-borde hover:bg-marca-50"
                }`}
              >
                {texto}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Boton type="submit" cargando={enviando} className="mt-2">{estudiante ? "Guardar cambios" : "Agregar estudiante"}</Boton>
    </form>
  );
};
