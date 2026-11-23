import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Library, Play, Plus, Search, BarChart3, Sparkles } from "lucide-react";
import { Boton, BotonEnlace, Cargando, Encabezado, EstadoVacio, Insignia, MensajeError, Selector } from "../../../../Infraestructura/ui/componentes";
import { useCursos, useEstudiantes } from "../../../Aula/Aplicacion/useAula";
import { ESTADOS_JUEGO, HABILIDADES, nombreCurso, nombreEstudiante, opcionesDe } from "../../Dominio/ValoresPermitidos";

const CLAVES_FILTRO = ["cursoId", "estudianteId", "habilidad", "estado", "texto"];
import { useJuegos } from "../../Aplicacion/useJuegos";
import { etiquetaTematica } from "../../Dominio/Tematica";

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short" }) : "");

export const TarjetaActividad = ({ juego, cursos }) => {
  const curso = cursos.find((c) => c.id === juego.cursoId);
  const estado = ESTADOS_JUEGO[juego.estado] || ESTADOS_JUEGO.borrador;
  // Solo las de temática libre llevan etiqueta; las del catálogo se ven como siempre
  const etiqueta = etiquetaTematica(juego.configuracion);
  return (
    <article className="group relative flex flex-col rounded-2xl border border-borde bg-white p-5 transition-[border-color] duration-200 hover:border-marca-200 hover:shadow-marca-900/5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Insignia tono={estado.tono}>{estado.texto}</Insignia>
        {juego.origen === "ia" && <Insignia tono="azul"><Sparkles className="size-3" aria-hidden="true" /> IA</Insignia>}
      </div>
      <h3 className="text-lg font-extrabold leading-snug">
        <Link to={`/panel/actividades/${juego.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
          {juego.titulo}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-tenue">
        Para: {curso ? nombreCurso(curso) : "curso archivado"} · {HABILIDADES[juego.habilidad]?.texto}
      </p>
      {etiqueta && <p className="mt-2"><Insignia tono="gris">{etiqueta}</Insignia></p>}
      <p className="mt-1 text-xs text-tenue">Actualizada el {fecha(juego.actualizadoEn || juego.creadoEn)}</p>
      <div className="relative z-10 mt-5 flex flex-wrap gap-2 pt-1">
        {juego.estado === "listo" ? (
          <BotonEnlace to={`/aula/${juego.id}`} tamano="sm">
            <Play className="size-4" aria-hidden="true" /> Iniciar en el aula
          </BotonEnlace>
        ) : (
          <BotonEnlace to={`/panel/actividades/${juego.id}`} tamano="sm" variante="secundario">Revisar borrador</BotonEnlace>
        )}
        <BotonEnlace to={`/panel/resultados?juego=${juego.id}`} tamano="sm" variante="fantasma">
          <BarChart3 className="size-4" aria-hidden="true" /> Resultados
        </BotonEnlace>
      </div>
    </article>
  );
};

export const PaginaActividades = () => {
  const [parametros, setParametros] = useSearchParams();
  const [texto, setTexto] = useState(parametros.get("texto") || "");
  const filtros = useMemo(() => {
    const f = {};
    [...CLAVES_FILTRO, "pagina"].forEach((k) => parametros.get(k) && (f[k] = parametros.get(k)));
    if (f.estado === "archivado") f.incluirArchivados = "true";
    f.limite = 12;
    return f;
  }, [parametros]);
  const juegos = useJuegos(filtros);
  const cursos = useCursos();
  const cursoId = parametros.get("cursoId") || "";
  // Los estudiantes se eligen dentro de un curso (actividades pensadas para un estudiante concreto)
  const estudiantes = useEstudiantes({ cursoId });

  const cambiar = (clave, valor) => {
    const nuevos = new URLSearchParams(parametros);
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    if (clave !== "pagina") nuevos.delete("pagina");
    if (clave === "cursoId") nuevos.delete("estudianteId");
    setParametros(nuevos);
  };

  const { items = [], total = 0, pagina = 1, limite = 12 } = juegos.datos || {};
  const paginas = Math.max(1, Math.ceil(total / limite));
  const hayFiltros = CLAVES_FILTRO.some((k) => parametros.get(k));

  return (
    <>
      <title>Mis actividades · Letritas</title>
      <Encabezado
        titulo="Mis actividades"
        descripcion="Todo lo que preparaste, listo para volver a jugar sin gastar cupo de IA."
        acciones={
          <>
            <BotonEnlace to="/panel/actividades/nueva" variante="secundario"><Plus className="size-5" aria-hidden="true" /> Crear a mano</BotonEnlace>
            <BotonEnlace to="/panel/crear"><Sparkles className="size-5" aria-hidden="true" /> Crear con IA</BotonEnlace>
          </>
        }
      />

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          cambiar("texto", texto.trim());
        }}
        className="mb-6 grid gap-3 rounded-2xl border border-borde bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]"
      >
        <div>
          <label htmlFor="buscar" className="mb-1.5 block text-sm font-medium">Buscar</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="buscar" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={() => cambiar("texto", texto.trim())} placeholder="Título de la actividad" className="min-h-11 w-full rounded-xl border border-borde pl-10 pr-3 text-base focus:border-marca-500 focus:outline-none focus:ring-4 focus:ring-marca-500/15" />
          </div>
        </div>
        <Selector etiqueta="Curso" value={cursoId} onChange={(e) => cambiar("cursoId", e.target.value)} opciones={[{ valor: "", texto: "Todos" }, ...(cursos.datos || []).map((c) => ({ valor: c.id, texto: nombreCurso(c) }))]} />
        <Selector
          etiqueta="Estudiante"
          value={parametros.get("estudianteId") || ""}
          disabled={!cursoId}
          onChange={(e) => cambiar("estudianteId", e.target.value)}
          opciones={[{ valor: "", texto: cursoId ? "Todos" : "Elige un curso primero" }, ...(estudiantes.datos || []).map((e) => ({ valor: e.id, texto: nombreEstudiante(e) }))]}
        />
        <Selector etiqueta="Habilidad" value={parametros.get("habilidad") || ""} onChange={(e) => cambiar("habilidad", e.target.value)} opciones={[{ valor: "", texto: "Todas" }, ...opcionesDe(HABILIDADES)]} />
        <Selector etiqueta="Estado" value={parametros.get("estado") || ""} onChange={(e) => cambiar("estado", e.target.value)} opciones={[{ valor: "", texto: "Activas" }, ...opcionesDe(ESTADOS_JUEGO)]} />
      </form>

      <MensajeError error={juegos.error} alReintentar={juegos.recargar} />

      {juegos.cargando && !juegos.datos ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Cargando filas={3} alto="h-48" /></div>
      ) : !juegos.datos ? null : items.length === 0 ? (
        hayFiltros ? (
          <EstadoVacio icono={Search} titulo="Nada coincide con esos filtros" texto="Prueba con otro curso o quita la búsqueda." accion={<Boton variante="secundario" onClick={() => { setTexto(""); setParametros({}); }}>Quitar filtros</Boton>} />
        ) : (
          <EstadoVacio
            icono={Library}
            titulo="Tu biblioteca está vacía"
            texto="Pide una actividad a la IA o crea una a mano. Cuando la apruebes, aparecerá aquí lista para jugar."
            accion={<BotonEnlace to="/panel/crear"><Sparkles className="size-5" aria-hidden="true" /> Crear mi primera actividad</BotonEnlace>}
          />
        )
      ) : (
        <>
          <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${juegos.cargando ? "opacity-60" : ""}`}>
            {items.map((juego) => <TarjetaActividad key={juego.id} juego={juego} cursos={cursos.datos || []} />)}
          </div>
          {paginas > 1 && (
            <nav aria-label="Páginas" className="mt-8 flex items-center justify-center gap-3">
              <Boton variante="secundario" tamano="sm" disabled={pagina <= 1} onClick={() => cambiar("pagina", String(pagina - 1))}>Anterior</Boton>
              <span className="text-sm text-tenue">Página {pagina} de {paginas}</span>
              <Boton variante="secundario" tamano="sm" disabled={pagina >= paginas} onClick={() => cambiar("pagina", String(pagina + 1))}>Siguiente</Boton>
            </nav>
          )}
        </>
      )}
    </>
  );
};
