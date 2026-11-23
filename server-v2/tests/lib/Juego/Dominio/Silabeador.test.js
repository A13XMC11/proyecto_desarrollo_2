const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { silabear, coincideConPropuesta } = require("../../../../src/lib/Juego/Dominio/Entidades/Silabeador");
const catalogo = require("../../../../src/lib/Juego/Infraestructura/catalogo/learning-resources.json");

// Las divisiones esperadas salen de las reglas de la ortografía del español (RAE), no del código:
// cada palabra se divide a mano antes de probar. Un acierto aquí es una división correcta; una duda es un rechazo.
const dividir = (palabra) => {
  const r = silabear(palabra);
  assert.equal(r.seguro, true, `"${palabra}" debería dividirse y se rechazó por ${r.motivo}`);
  return r.silabas.join("-");
};

const DIVISIONES = {
  // Sílabas directas y vocales sueltas
  casa: "ca-sa", gato: "ga-to", mesa: "me-sa", luna: "lu-na", oso: "o-so", uva: "u-va", ala: "a-la", mano: "ma-no",
  pelota: "pe-lo-ta", mariposa: "ma-ri-po-sa", elefante: "e-le-fan-te", abeja: "a-be-ja", iguana: "i-gua-na",
  tortuga: "tor-tu-ga", conejo: "co-ne-jo", pato: "pa-to", vaca: "va-ca", nube: "nu-be", amor: "a-mor",
  // Palabras de una sílaba
  flor: "flor", cruz: "cruz", pan: "pan", mar: "mar", sol: "sol", club: "club",
  // Con tilde, que no cambia la división
  lápiz: "lá-piz", árbol: "ár-bol", papá: "pa-pá", mamá: "ma-má", café: "ca-fé", sofá: "so-fá", ratón: "ra-tón",
  dragón: "dra-gón", ñandú: "ñan-dú", imán: "i-mán",
  // Dígrafos ch, ll, rr (una sola consonante)
  chocolate: "cho-co-la-te", muchacho: "mu-cha-cho", ballena: "ba-lle-na", caballo: "ca-ba-llo", silla: "si-lla",
  mochila: "mo-chi-la", perro: "pe-rro", urraca: "u-rra-ca", ancho: "an-cho",
  // Grupos que no se separan: pl pr bl br fl fr gl gr kl kr cl cr dr tr
  libro: "li-bro", brazo: "bra-zo", abrazo: "a-bra-zo", plato: "pla-to", pluma: "plu-ma", trigo: "tri-go", tigre: "ti-gre",
  globo: "glo-bo", clase: "cla-se", grillo: "gri-llo", fresa: "fre-sa", sombrero: "som-bre-ro", cuatro: "cua-tro",
  // Consonantes que sí se separan
  ventana: "ven-ta-na", cuaderno: "cua-der-no", alfombra: "al-fom-bra", hombre: "hom-bre", inmenso: "in-men-so",
  innato: "in-na-to", cactus: "cac-tus", acción: "ac-ción", lección: "lec-ción", canción: "can-ción", mixto: "mix-to",
  // Tres y cuatro consonantes seguidas
  inglés: "in-glés", estrella: "es-tre-lla", instrumento: "ins-tru-men-to", construir: "cons-truir",
  monstruo: "mons-truo", obstáculo: "obs-tá-cu-lo", transporte: "trans-por-te", perspectiva: "pers-pec-ti-va",
  extra: "ex-tra", excursión: "ex-cur-sión", exacto: "e-xac-to",
  // x, k y h
  taxi: "ta-xi", examen: "e-xa-men", xilófono: "xi-ló-fo-no", karate: "ka-ra-te", hola: "ho-la", ahora: "a-ho-ra",
  ahumado: "a-hu-ma-do", prohibir: "pro-hi-bir", cohete: "co-he-te", alcohol: "al-co-hol", ahí: "a-hí",
  // qu y gu mudas, gü pronunciada
  queso: "que-so", esquina: "es-qui-na", quiero: "quie-ro", guitarra: "gui-ta-rra", guante: "guan-te", agua: "a-gua",
  pingüino: "pin-güi-no", cigüeña: "ci-güe-ña", vergüenza: "ver-güen-za", lingüística: "lin-güís-ti-ca",
  // Diptongos (vocal abierta + cerrada, o dos cerradas distintas)
  cielo: "cie-lo", tiempo: "tiem-po", puerta: "puer-ta", escuela: "es-cue-la", bueno: "bue-no", huevo: "hue-vo",
  hielo: "hie-lo", reina: "rei-na", peine: "pei-ne", aire: "ai-re", baile: "bai-le", ciudad: "ciu-dad",
  ruido: "rui-do", cuidado: "cui-da-do", cuídate: "cuí-da-te", limpio: "lim-pio", estudio: "es-tu-dio",
  familia: "fa-mi-lia", historia: "his-to-ria", gracias: "gra-cias", zanahoria: "za-na-ho-ria", camión: "ca-mión",
  avión: "a-vión", ruina: "rui-na", pie: "pie",
  // Triptongos
  buey: "buey", miau: "miau", guau: "guau", uruguay: "u-ru-guay",
  // y: consonante entre vocales o al inicio, vocal al final de palabra
  playa: "pla-ya", yema: "ye-ma", rayo: "ra-yo", ayuda: "a-yu-da", leyes: "le-yes", hoy: "hoy", muy: "muy",
  rey: "rey", ley: "ley"
};

// Palabras que el silabeador debe rechazar y el motivo. Rechazar nunca es un error: es la regla ante la duda.
const RECHAZOS = [
  // Hiatos: dos vocales abiertas, o una abierta con una cerrada acentuada
  ["poeta", "HIATO"], ["teatro", "HIATO"], ["leer", "HIATO"], ["león", "HIATO"], ["aéreo", "HIATO"],
  ["héroe", "HIATO"], ["zoológico", "HIATO"], ["cooperar", "HIATO"], ["paella", "HIATO"], ["canoa", "HIATO"],
  ["idea", "HIATO"], ["museo", "HIATO"], ["peor", "HIATO"], ["poema", "HIATO"], ["crear", "HIATO"],
  ["paseo", "HIATO"], ["cacao", "HIATO"], ["caos", "HIATO"], ["boa", "HIATO"], ["aa", "HIATO"],
  ["país", "HIATO"], ["día", "HIATO"], ["maíz", "HIATO"], ["baúl", "HIATO"], ["oído", "HIATO"], ["río", "HIATO"],
  ["tío", "HIATO"], ["ríe", "HIATO"], ["continúa", "HIATO"], ["línea", "HIATO"], ["reír", "HIATO"], ["raúl", "HIATO"],
  // La misma vocal cerrada repetida, o grupos de vocales que no son diptongo ni triptongo
  ["chiita", "VOCAL_REPETIDA"], ["tuu", "VOCAL_REPETIDA"], ["maia", "GRUPO_VOCALICO_DUDOSO"],
  ["tuia", "GRUPO_VOCALICO_DUDOSO"],
  // Consonantes: "tl" se separa distinto según el hablante; los inicios y finales raros son extranjerismos
  ["atlas", "GRUPO_CONSONANTICO_DUDOSO"], ["atleta", "GRUPO_CONSONANTICO_DUDOSO"],
  ["psicólogo", "GRUPO_CONSONANTICO_DUDOSO"], ["gnomo", "GRUPO_CONSONANTICO_DUDOSO"],
  ["bíceps", "GRUPO_CONSONANTICO_DUDOSO"], ["robots", "GRUPO_CONSONANTICO_DUDOSO"],
  ["prnto", "GRUPO_CONSONANTICO_DUDOSO"], ["abcdefa", "GRUPO_CONSONANTICO_DUDOSO"],
  // Letras con un papel ambiguo
  ["quasar", "LETRA_DUDOSA"], ["müsica", "LETRA_DUDOSA"], ["ayla", "LETRA_DUDOSA"], ["inyectar", "LETRA_DUDOSA"],
  ["y", "LETRA_DUDOSA"],
  // Prefijos y terminaciones que cambian el corte o el hiato
  ["subrayar", "PREFIJO_DUDOSO"], ["sublime", "PREFIJO_DUDOSO"],
  ["liar", "TERMINACION_DUDOSA"], ["fiar", "TERMINACION_DUDOSA"], ["actuar", "TERMINACION_DUDOSA"],
  ["continuar", "TERMINACION_DUDOSA"],
  // No son una palabra del español escrita en letras
  ["wifi", "CARACTER_NO_PERMITIDO"], ["kiwi", "CARACTER_NO_PERMITIDO"], ["ab1", "CARACTER_NO_PERMITIDO"],
  ["hola mundo", "CARACTER_NO_PERMITIDO"], ["ca-sa", "CARACTER_NO_PERMITIDO"], ["pa$", "CARACTER_NO_PERMITIDO"],
  ["àrbol", "CARACTER_NO_PERMITIDO"], ["ça", "CARACTER_NO_PERMITIDO"],
  ["brr", "SIN_VOCAL"], ["xyz", "LETRA_DUDOSA"],
  ["", "PALABRA_VACIA"], ["   ", "PALABRA_VACIA"], [null, "PALABRA_VACIA"], [undefined, "PALABRA_VACIA"], [42, "PALABRA_VACIA"]
];

describe("Silabeador: divisiones correctas", () => {
  for (const [palabra, esperada] of Object.entries(DIVISIONES)) {
    it(`${palabra} → ${esperada}`, () => {
      assert.equal(dividir(palabra), esperada);
    });
  }
});

describe("Silabeador: ante la duda, rechaza (nunca adivina)", () => {
  for (const [palabra, motivo] of RECHAZOS) {
    it(`rechaza ${JSON.stringify(palabra)} por ${motivo}`, () => {
      const r = silabear(palabra);
      assert.equal(r.seguro, false);
      assert.equal(r.motivo, motivo);
      assert.equal(r.silabas, undefined, "un rechazo no devuelve una división a medias");
    });
  }
});

describe("Silabeador: entrada", () => {
  it("ignora mayúsculas y espacios en los extremos, y devuelve minúsculas", () => {
    assert.equal(dividir("  Mariposa "), "ma-ri-po-sa");
    assert.equal(dividir("ÁRBOL"), "ár-bol");
    assert.equal(dividir("Ñandú"), "ñan-dú");
  });

  it("acepta la tilde escrita como letra y acento separados (NFD)", () => {
    assert.equal(dividir("árbol"), "ár-bol");
    assert.equal(dividir("pingüino"), "pin-güi-no");
  });
});

describe("Silabeador: todas las combinaciones de dos vocales", () => {
  const letras = ["a", "e", "i", "o", "u", "á", "é", "í", "ó", "ú"];
  // Únicos pares que forman diptongo con certeza: abierta + cerrada sin acento (o al revés), o dos cerradas distintas
  const DIPTONGOS = new Set([
    "ai", "ei", "oi", "au", "eu", "ou", "ái", "éi", "ói", "áu", "éu", "óu",
    "ia", "ie", "io", "ua", "ue", "uo", "iá", "ié", "ió", "uá", "ué", "uó",
    "iu", "ui", "iú", "uí", "íu", "úi"
  ]);
  const REPETIDAS = new Set(["ii", "ií", "íi", "íí", "uu", "uú", "úu", "úú"]);
  // Dos cerradas distintas y las dos con tilde no existen en español: no se adivina
  const DOS_TILDES = new Set(["íú", "úí"]);

  it("de los 100 pares posibles, solo los diptongos se juntan; el resto se rechaza con su motivo", () => {
    let juntos = 0;
    for (const a of letras) {
      for (const b of letras) {
        const palabra = `p${a}${b}n`;
        const r = silabear(palabra);
        if (DIPTONGOS.has(a + b)) {
          assert.deepEqual(r, { seguro: true, silabas: [palabra] }, palabra);
          juntos++;
        } else {
          assert.equal(r.seguro, false, `${palabra} debería rechazarse`);
          const motivo = REPETIDAS.has(a + b) ? "VOCAL_REPETIDA" : DOS_TILDES.has(a + b) ? "GRUPO_VOCALICO_DUDOSO" : "HIATO";
          assert.equal(r.motivo, motivo, palabra);
        }
      }
    }
    assert.equal(juntos, DIPTONGOS.size);
  });

  it("los triptongos son cerrada + abierta + cerrada; otros grupos de tres vocales se rechazan", () => {
    for (const c1 of ["i", "u"]) for (const v of ["a", "e", "o", "á", "é", "ó"]) for (const c2 of ["i", "u"]) {
      const palabra = `p${c1}${v}${c2}n`;
      assert.deepEqual(silabear(palabra), { seguro: true, silabas: [palabra] }, palabra);
    }
    for (const palabra of ["piaan", "paian", "puian"]) assert.equal(silabear(palabra).seguro, false, palabra);
  });
});

describe("Silabeador: todas las combinaciones de dos consonantes entre vocales", () => {
  const consonantes = "bcdfghjklmnñprstvxz".split("");
  const INSEPARABLES = ["pl", "pr", "bl", "br", "fl", "fr", "gl", "gr", "kl", "kr", "cl", "cr", "dr", "tr"];
  const DIGRAFOS = ["ch", "ll", "rr"];

  it("a+C1C2+a: grupos inseparables y dígrafos van con la vocal siguiente; tl se rechaza; el resto se separa", () => {
    for (const c1 of consonantes) for (const c2 of consonantes) {
      const par = c1 + c2;
      const palabra = `a${par}a`;
      const r = silabear(palabra);
      if (par === "tl") {
        assert.deepEqual(r, { seguro: false, motivo: "GRUPO_CONSONANTICO_DUDOSO" }, palabra);
      } else if (INSEPARABLES.includes(par) || DIGRAFOS.includes(par)) {
        assert.deepEqual(r, { seguro: true, silabas: ["a", `${par}a`] }, palabra);
      } else {
        assert.deepEqual(r, { seguro: true, silabas: [`a${c1}`, `${c2}a`] }, palabra);
      }
    }
  });

  it("una sola consonante entre vocales siempre va con la vocal siguiente", () => {
    for (const c of consonantes) assert.equal(dividir(`a${c}a`), `a-${c}a`, c);
  });

  it("tres consonantes: si las dos últimas son grupo inseparable se cortan antes; con s en medio se corta después", () => {
    assert.equal(dividir("ampla"), "am-pla");
    assert.equal(dividir("antra"), "an-tra");
    assert.equal(dividir("angla"), "an-gla");
    assert.equal(dividir("anstra"), "ans-tra");
    assert.equal(dividir("abspa"), "abs-pa");
    for (const dudosa of ["abcda", "ardma", "alkma"]) assert.equal(silabear(dudosa).seguro, false, dudosa);
  });
});

describe("Silabeador: propiedades que deben cumplirse siempre", () => {
  const todas = [...Object.keys(DIVISIONES), ...catalogo.recursos.map((r) => r.palabra)];

  it("las sílabas unidas son la palabra, sin letras añadidas ni perdidas", () => {
    for (const palabra of todas) {
      const r = silabear(palabra);
      if (r.seguro) assert.equal(r.silabas.join(""), palabra.normalize("NFC").toLowerCase(), palabra);
    }
  });

  it("cada sílaba tiene exactamente un núcleo vocálico (un grupo de vocales seguido)", () => {
    for (const palabra of todas) {
      const r = silabear(palabra);
      if (!r.seguro) continue;
      for (const silaba of r.silabas) {
        // la "u" muda de que/qui/gue/gui no cuenta, y la "y" final (hoy, buey) es parte del mismo núcleo
        const sinMudas = silaba.replace(/(?<=[qg])u(?=[eiéí])/g, "");
        const nucleos = sinMudas.match(/[aeiouáéíóúü]+y?/g) || [];
        assert.equal(nucleos.length, 1, `"${silaba}" de "${palabra}" tiene ${nucleos.length} núcleos`);
      }
    }
  });

  it("es determinista: la misma palabra da siempre la misma división", () => {
    for (const palabra of todas) assert.deepEqual(silabear(palabra), silabear(palabra));
  });

  it("no modifica ni comparte su resultado entre llamadas", () => {
    const a = silabear("gato");
    a.silabas.push("x");
    assert.deepEqual(silabear("gato").silabas, ["ga", "to"]);
  });
});

describe("Silabeador y el catálogo revisado", () => {
  it("nunca contradice la división que revisó el equipo: o coincide o rechaza", () => {
    const distintas = [];
    for (const r of catalogo.recursos) {
      const s = silabear(r.palabra);
      if (s.seguro && s.silabas.join("-") !== r.silabas.join("-")) {
        distintas.push(`${r.palabra}: catálogo ${r.silabas.join("-")} / silabeador ${s.silabas.join("-")}`);
      }
    }
    assert.deepEqual(distintas, []);
  });

  it("todo rechazo del catálogo trae un motivo", () => {
    for (const r of catalogo.recursos) {
      const s = silabear(r.palabra);
      if (!s.seguro) assert.equal(typeof s.motivo, "string", r.palabra);
    }
  });
});

describe("coincideConPropuesta (la IA propone, el servidor decide)", () => {
  it("acepta la división propuesta si es idéntica a la del servidor, en lista o con guiones", () => {
    assert.equal(coincideConPropuesta("mariposa", ["ma", "ri", "po", "sa"]), true);
    assert.equal(coincideConPropuesta("mariposa", "ma-ri-po-sa"), true);
    assert.equal(coincideConPropuesta("Mariposa", "MA-RI-PO-SA"), true);
  });

  it("rechaza una división distinta de la del servidor", () => {
    assert.equal(coincideConPropuesta("mariposa", ["mar", "i", "po", "sa"]), false);
    assert.equal(coincideConPropuesta("mariposa", ["ma", "ri", "po"]), false);
    assert.equal(coincideConPropuesta("gato", ["ga", "to", "x"]), false);
    assert.equal(coincideConPropuesta("gato", ["g", "ato"]), false);
  });

  it("rechaza si el servidor duda, aunque la propuesta parezca razonable", () => {
    assert.equal(coincideConPropuesta("poeta", ["po", "e", "ta"]), false);
    assert.equal(coincideConPropuesta("atlas", ["at", "las"]), false);
  });

  it("rechaza propuestas mal formadas", () => {
    assert.equal(coincideConPropuesta("gato", null), false);
    assert.equal(coincideConPropuesta("gato", undefined), false);
    assert.equal(coincideConPropuesta("gato", "ga-to-"), false);
    assert.equal(coincideConPropuesta("gato", ["ga", 5]), false);
    assert.equal(coincideConPropuesta("gato", { silabas: ["ga", "to"] }), false);
    assert.equal(coincideConPropuesta("gato", ["ga", ""]), false);
  });
});
