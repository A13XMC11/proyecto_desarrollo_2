import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Archive, GraduationCap, Pencil, Plus, UserPlus, Users } from "lucide-react";
import { Boton, Cargando, Encabezado, EstadoVacio, Insignia, MensajeError, Tarjeta } from "../../../../Infraestructura/ui/componentes";
import { Dialogo } from "../../../../Infraestructura/ui/Dialogo";
import { useAvisos } from "../../../../Infraestructura/ui/Avisos";
import { nombreCurso, nombreEstudiante } from "../../../Juego/Dominio/ValoresPermitidos";
import { useCursos, useEstudiantes } from "../../Aplicacion/useAula";
import { AulaApiHttp } from "../AulaApiHttp";
import { FormularioCurso, FormularioEstudiante } from "./Formularios";
import { Avatar } from "./Avatar";

const Confirmar = ({ abierto, titulo, texto, accion, alCerrar, alConfirmar }) => {
  const [enviando, setEnviando] = useState(false);
  const confirmar = async () => {
    setEnviando(true);
    try {
      await alConfirmar();
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={titulo}>
      <p className="text-tenue">{texto}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton variante="peligro" cargando={enviando} onClick={confirmar}>{accion}</Boton>
      </div>
    </Dialogo>
  );
};

export const PaginaCursos = () => {
  const avisar = useAvisos();
  const { state } = useLocation();
  const [parametros, setParametros] = useSearchParams();
  const [verArchivados, setVerArchivados] = useState(false);
  const cursos = useCursos({ archivado: verArchivados ? undefined : false });
  const cursoId = parametros.get("curso") || "";
  const estudiantes = useEstudiantes({ cursoId, archivado: false });
  const [dialogo, setDialogo] = useState(null); // { tipo, objeto }

  const lista = cursos.datos || [];
  const cursoActual = lista.find((c) => c.id === cursoId);

  // Si no hay curso elegido, se elige el primero activo
  useEffect(() => {
    if (!cursoId && lista.length) setParametros({ curso: (lista.find((c) => !c.archivado) || lista[0]).id }, { replace: true });
  }, [cursoId, lista, setParametros]);

  const cerrar = () => setDialogo(null);

  const alGuardarCurso = (curso) => {
    cerrar();
    avisar(dialogo?.objeto ? "Curso actualizado." : `Curso ${nombreCurso(curso)} creado.`);
    cursos.recargar();
    setParametros({ curso: curso.id });
  };

  const alGuardarEstudiante = (estudiante) => {
    cerrar();
    avisar(dialogo?.objeto ? "Datos guardados." : `${nombreEstudiante(estudiante)} agregado.`);
    estudiantes.recargar();
  };

  const archivar = async () => {
    const { tipo, objeto } = dialogo;
    try {
      if (tipo === "archivarCurso") {
        await AulaApiHttp.archivarCurso(objeto.id);
        setParametros({}, { replace: true });
        cursos.recargar();
        avisar("Curso archivado. Sus resultados se conservan.");
      } else {
        await AulaApiHttp.archivarEstudiante(objeto.id);
        estudiantes.recargar();
        avisar("Estudiante archivado. Sus resultados se conservan.");
      }
      cerrar();
    } catch (error) {
      avisar(error.message, "error");
    }
  };

  return (
    <>
      <title>Cursos y estudiantes · Letritas</title>
      <Encabezado
        titulo="Cursos y estudiantes"
        descripcion={state?.bienvenida ? "Tu cuenta ya está lista. Empieza por tu curso y después agrega a tus estudiantes." : "Organiza tus grupos y registra a cada estudiante con su código de lista."}
        acciones={<Boton onClick={() => setDialogo({ tipo: "curso" })}><Plus className="size-5" aria-hidden="true" /> Nuevo curso</Boton>}
      />

      <MensajeError error={cursos.error} alReintentar={cursos.recargar} />

      {cursos.cargando && !cursos.datos ? (
        <Cargando filas={2} />
      ) : !cursos.datos ? null : lista.length === 0 ? (
        <EstadoVacio
          icono={GraduationCap}
          titulo="Todavía no tienes cursos"
          texto="Crea tu primer curso, por ejemplo 1.º EGB paralelo A, y luego agrega a tus estudiantes."
          accion={<Boton onClick={() => setDialogo({ tipo: "curso" })}><Plus className="size-5" aria-hidden="true" /> Crear curso</Boton>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <div>
            <ul className="grid gap-2" aria-label="Tus cursos">
              {lista.map((curso) => {
                const activo = curso.id === cursoId;
                return (
                  <li key={curso.id}>
                    <button
                      type="button"
                      onClick={() => setParametros({ curso: curso.id })}
                      aria-current={activo || undefined}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                        activo ? "border-marca-600 bg-marca-50" : "border-borde bg-white hover:border-marca-200"
                      }`}
                    >
                      <span>
                        <span className="block font-bold">{nombreCurso(curso)}</span>
                        <span className="text-sm text-tenue">{curso.anioLectivo}</span>
                      </span>
                      {curso.archivado && <Insignia tono="gris">Archivado</Insignia>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <label className="mt-4 flex cursor-pointer items-center gap-2 px-1 text-sm text-tenue">
              <input type="checkbox" checked={verArchivados} onChange={(e) => setVerArchivados(e.target.checked)} className="size-4 accent-marca-600" />
              Mostrar cursos archivados
            </label>
          </div>

          {cursoActual && (
            <Tarjeta className="p-0">
              <div className="flex flex-col gap-3 border-b border-borde p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold">{nombreCurso(cursoActual)}</h2>
                  <p className="text-sm text-tenue">Año lectivo {cursoActual.anioLectivo}</p>
                </div>
                {!cursoActual.archivado && (
                  <div className="flex flex-wrap gap-2">
                    <Boton tamano="sm" onClick={() => setDialogo({ tipo: "estudiante" })}><UserPlus className="size-4" aria-hidden="true" /> Agregar estudiante</Boton>
                    <Boton tamano="sm" variante="secundario" onClick={() => setDialogo({ tipo: "curso", objeto: cursoActual })}><Pencil className="size-4" aria-hidden="true" /> Editar</Boton>
                    <Boton tamano="sm" variante="fantasma" onClick={() => setDialogo({ tipo: "archivarCurso", objeto: cursoActual })}><Archive className="size-4" aria-hidden="true" /> Archivar</Boton>
                  </div>
                )}
              </div>

              <div className="p-5">
                <MensajeError error={estudiantes.error} alReintentar={estudiantes.recargar} />
                {estudiantes.cargando && !estudiantes.datos ? (
                  <Cargando filas={3} alto="h-14" />
                ) : !estudiantes.datos ? null : !estudiantes.datos.length ? (
                  <EstadoVacio
                    icono={Users}
                    titulo="Sin estudiantes todavía"
                    texto="Agrega a cada estudiante con su código de lista. El apodo es opcional."
                    accion={!cursoActual.archivado && <Boton onClick={() => setDialogo({ tipo: "estudiante" })}><UserPlus className="size-5" aria-hidden="true" /> Agregar estudiante</Boton>}
                  />
                ) : (
                  <ul className="divide-y divide-borde">
                    {[...estudiantes.datos]
                      .sort((a, b) => a.codigoLista.localeCompare(b.codigoLista, "es", { numeric: true }))
                      .map((e) => (
                        <li key={e.id} className="flex items-center gap-3 py-3">
                          <Avatar id={e.avatarId} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{e.apodo || `Estudiante ${e.codigoLista}`}</p>
                            <p className="text-sm text-tenue">Código {e.codigoLista} · {e.franjaEdad} años</p>
                          </div>
                          {!cursoActual.archivado && (
                            <div className="flex">
                              <button type="button" onClick={() => setDialogo({ tipo: "estudiante", objeto: e })} className="grid size-11 cursor-pointer place-items-center rounded-xl text-tenue transition-colors hover:bg-marca-50 hover:text-marca-700" aria-label={`Editar a ${nombreEstudiante(e)}`}>
                                <Pencil className="size-4" aria-hidden="true" />
                              </button>
                              <button type="button" onClick={() => setDialogo({ tipo: "archivarEstudiante", objeto: e })} className="grid size-11 cursor-pointer place-items-center rounded-xl text-tenue transition-colors hover:bg-error-suave hover:text-error" aria-label={`Archivar a ${nombreEstudiante(e)}`}>
                                <Archive className="size-4" aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </Tarjeta>
          )}
        </div>
      )}

      <Dialogo abierto={dialogo?.tipo === "curso"} alCerrar={cerrar} titulo={dialogo?.objeto ? "Editar curso" : "Nuevo curso"}>
        <FormularioCurso key={dialogo?.objeto?.id || "nuevo"} curso={dialogo?.objeto} alGuardar={alGuardarCurso} />
      </Dialogo>
      <Dialogo abierto={dialogo?.tipo === "estudiante"} alCerrar={cerrar} titulo={dialogo?.objeto ? "Editar estudiante" : "Agregar estudiante"}>
        <FormularioEstudiante key={dialogo?.objeto?.id || "nuevo"} cursoId={cursoId} estudiante={dialogo?.objeto} alGuardar={alGuardarEstudiante} />
      </Dialogo>
      <Confirmar
        abierto={dialogo?.tipo === "archivarCurso" || dialogo?.tipo === "archivarEstudiante"}
        titulo={dialogo?.tipo === "archivarCurso" ? "¿Archivar este curso?" : "¿Archivar a este estudiante?"}
        texto="No se borra nada: sus resultados quedan guardados. Lo archivado no puede empezar partidas nuevas."
        accion="Archivar"
        alCerrar={cerrar}
        alConfirmar={archivar}
      />
    </>
  );
};

export { Confirmar };
