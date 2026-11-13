import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boton, BotonEnlace, Campo, Encabezado, EstadoVacio, MensajeError, Selector, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { GraduationCap } from "lucide-react";
import { useCursos, useEstudiantes } from "../../../Aula/Aplicacion/useAula";
import { CANTIDADES_EJERCICIOS, HABILIDADES, TEMATICAS, nombreCurso, nombreEstudiante, opcionesDe } from "../../Dominio/ValoresPermitidos";
import { JuegoApiHttp } from "../JuegoApiHttp";

// Creación manual: crea el juego y su primer borrador vacío; los ejercicios se escriben en la pantalla de detalle
export const PaginaNuevaActividad = () => {
  const navegar = useNavigate();
  const cursos = useCursos({ archivado: false });
  const [datos, setDatos] = useState({ cursoId: "", estudianteId: "", titulo: "", habilidad: "vocales", tematica: "animales", cantidadEjercicios: 5 });
  const cursoId = datos.cursoId || cursos.datos?.[0]?.id || "";
  const estudiantes = useEstudiantes({ cursoId, archivado: false });
  const [error, setError] = useState(null);
  const [errorTitulo, setErrorTitulo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const poner = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value, ...(campo === "cursoId" && { estudianteId: "" }) }));

  const enviar = async (e) => {
    e.preventDefault();
    const titulo = datos.titulo.trim();
    if (titulo.length < 3 || titulo.length > 80) {
      setErrorTitulo("Entre 3 y 80 caracteres, por ejemplo \"Las vocales de los animales\".");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const juego = await JuegoApiHttp.crear({ cursoId, estudianteId: datos.estudianteId || undefined, titulo, habilidad: datos.habilidad });
      await JuegoApiHttp.crearVersion(juego.id, { tematica: datos.tematica, cantidadEjercicios: Number(datos.cantidadEjercicios), ejercicios: [] });
      navegar(`/panel/actividades/${juego.id}`, { replace: true });
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  };

  if (cursos.datos && cursos.datos.length === 0) {
    return (
      <EstadoVacio icono={GraduationCap} titulo="Primero crea un curso" texto="Cada actividad pertenece a un curso. Crea uno y vuelve aquí." accion={<BotonEnlace to="/panel/cursos">Ir a cursos</BotonEnlace>} />
    );
  }

  return (
    <>
      <title>Crear actividad a mano · Letritas</title>
      <Encabezado titulo="Crear actividad a mano" descripcion="Útil para preparar un ejemplo o cuando prefieres escribir tú cada ejercicio." />
      <Tarjeta className="max-w-2xl">
        <form onSubmit={enviar} noValidate className="grid gap-4">
          <MensajeError error={error || cursos.error} />
          <Campo etiqueta="Título" requerido maxLength={80} value={datos.titulo} onChange={(e) => { poner("titulo")(e); setErrorTitulo(null); }} error={errorTitulo} placeholder="Las vocales de los animales" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Selector etiqueta="Curso" value={cursoId} onChange={poner("cursoId")} opciones={(cursos.datos || []).map((c) => ({ valor: c.id, texto: nombreCurso(c) }))} />
            <Selector etiqueta="Para" value={datos.estudianteId} onChange={poner("estudianteId")} opciones={[{ valor: "", texto: "Todo el curso" }, ...(estudiantes.datos || []).map((e) => ({ valor: e.id, texto: nombreEstudiante(e) }))]} />
            <Selector etiqueta="Qué practicar" value={datos.habilidad} onChange={poner("habilidad")} opciones={opcionesDe(HABILIDADES)} ayuda={`Mecánica: ${HABILIDADES[datos.habilidad].mecanicaTexto.toLowerCase()}`} />
            <Selector etiqueta="Temática" value={datos.tematica} onChange={poner("tematica")} opciones={opcionesDe(TEMATICAS)} />
            <Selector etiqueta="Ejercicios" value={datos.cantidadEjercicios} onChange={poner("cantidadEjercicios")} opciones={CANTIDADES_EJERCICIOS.map((n) => ({ valor: n, texto: `${n} ejercicios` }))} />
          </div>
          <Boton type="submit" cargando={enviando} className="mt-2 sm:justify-self-start">Crear y escribir ejercicios</Boton>
        </form>
      </Tarjeta>
    </>
  );
};
