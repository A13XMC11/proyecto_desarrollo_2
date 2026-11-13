import { useConsulta } from "../../../Infraestructura/http/useConsulta";
import { AulaApiHttp } from "../Infraestructura/AulaApiHttp";

export const useCursos = ({ archivado } = {}) =>
  useConsulta(() => AulaApiHttp.listarCursos({ archivado }), [archivado]);

export const useEstudiantes = ({ cursoId, archivado } = {}) =>
  useConsulta(
    () => (cursoId ? AulaApiHttp.listarEstudiantes({ cursoId, archivado }) : Promise.resolve([])),
    [cursoId, archivado]
  );
