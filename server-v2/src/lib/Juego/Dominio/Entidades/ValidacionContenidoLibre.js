const EntradaInvalida = require("../../../Compartido/Dominio/Errores/EntradaInvalida");
const { silabear, coincideConPropuesta } = require("./Silabeador");

// Validación del contenido de una temática LIBRE: no hay catálogo, así que la verdad la calcula el servidor.
// Lo que propone quien creó la actividad (la IA o el docente) es una propuesta no confiable.
//
// Dónde va la palabra de cada ejercicio (el estudiante nunca ve palabraId):
//   vocales            objetivo = la palabra; opciones = 3 vocales
//   contar_silabas     objetivo = la palabra; opciones = 3 números
//   completar_silaba   palabraId = la palabra; objetivo = sus sílabas con un hueco ("pe __"); opciones = 3 sílabas
//   palabras_silabas   palabraId = la palabra; piezas y ordenCorrecto = sus sílabas
//
// De la palabra el servidor calcula la respuesta (la vocal inicial, la sílaba que falta, el número de sílabas, el
// orden). Si lo que trae el ejercicio no coincide, se rechaza. Ante la duda del Silabeador, se rechaza la palabra.
//
// Dependencias (puertos, las entrega quien compone): filtroContenido (IFiltroContenido, obligatorio) y
// emojisPermitidos (IEmojisPermitidos, solo hace falta si algún ejercicio lleva icono).

const LETRAS = "a-záéíóúüñ";
const ES_PALABRA = new RegExp(`^[${LETRAS}]{2,15}$`);
const ES_SOLO_LETRAS = new RegExp(`^[${LETRAS}]+$`);
const ES_VOCAL = /^[aeiou]$/;
const ES_NUMERO = /^[1-9]$/;
const MARCA_HUECO = "__";
const RANGO_SILABAS = { palabras_silabas: [2, 3], completar_silaba: [2, 4], contar_silabas: [2, 4] };
const NUMEROS_EN_LETRAS = { 2: "dos", 3: "tres", 4: "cuatro" };

// Por qué el Silabeador no está seguro, dicho para el docente
const MOTIVOS_SILABEO = {
  HIATO: "tiene vocales seguidas que se pronuncian en sílabas distintas, un hiato que todavía no se divide con seguridad",
  VOCAL_REPETIDA: "repite una misma vocal cerrada",
  GRUPO_VOCALICO_DUDOSO: "tiene un grupo de vocales difícil de dividir",
  GRUPO_CONSONANTICO_DUDOSO: "tiene consonantes seguidas que se dividen distinto según quién habla",
  LETRA_DUDOSA: "tiene una letra cuyo sonido depende de su posición",
  PREFIJO_DUDOSO: "empieza con un prefijo que cambia la división",
  TERMINACION_DUDOSA: "termina de una forma que puede dividirse de dos maneras",
  SIN_VOCAL: "no tiene vocales",
  CARACTER_NO_PERMITIDO: "tiene un carácter que no es una letra del español"
};

const error = (mensaje, codigo) => new EntradaInvalida(mensaje, codigo);
const minuscula = (texto) => String(texto).normalize("NFC").toLowerCase();
// Sin mayúsculas ni tildes, pero la ñ sigue siendo otra letra ("año" no es "ano")
const clave = (texto) => minuscula(texto).normalize("NFD").replace(/ñ/g, "ñ").replace(/\p{M}/gu, "");
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Palabra completa: "abeja" no está dentro de "abejaruco"
const contiene = (texto, termino) => new RegExp(`(?<![\\p{L}\\p{N}])${escapar(clave(termino))}(?![\\p{L}\\p{N}])`, "u").test(clave(texto));
const revelaConteo = (texto, cantidad) => new RegExp(`(?<![\\p{L}\\p{N}])(${cantidad}|${NUMEROS_EN_LETRAS[cantidad]})\\s+silabas?(?![\\p{L}\\p{N}])`, "u").test(clave(texto));

// La palabra: solo letras del español, de 2 a 15, y que pase el filtro. Los mensajes no repiten lo recibido
// (puede ser cualquier texto) ni, desde luego, el término que bloqueó el filtro.
function palabraValida(valor, donde, filtro) {
  const texto = typeof valor === "string" ? minuscula(valor.trim()) : "";
  if (!ES_PALABRA.test(texto)) {
    throw error(`${donde}: la palabra debe tener solo letras del español, de 2 a 15, sin números ni símbolos`, "PALABRA_INVALIDA");
  }
  if (!filtro.evaluar(texto).permitido) {
    throw error(`${donde}: esa palabra no está permitida en actividades para niños. Elige otra`, "PALABRA_NO_PERMITIDA");
  }
  return texto;
}

// Las sílabas las calcula el servidor. Si no está seguro o no son las que admite la actividad, se rechaza con el motivo.
function silabasDe(palabra, habilidad, donde) {
  const resultado = silabear(palabra);
  if (!resultado.seguro) {
    const motivo = MOTIVOS_SILABEO[resultado.motivo] || "no hay una regla segura para dividirla";
    throw error(`${donde}: no se puede dividir «${palabra}» en sílabas con seguridad (${motivo}). Elige otra palabra`, "SILABEO_DUDOSO");
  }
  const [minimo, maximo] = RANGO_SILABAS[habilidad];
  if (resultado.silabas.length < minimo || resultado.silabas.length > maximo) {
    throw error(`${donde}: «${palabra}» tiene ${resultado.silabas.length} sílabas y esta actividad admite de ${minimo} a ${maximo}`, "SILABAS_FUERA_DE_RANGO");
  }
  return resultado.silabas;
}

// Todo lo que se exige a UNA palabra para una habilidad, en un solo lugar: lo usan los validadores de abajo y también
// quien genera candidatas (para descartar las malas con el mismo criterio con que luego se validará el ejercicio).
// Devuelve { palabra } o, si la habilidad usa sílabas, { palabra, silabas }. `donde` encabeza los mensajes.
function evaluarPalabra(valor, habilidad, filtro, donde = "palabra") {
  const palabra = palabraValida(valor, donde, filtro);
  if (habilidad === "vocales") {
    if (!ES_VOCAL.test(clave(palabra)[0])) throw error(`${donde}: la palabra debe empezar con vocal`, "PALABRA_NO_EMPIEZA_CON_VOCAL");
    return { palabra };
  }
  return { palabra, silabas: silabasDe(palabra, habilidad, donde) };
}

function comprobarDivision(palabra, propuesta, silabas, donde) {
  if (!coincideConPropuesta(palabra, propuesta)) {
    throw error(`${donde}: la división en sílabas no es la correcta; «${palabra}» se divide ${silabas.join("-")}`, "DIVISION_NO_COINCIDE");
  }
}

// Opciones sin repetir (ignorando mayúsculas y tildes); el texto de cada una lo valida `esValida`
function comprobarOpciones(ejercicio, donde, esValida, descripcion) {
  const textos = ejercicio.opciones.map((o) => clave(o.texto));
  if (!textos.every((t) => esValida(t))) throw error(`${donde}: las opciones deben ser ${descripcion}`, "OPCIONES_INVALIDAS");
  if (new Set(textos).size !== textos.length) throw error(`${donde}: hay opciones repetidas`, "OPCIONES_REPETIDAS");
}

const textoMarcado = (ejercicio) => clave(ejercicio.opciones.find((o) => o.id === ejercicio.respuestaCorrectaId).texto);

function comprobarPalabraDeclarada(ejercicio, palabra, donde) {
  if (ejercicio.palabraId !== undefined && clave(ejercicio.palabraId) !== clave(palabra)) {
    throw error(`${donde}: palabraId debe ser la palabra del ejercicio`, "ESTRUCTURA_INVALIDA");
  }
}

// --- Un validador por habilidad: devuelve la palabra y lo que no puede decir la consigna ni la pista ---------

function validarVocales(ejercicio, donde, { filtro }) {
  const { palabra } = evaluarPalabra(ejercicio.objetivo, "vocales", filtro, donde);
  comprobarPalabraDeclarada(ejercicio, palabra, donde);
  const inicial = clave(palabra)[0];
  comprobarOpciones(ejercicio, donde, (t) => ES_VOCAL.test(t), "una vocal cada una");
  if (textoMarcado(ejercicio) !== inicial) {
    throw error(`${donde}: la respuesta correcta no es la vocal con la que empieza la palabra (${inicial.toUpperCase()})`, "RESPUESTA_INCORRECTA");
  }
  return { palabra, reveladores: [palabra, `vocal ${inicial}`] };
}

function validarContarSilabas(ejercicio, donde, { filtro }) {
  const { palabra, silabas } = evaluarPalabra(ejercicio.objetivo, "contar_silabas", filtro, donde);
  comprobarPalabraDeclarada(ejercicio, palabra, donde);
  const cantidad = silabas.length;
  comprobarOpciones(ejercicio, donde, (t) => ES_NUMERO.test(t), "un número del 1 al 9");
  if (textoMarcado(ejercicio) !== String(cantidad)) {
    throw error(`${donde}: la respuesta correcta no es el número de sílabas de «${palabra}» (${cantidad})`, "RESPUESTA_INCORRECTA");
  }
  return { palabra, reveladores: [palabra], cantidad };
}

function validarCompletarSilaba(ejercicio, donde, { filtro }) {
  if (ejercicio.palabraId === undefined) throw error(`${donde}: falta la palabra completa (palabraId)`, "ESTRUCTURA_INVALIDA");
  const { palabra, silabas } = evaluarPalabra(ejercicio.palabraId, "completar_silaba", filtro, donde);

  const partes = String(ejercicio.objetivo || "").trim().split(/\s+/).filter(Boolean);
  if (partes.filter((p) => p === MARCA_HUECO).length !== 1) {
    throw error(`${donde}: el objetivo debe tener las sílabas de la palabra con un solo hueco (${MARCA_HUECO})`, "ESTRUCTURA_INVALIDA");
  }
  const hueco = partes.indexOf(MARCA_HUECO);
  // Las sílabas visibles las propone el ejercicio; el hueco lo completa el servidor con la sílaba que de verdad falta
  const propuesta = partes.map((parte, i) => (i === hueco ? silabas[hueco] || "" : parte));
  if (partes.length !== silabas.length) comprobarDivision(palabra, [], silabas, donde);
  comprobarDivision(palabra, propuesta, silabas, donde);

  comprobarOpciones(ejercicio, donde, (t) => ES_SOLO_LETRAS.test(t), "sílabas escritas solo con letras");
  if (textoMarcado(ejercicio) !== clave(silabas[hueco])) {
    throw error(`${donde}: la respuesta correcta no es la sílaba que falta en «${palabra}»`, "RESPUESTA_INCORRECTA");
  }
  return { palabra, reveladores: [palabra] };
}

function validarOrdenarSilabas(ejercicio, donde, { filtro }) {
  const piezas = ejercicio.ordenCorrecto.map((id) => ejercicio.piezas.find((p) => p.id === id).texto);
  if (!piezas.every((texto) => ES_SOLO_LETRAS.test(clave(texto)))) {
    throw error(`${donde}: las piezas deben estar escritas solo con letras, sin números, símbolos ni colores`, "PALABRA_INVALIDA");
  }
  const { palabra, silabas } = evaluarPalabra(ejercicio.palabraId, "palabras_silabas", filtro, donde);
  if (ejercicio.objetivo !== undefined && clave(ejercicio.objetivo) !== clave(palabra)) {
    throw error(`${donde}: el objetivo, si se indica, debe ser la palabra del ejercicio`, "ESTRUCTURA_INVALIDA");
  }
  comprobarDivision(palabra, piezas, silabas, donde);
  return { palabra, reveladores: [palabra] };
}

const VALIDADORES = {
  vocales: validarVocales,
  contar_silabas: validarContarSilabas,
  completar_silaba: validarCompletarSilaba,
  palabras_silabas: validarOrdenarSilabas
};

// --- Reglas comunes a todos los ejercicios -----------------------------------------------------------------

function comprobarEstructura(ejercicio, donde) {
  // No hay catálogo: un recursoId no apunta a nada y no debe colarse
  if (ejercicio.recursoId !== undefined || (ejercicio.opciones || []).some((o) => o.recursoId !== undefined)) {
    throw error(`${donde}: recursoId no se usa en una temática libre`, "ESTRUCTURA_INVALIDA");
  }
}

// Ni la consigna ni la pista pueden ser solo símbolos o colores (tienen que estar escritas con palabras), ni contener
// nada que bloquee el filtro (las redacta quien genera con libertad), ni la respuesta. El mensaje no repite el término.
function comprobarTextos(ejercicio, donde, { reveladores, cantidad }, filtro) {
  for (const [campo, texto] of [["consigna", ejercicio.consigna], ["pista", ejercicio.pista]]) {
    if (texto === undefined) continue;
    if (!/\p{L}{2,}/u.test(texto)) throw error(`${donde}: la ${campo} debe estar escrita con palabras`, "CONSIGNA_INVALIDA");
    if (!filtro.evaluar(texto).permitido) {
      throw error(`${donde}: la ${campo} no está permitida en actividades para niños. Reescríbela`, "TEXTO_NO_PERMITIDO");
    }
    if (reveladores.some((r) => contiene(texto, r)) || (cantidad && revelaConteo(texto, cantidad))) {
      throw error(`${donde}: la ${campo} contiene la respuesta`, "RESPUESTA_REVELADA");
    }
  }
}

function comprobarIcono(ejercicio, donde, emojis) {
  if (!ejercicio.icono) return;
  if (!emojis || typeof emojis.esPermitido !== "function" || !emojis.esPermitido(ejercicio.icono)) {
    throw error(`${donde}: el icono no está en la lista de iconos permitidos`, "ICONO_NO_PERMITIDO");
  }
}

// exigirCantidad: false valida solo los ejercicios presentes (un borrador puede estar incompleto); aprobar siempre lo exige.
function validarContenidoLibre(version, { permitirDiez = false, exigirCantidad = true, filtroContenido, emojisPermitidos } = {}) {
  if (!filtroContenido || typeof filtroContenido.evaluar !== "function") {
    throw error("Hace falta el filtro de contenido para validar una temática libre", "FILTRO_CONTENIDO_REQUERIDO");
  }
  const { habilidad, tematica, cantidadEjercicios } = version.configuracion;
  const validar = VALIDADORES[habilidad];
  if (!validar) throw error(`habilidad sin reglas de validación: ${habilidad}`, "ENTRADA_INVALIDA");
  if (cantidadEjercicios === 10 && !permitirDiez) throw new EntradaInvalida("la cantidad de 10 ejercicios no está habilitada");
  if (exigirCantidad && version.ejercicios.length !== cantidadEjercicios) {
    throw new EntradaInvalida(`se esperaban ${cantidadEjercicios} ejercicios y hay ${version.ejercicios.length}`);
  }
  if (!filtroContenido.evaluar(tematica).permitido) {
    throw error("La temática de la actividad no está permitida en actividades para niños", "TEMATICA_NO_PERMITIDA");
  }

  const vistas = new Set();
  for (const ejercicio of version.ejercicios) {
    const donde = `ejercicio ${ejercicio.id}`;
    comprobarEstructura(ejercicio, donde);
    const resultado = validar(ejercicio, donde, { filtro: filtroContenido });

    const unica = clave(resultado.palabra);
    if (vistas.has(unica)) throw error(`${donde}: la palabra ya se usa en otro ejercicio de la actividad`, "PALABRA_REPETIDA");
    vistas.add(unica);

    comprobarTextos(ejercicio, donde, resultado, filtroContenido);
    comprobarIcono(ejercicio, donde, emojisPermitidos);
  }
  return version;
}

module.exports = { validarContenidoLibre, evaluarPalabra, clavePalabra: clave };
