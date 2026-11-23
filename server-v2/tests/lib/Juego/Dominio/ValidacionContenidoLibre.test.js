const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const VersionJuego = require("../../../../src/lib/Juego/Dominio/Entidades/VersionJuego");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");
const FiltroContenidoJson = require("../../../../src/lib/Juego/Infraestructura/FiltroContenidoJson");
const EmojisPermitidosJson = require("../../../../src/lib/Juego/Infraestructura/EmojisPermitidosJson");

// Datos fabricados a mano: no interviene la IA ni el catálogo. Las divisiones en sílabas se escriben aquí a mano
// (según la ortografía del español) y NO se calculan con el código que se prueba.
const deps = { filtroContenido: new FiltroContenidoJson(), emojisPermitidos: new EmojisPermitidosJson() };

const { MECANICAS, HABILIDADES, TEMAS, opciones, vocal, completar, contar, ordenar, actividad } = require("../../../ayudas/actividadesLibres");
const version = (habilidad, ejercicios, { tematica = "animales", cantidadEjercicios = 5 } = {}) => new VersionJuego({
  juegoId: "j1", ejercicios,
  configuracion: { habilidad, mecanica: MECANICAS[habilidad], modoTematica: "libre", tematica, cantidadEjercicios }
});
const validar = (v, extra = {}) => v.validarContenido(undefined, { ...deps, ...extra });

// Cambia un ejercicio de una actividad válida de animales y comprueba que se rechaza con ese código
const cambiando = (habilidad, indice, cambio) => {
  const lista = actividad(habilidad, "animales");
  lista[indice] = typeof cambio === "function" ? cambio(lista[indice]) : { ...lista[indice], ...cambio };
  return version(habilidad, lista);
};
const rechaza = (v, codigo, extra) => assert.throws(() => validar(v, extra), (e) => {
  assert.ok(e instanceof EntradaInvalida, `esperaba EntradaInvalida y fue ${e && e.name}: ${e && e.message}`);
  assert.equal(e.codigo, codigo, e.message);
  assert.equal(e.statusCode, 400);
  return true;
});

describe("ValidacionContenidoLibre: actividades válidas (frutas, colores y animales)", () => {
  for (const tema of Object.keys(TEMAS)) {
    for (const habilidad of HABILIDADES) {
      it(`${tema} · ${habilidad}`, () => {
        const v = version(habilidad, actividad(habilidad, tema), { tematica: tema });
        assert.equal(validar(v), v);
      });
    }
  }

  it("el icono es opcional: con uno de la lista se acepta, sin él también", () => {
    assert.doesNotThrow(() => validar(version("vocales", [vocal(1, "abeja", { icono: "🐝" }), ...actividad("vocales", "animales").slice(1)])));
    assert.doesNotThrow(() => validar(version("vocales", actividad("vocales", "animales"))));
  });

  it("los colores se entienden sin ver el color: el nombre va como texto y el icono es opcional", () => {
    const v = version("palabras_silabas", actividad("palabras_silabas", "colores"), { tematica: "colores" });
    validar(v);
    assert.ok(v.ejercicios.every((e) => !e.icono), "ningún ejercicio de colores depende de un icono");
    assert.ok(v.ejercicios.every((e) => e.palabraId && e.piezas.every((p) => /^\p{L}+$/u.test(p.texto))));
  });

  it("acepta mayúsculas y tildes en la palabra, y las palabras que empiezan con vocal acentuada", () => {
    validar(version("vocales", [vocal(1, "Árbol"), vocal(2, "ÓVALO"), ...actividad("vocales", "animales").slice(2)]));
  });

  it("un borrador incompleto se valida si no se exige la cantidad, y la aprobación sí la exige", () => {
    const parcial = version("vocales", [vocal(1, "abeja")]);
    assert.doesNotThrow(() => validar(parcial, { exigirCantidad: false }));
    rechaza(parcial, "ENTRADA_INVALIDA");
  });

  it("no cambia la versión ni la reordena", () => {
    const v = version("palabras_silabas", actividad("palabras_silabas", "animales"));
    const antes = JSON.stringify(v);
    validar(v);
    assert.equal(JSON.stringify(v), antes);
  });
});

describe("ValidacionContenidoLibre: reglas comunes", () => {
  it("palabra: solo letras españolas, de 2 a 15 caracteres", () => {
    for (const mala of ["abeja2", "a", "a".repeat(16), "abe ja", "abeja!", "ab-eja", "abeja."]) {
      rechaza(cambiando("vocales", 0, { objetivo: mala }), "PALABRA_INVALIDA");
    }
    rechaza(cambiando("contar_silabas", 0, { objetivo: "per1ro" }), "PALABRA_INVALIDA");
    rechaza(cambiando("palabras_silabas", 0, (e) => ({ ...e, piezas: [{ id: "p1", texto: "pe" }, { id: "p2", texto: "r1o" }] })), "PALABRA_INVALIDA");
    rechaza(cambiando("completar_silaba", 0, { palabraId: "per1ro" }), "PALABRA_INVALIDA");
    rechaza(cambiando("completar_silaba", 0, { palabraId: "p" }), "PALABRA_INVALIDA");
    assert.doesNotThrow(() => validar(cambiando("vocales", 0, { objetivo: "ab" })), "dos letras es el mínimo y es válido");
    assert.doesNotThrow(() => validar(cambiando("vocales", 0, { objetivo: "a".repeat(15) })), "quince letras es el máximo");
  });

  it("palabra: sin duplicados dentro de la actividad, ignorando mayúsculas y tildes", () => {
    rechaza(version("vocales", [vocal(1, "abeja"), vocal(2, "abeja"), ...actividad("vocales", "animales").slice(2)]), "PALABRA_REPETIDA");
    rechaza(version("vocales", [vocal(1, "abeja"), vocal(2, "ABEJA"), ...actividad("vocales", "animales").slice(2)]), "PALABRA_REPETIDA");
    rechaza(version("vocales", [vocal(1, "árbol"), vocal(2, "arbol"), ...actividad("vocales", "animales").slice(2)]), "PALABRA_REPETIDA");
    rechaza(version("palabras_silabas", [ordenar(1, "perro", ["pe", "rro"]), ordenar(2, "perro", ["pe", "rro"]), ...actividad("palabras_silabas", "animales").slice(2)]), "PALABRA_REPETIDA");
    rechaza(version("contar_silabas", [contar(1, "perro", 2), contar(2, "Perro", 2), ...actividad("contar_silabas", "animales").slice(2)]), "PALABRA_REPETIDA");
    rechaza(version("completar_silaba", [completar(1, ["pe", "rro"], 0), completar(2, ["pe", "rro"], 1), ...actividad("completar_silaba", "animales").slice(2)]), "PALABRA_REPETIDA");
  });

  it("la ñ no se confunde con la n al buscar duplicados", () => {
    validar(version("vocales", [vocal(1, "añil"), vocal(2, "anil"), ...actividad("vocales", "animales").slice(2)]));
  });

  it("cada palabra pasa por el filtro de contenido, y el mensaje no repite el término bloqueado", () => {
    const casos = [
      ["vocales", cambiando("vocales", 0, { objetivo: "arma" }), /arma/i],
      ["contar_silabas", cambiando("contar_silabas", 0, { objetivo: "cerveza" }), /cerveza/i],
      ["palabras_silabas", cambiando("palabras_silabas", 0, (e) => ordenar(1, "pistola", ["pis", "to", "la"])), /pistola/i],
      ["completar_silaba", cambiando("completar_silaba", 0, () => completar(1, ["dro", "ga"], 1)), /droga/i]
    ];
    for (const [habilidad, v, termino] of casos) {
      assert.throws(() => validar(v), (e) => e.codigo === "PALABRA_NO_PERMITIDA" && !termino.test(e.message) && e.statusCode === 400, habilidad);
    }
  });

  it("sin filtro de contenido no se valida una temática libre (falla cerrado)", () => {
    rechaza(version("vocales", actividad("vocales", "animales")), "FILTRO_CONTENIDO_REQUERIDO", { filtroContenido: undefined });
    rechaza(version("vocales", actividad("vocales", "animales")), "FILTRO_CONTENIDO_REQUERIDO", { filtroContenido: {} });
  });

  it("un filtro propio que cumpla el puerto también sirve (el Dominio no depende del JSON)", () => {
    const solo = { evaluar: (t) => (/\babeja\b/i.test(t) ? { permitido: false, categoria: "armas" } : { permitido: true }) };
    rechaza(version("vocales", actividad("vocales", "animales")), "PALABRA_NO_PERMITIDA", { filtroContenido: solo });
    assert.doesNotThrow(() => validar(version("vocales", actividad("vocales", "frutas")), { filtroContenido: solo }));
  });

  it("la temática de la versión también pasa por el filtro", () => {
    rechaza(version("vocales", actividad("vocales", "animales"), { tematica: "pistolas y armas" }), "TEMATICA_NO_PERMITIDA");
  });

  it("consigna y pista no pueden contener la respuesta", () => {
    rechaza(cambiando("vocales", 0, { consigna: "¿Es la abeja una palabra con A?" }), "RESPUESTA_REVELADA");
    rechaza(cambiando("vocales", 0, { pista: "Empieza con la vocal a" }), "RESPUESTA_REVELADA");
    rechaza(cambiando("vocales", 0, { pista: "Es el animal ABEJA" }), "RESPUESTA_REVELADA");
    rechaza(cambiando("contar_silabas", 0, { consigna: "¿Cuántas sílabas tiene perro?" }), "RESPUESTA_REVELADA");
    rechaza(cambiando("contar_silabas", 0, { pista: "Tiene dos sílabas" }), "RESPUESTA_REVELADA");
    rechaza(cambiando("contar_silabas", 1, { pista: "Son 3 sílabas" }), "RESPUESTA_REVELADA");
    rechaza(cambiando("completar_silaba", 0, { consigna: "¿Qué sílaba falta en perro?" }), "RESPUESTA_REVELADA");
    rechaza(cambiando("palabras_silabas", 0, { consigna: "Ordena las sílabas de perro" }), "RESPUESTA_REVELADA");
  });

  it("no es una pista de más nombrar otra cosa: una palabra pegada a otras letras no cuenta", () => {
    assert.doesNotThrow(() => validar(cambiando("vocales", 0, { pista: "No es abejarrón ni abejaruco" })));
    assert.doesNotThrow(() => validar(cambiando("contar_silabas", 0, { pista: "Aplaude una vez por cada sílaba" })));
  });

  it("la consigna y la pista deben estar escritas con palabras, no solo con símbolos o colores", () => {
    rechaza(cambiando("vocales", 0, { consigna: "🔴🟢🔵" }), "CONSIGNA_INVALIDA");
    rechaza(cambiando("vocales", 0, { consigna: "?" }), "CONSIGNA_INVALIDA");
    rechaza(cambiando("vocales", 0, { pista: "🔴" }), "CONSIGNA_INVALIDA");
  });

  it("el icono, si viene, debe estar en la lista cerrada; los colores sueltos y lo inseguro no", () => {
    for (const malo of ["🔪", "🔴", "🟢", "💣", "🍺", "👻", "😈"]) {
      rechaza(cambiando("vocales", 0, { icono: malo }), "ICONO_NO_PERMITIDO");
    }
    rechaza(cambiando("palabras_silabas", 0, { icono: "🔴" }), "ICONO_NO_PERMITIDO");
    rechaza(version("vocales", actividad("vocales", "animales").map((e) => ({ ...e, icono: "🐝" }))), "ICONO_NO_PERMITIDO", { emojisPermitidos: undefined });
  });

  it("recursoId no se usa en una temática libre: no hay catálogo", () => {
    rechaza(cambiando("vocales", 0, { recursoId: "abeja" }), "ESTRUCTURA_INVALIDA");
    rechaza(cambiando("vocales", 0, (e) => ({ ...e, opciones: e.opciones.map((o, i) => (i === 0 ? { ...o, recursoId: "x" } : o)) })), "ESTRUCTURA_INVALIDA");
  });

  it("los campos desconocidos se rechazan en la frontera, como en el modo catálogo", () => {
    assert.throws(() => VersionJuego.rechazarCamposDesconocidos([{ ...vocal(1, "abeja"), script: "alert(1)" }]), EntradaInvalida);
    assert.throws(() => VersionJuego.rechazarCamposDesconocidos([{ ...vocal(1, "abeja"), opciones: [{ id: "o1", texto: "A", color: "rojo" }] }]), EntradaInvalida);
  });

  it("la cantidad: 10 ejercicios solo si están habilitados, y la aprobación exige la cantidad configurada", () => {
    const diez = version("vocales", [vocal(1, "abeja")], { cantidadEjercicios: 10 });
    rechaza(diez, "ENTRADA_INVALIDA", { permitirDiez: false, exigirCantidad: false });
    assert.doesNotThrow(() => validar(diez, { permitirDiez: true, exigirCantidad: false }));
    rechaza(diez, "ENTRADA_INVALIDA", { permitirDiez: true });
  });

  it("un rechazo nunca deja pasar el resto: el primer problema detiene la validación", () => {
    const v = cambiando("vocales", 2, { objetivo: "gato" });
    rechaza(v, "PALABRA_NO_EMPIEZA_CON_VOCAL");
  });
});

describe("ValidacionContenidoLibre: vocales", () => {
  it("la palabra debe empezar con vocal", () => {
    for (const mala of ["gato", "mesa", "hola", "xilófono"]) rechaza(cambiando("vocales", 0, { objetivo: mala }), "PALABRA_NO_EMPIEZA_CON_VOCAL");
  });

  it("la respuesta correcta la calcula el servidor: es la vocal inicial, no la que diga el ejercicio", () => {
    const e = vocal(1, "abeja");
    const equivocada = e.opciones.find((o) => o.texto === "E").id;
    rechaza(cambiando("vocales", 0, { respuestaCorrectaId: equivocada }), "RESPUESTA_INCORRECTA");
  });

  it("las opciones son vocales, sin repetir; la correcta aparece una sola vez", () => {
    rechaza(cambiando("vocales", 0, { opciones: opciones("A", "a", "E"), respuestaCorrectaId: "o1" }), "OPCIONES_REPETIDAS");
    rechaza(cambiando("vocales", 0, { opciones: opciones("A", "E", "A"), respuestaCorrectaId: "o1" }), "OPCIONES_REPETIDAS");
    rechaza(cambiando("vocales", 0, { opciones: opciones("Á", "A", "E"), respuestaCorrectaId: "o1" }), "OPCIONES_REPETIDAS");
    rechaza(cambiando("vocales", 0, { opciones: opciones("A", "B", "E"), respuestaCorrectaId: "o1" }), "OPCIONES_INVALIDAS");
    rechaza(cambiando("vocales", 0, { opciones: opciones("A", "EE", "I"), respuestaCorrectaId: "o1" }), "OPCIONES_INVALIDAS");
    rechaza(cambiando("vocales", 0, { opciones: opciones("A", "1", "I"), respuestaCorrectaId: "o1" }), "OPCIONES_INVALIDAS");
  });

  it("las vocales no necesitan dividir la palabra en sílabas: un hiato no la invalida", () => {
    assert.doesNotThrow(() => validar(cambiando("vocales", 0, { objetivo: "aéreo" })));
  });
});

describe("ValidacionContenidoLibre: completar la sílaba", () => {
  it("la palabra completa va en palabraId y el objetivo tiene un solo hueco", () => {
    rechaza(cambiando("completar_silaba", 0, { palabraId: undefined }), "ESTRUCTURA_INVALIDA");
    rechaza(cambiando("completar_silaba", 0, { objetivo: "pe rro" }), "ESTRUCTURA_INVALIDA");
    rechaza(cambiando("completar_silaba", 0, { objetivo: "__ __" }), "ESTRUCTURA_INVALIDA");
    rechaza(cambiando("completar_silaba", 0, { objetivo: undefined }), "ESTRUCTURA_INVALIDA");
  });

  it("la respuesta correcta la calcula el servidor: es la sílaba del hueco de la palabra, no la que marque el ejercicio", () => {
    // en "pe __" (perro) la que falta es "rro"; el ejercicio marca otra opción como correcta
    rechaza(cambiando("completar_silaba", 0, (e) => ({ ...e, respuestaCorrectaId: e.opciones.find((o) => o.texto !== "rro").id })), "RESPUESTA_INCORRECTA");
    // y no se puede formar otra palabra distinta de la declarada con la respuesta marcada
    rechaza(cambiando("completar_silaba", 0, (e) => ({ ...e, opciones: opciones("li", "to", "su"), respuestaCorrectaId: "o1" })), "RESPUESTA_INCORRECTA");
  });

  it("la división propuesta (las sílabas visibles y el hueco) debe coincidir con la del servidor", () => {
    rechaza(cambiando("completar_silaba", 0, () => completar(1, ["per", "ro"], 1)), "DIVISION_NO_COINCIDE");
    rechaza(cambiando("completar_silaba", 1, (e) => ({ ...completar(2, ["man", "za", "na"], 1), objetivo: "ma __ za na" })), "DIVISION_NO_COINCIDE");
    rechaza(cambiando("completar_silaba", 1, (e) => ({ ...completar(2, ["man", "za", "na"], 1), objetivo: "mana __" })), "DIVISION_NO_COINCIDE");
  });

  it("las opciones no se repiten y la correcta aparece una sola vez", () => {
    rechaza(cambiando("completar_silaba", 0, { opciones: opciones("rro", "rro", "to"), respuestaCorrectaId: "o1" }), "OPCIONES_REPETIDAS");
    rechaza(cambiando("completar_silaba", 0, { opciones: opciones("rro", "RRO", "to"), respuestaCorrectaId: "o1" }), "OPCIONES_REPETIDAS");
    rechaza(cambiando("completar_silaba", 0, { opciones: opciones("rro", "t0", "li"), respuestaCorrectaId: "o1" }), "OPCIONES_INVALIDAS");
  });

  it("de 2 a 4 sílabas; los hiatos y las palabras dudosas se rechazan con un motivo claro", () => {
    rechaza(cambiando("completar_silaba", 0, () => completar(1, ["a", "na", "ran", "ja", "do"], 1)), "SILABAS_FUERA_DE_RANGO");
    assert.throws(() => validar(cambiando("completar_silaba", 0, () => completar(1, ["po", "e", "ta"], 1))),
      (e) => e.codigo === "SILABEO_DUDOSO" && /hiato/i.test(e.message) && /otra palabra/i.test(e.message));
    rechaza(cambiando("completar_silaba", 0, () => completar(1, ["a", "tle", "ta"], 0)), "SILABEO_DUDOSO");
    rechaza(cambiando("completar_silaba", 0, () => completar(1, ["li", "ar"], 0)), "SILABEO_DUDOSO");
  });
});

describe("ValidacionContenidoLibre: contar sílabas", () => {
  it("la respuesta correcta es el número de sílabas que calcula el servidor", () => {
    rechaza(cambiando("contar_silabas", 0, (e) => ({ ...e, respuestaCorrectaId: e.opciones.find((o) => o.texto === "3").id })), "RESPUESTA_INCORRECTA");
    // la palabra tiene 4 sílabas y el ejercicio dice 3
    rechaza(cambiando("contar_silabas", 0, () => contar(1, "mariposa", 3)), "RESPUESTA_INCORRECTA");
  });

  it("las opciones son números del 1 al 9, sin repetir", () => {
    rechaza(cambiando("contar_silabas", 0, { opciones: opciones("2", "2", "3"), respuestaCorrectaId: "o1" }), "OPCIONES_REPETIDAS");
    rechaza(cambiando("contar_silabas", 0, { opciones: opciones("1", "dos", "3"), respuestaCorrectaId: "o2" }), "OPCIONES_INVALIDAS");
    rechaza(cambiando("contar_silabas", 0, { opciones: opciones("2", "10", "3"), respuestaCorrectaId: "o1" }), "OPCIONES_INVALIDAS");
  });

  it("de 2 a 4 sílabas", () => {
    rechaza(cambiando("contar_silabas", 0, () => contar(1, "sol", 1)), "SILABAS_FUERA_DE_RANGO");
    rechaza(cambiando("contar_silabas", 0, () => contar(1, "anaranjado", 5)), "SILABAS_FUERA_DE_RANGO");
  });

  it("los hiatos se rechazan por duda, con un motivo para el docente", () => {
    for (const palabra of ["león", "río", "teatro", "poeta", "país"]) {
      assert.throws(() => validar(cambiando("contar_silabas", 0, () => contar(1, palabra, 2))),
        (e) => e.codigo === "SILABEO_DUDOSO" && e.message.includes(palabra) && /hiato/i.test(e.message), palabra);
    }
  });
});

describe("ValidacionContenidoLibre: ordenar sílabas", () => {
  it("las piezas, en el orden correcto, deben ser la división del servidor", () => {
    rechaza(cambiando("palabras_silabas", 0, () => ordenar(1, "perro", ["per", "ro"])), "DIVISION_NO_COINCIDE");
    rechaza(cambiando("palabras_silabas", 0, () => ordenar(1, "manzana", ["ma", "nza", "na"])), "DIVISION_NO_COINCIDE");
    assert.throws(() => validar(cambiando("palabras_silabas", 0, () => ordenar(1, "manzana", ["manz", "ana"]))),
      (e) => e.codigo === "DIVISION_NO_COINCIDE" && /man-za-na/.test(e.message));
  });

  it("de 2 a 3 sílabas: más piezas serían difíciles de ordenar", () => {
    rechaza(cambiando("palabras_silabas", 0, () => ordenar(1, "mariposa", ["ma", "ri", "po", "sa"])), "SILABAS_FUERA_DE_RANGO");
    rechaza(cambiando("palabras_silabas", 0, () => ordenar(1, "sol", ["sol"])), "SILABAS_FUERA_DE_RANGO");
  });

  it("el orden correcto puede no ser el de las piezas guardadas, y se calcula con ordenCorrecto", () => {
    const desordenada = ordenar(1, "perro", ["pe", "rro"], {
      piezas: [{ id: "p2", texto: "rro" }, { id: "p1", texto: "pe" }], ordenCorrecto: ["p1", "p2"]
    });
    assert.doesNotThrow(() => validar(cambiando("palabras_silabas", 0, () => desordenada)));
    rechaza(cambiando("palabras_silabas", 0, () => ({ ...desordenada, ordenCorrecto: ["p2", "p1"] })), "DIVISION_NO_COINCIDE");
  });

  it("una sílaba repetida en la palabra es válida (cada pieza tiene su id)", () => {
    const v = version("palabras_silabas", [ordenar(1, "coco", ["co", "co"]), ...actividad("palabras_silabas", "animales").slice(1)]);
    assert.doesNotThrow(() => validar(v));
  });

  it("palabraId es la palabra declarada (las piezas deben formarla), y el objetivo, si viene, también", () => {
    rechaza(cambiando("palabras_silabas", 0, { palabraId: "gato" }), "DIVISION_NO_COINCIDE");
    rechaza(cambiando("palabras_silabas", 0, { objetivo: "gato" }), "ESTRUCTURA_INVALIDA");
    assert.doesNotThrow(() => validar(cambiando("palabras_silabas", 0, { objetivo: "Perro", palabraId: "PERRO" })));
  });

  it("los hiatos y las palabras dudosas se rechazan con un motivo", () => {
    rechaza(cambiando("palabras_silabas", 0, () => ordenar(1, "teatro", ["te", "a", "tro"])), "SILABEO_DUDOSO");
    rechaza(cambiando("palabras_silabas", 0, () => ordenar(1, "atlas", ["at", "las"])), "SILABEO_DUDOSO");
  });

  it("las piezas son solo letras: un símbolo o un color no cuenta como pieza", () => {
    rechaza(cambiando("palabras_silabas", 0, (e) => ({ ...e, piezas: [{ id: "p1", texto: "pe" }, { id: "p2", texto: "🔴" }] })), "PALABRA_INVALIDA");
  });
});
