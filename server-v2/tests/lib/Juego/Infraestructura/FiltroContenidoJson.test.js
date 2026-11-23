const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const FiltroContenidoJson = require("../../../../src/lib/Juego/Infraestructura/FiltroContenidoJson");
const IFiltroContenido = require("../../../../src/lib/Juego/Dominio/Ports/IFiltroContenido");
const EntradaInvalida = require("../../../../src/lib/Compartido/Dominio/Errores/EntradaInvalida");
const datos = require("../../../../src/lib/Juego/Infraestructura/filtro/terminosBloqueados.json");
const catalogo = require("../../../../src/lib/Juego/Infraestructura/catalogo/learning-resources.json");

const filtro = new FiltroContenidoJson();
const lista = (texto) => texto.split(/\s+/).filter(Boolean);

// (a) Palabras inocentes que DEBEN pasar
const INOCENTES = {
  frutas: lista("manzana naranja plátano sandía piña uva fresa melón cereza pera mango limón durazno mora papaya guayaba banano coco tomate aguacate"),
  colores: lista("rojo azul verde amarillo morado rosado celeste negro blanco café gris dorado plateado"),
  animales: lista("perro gato vaca gallina pollito pato oveja caballo burro cerdo rana mariposa guau miau muu pío cuac beee oink chancho zorro perra"),
  cuerpo: lista("pie mano ojo boca nariz oreja cabeza brazo pierna dedo diente lengua cara pelo rodilla codo pecho espalda corazón esqueleto"),
  escuela: lista("pizarra lápiz cuaderno mochila escuela maestra libro borrador regla tiza pupitre recreo tarea lectura profesor compañero"),
  comida: lista("arroz pan leche queso huevo sopa ensalada jugo galleta pollo pescado papa yuca maíz helado cuchara cuchillo tenedor"),
  transporte: lista("bus carro bicicleta avión barco tren moto camión taxi helicóptero tranvía canoa camioneta bombero ambulancia"),
  // Palabras que contienen un término bloqueado dentro de otra palabra: por palabra completa NO deben bloquearse
  contienenOtraPalabra: lista("ensalada mano computadora círculo vehículo músculo cálculo tetera armario alarma farmacia balanza ronda cronómetro fantasía bombilla drogueria sexto pena reputación residencia")
};

// (b) Términos que DEBEN bloquearse, con su categoría
const BLOQUEADAS = {
  politica: ["política", "político", "elecciones", "presidente", "gobierno", "dictadura", "partido político", "candidato", "corrupción"],
  religion: ["religión", "dios", "jesucristo", "biblia", "iglesia", "demonio", "mezquita", "sacerdote", "rezar"],
  violencia: ["violencia", "matar", "asesino", "golpear", "secuestro", "tortura", "guerra", "terrorista", "pelea"],
  armas: ["arma", "pistola", "rifle", "escopeta", "metralleta", "granada", "machete", "espada", "dinamita"],
  drogas_alcohol: ["droga", "marihuana", "cocaína", "cerveza", "alcohol", "borracho", "cigarrillo", "whisky", "aguardiente"],
  sexualidad: ["sexo", "sexual", "desnudo", "pene", "vagina", "porno", "violación", "nalgas", "erótico"],
  enfermedades_salud: ["enfermedad", "cáncer", "sida", "covid", "diabetes", "dengue", "epidemia", "tumor", "inyección"],
  muerte_miedo: ["muerte", "muerto", "morir", "cadáver", "cementerio", "tumba", "fantasma", "miedo", "terror", "suicidio"],
  marcas_comerciales: ["coca cola", "pepsi", "nike", "adidas", "mcdonalds", "disney", "pokemon", "nintendo", "tiktok", "nutella"],
  insultos: ["estúpido", "idiota", "imbécil", "mierda", "puta", "pendejo", "cabrón", "hijo de puta", "maricón"]
};

describe("FiltroContenidoJson: palabras inocentes pasan", () => {
  for (const [grupo, palabras] of Object.entries(INOCENTES)) {
    it(`${grupo}: ${palabras.length} palabras`, () => {
      for (const palabra of palabras) assert.deepEqual(filtro.evaluar(palabra), { permitido: true }, palabra);
    });
  }

  it("todo el catálogo revisado pasa (palabras y temáticas)", () => {
    for (const r of catalogo.recursos) {
      assert.deepEqual(filtro.evaluar(r.palabra), { permitido: true }, r.palabra);
      assert.deepEqual(filtro.evaluar(r.tematica.replace(/_/g, " ")), { permitido: true }, r.tematica);
    }
  });

  it("una temática libre y frases normales de un docente pasan", () => {
    for (const texto of ["sonidos de animales", "frutas tropicales", "medios de transporte", "colores del arcoíris",
      "mi mascota y yo", "Animales de la granja", "cuerpo humano", "la escuela y los útiles"]) {
      assert.deepEqual(filtro.evaluar(texto), { permitido: true }, texto);
    }
  });

  it("texto vacío o ausente no tiene nada que bloquear", () => {
    for (const vacio of ["", "   ", undefined, null]) assert.deepEqual(filtro.evaluar(vacio), { permitido: true });
  });

  it("un valor que no es texto es un error de quien llama, no un permiso", () => {
    for (const malo of [42, {}, [], true]) assert.throws(() => filtro.evaluar(malo), EntradaInvalida);
  });
});

describe("FiltroContenidoJson: términos bloqueados, por categoría", () => {
  for (const [categoria, terminos] of Object.entries(BLOQUEADAS)) {
    it(`${categoria}`, () => {
      for (const termino of terminos) assert.deepEqual(filtro.evaluar(termino), { permitido: false, categoria }, termino);
    });
  }

  it("ignora mayúsculas y tildes (escritas o ausentes)", () => {
    assert.equal(filtro.evaluar("POLÍTICA").categoria, "politica");
    assert.equal(filtro.evaluar("politica").categoria, "politica");
    assert.equal(filtro.evaluar("Cocaína").categoria, "drogas_alcohol");
    assert.equal(filtro.evaluar("cocaina").categoria, "drogas_alcohol");
    assert.equal(filtro.evaluar("cadaver").categoria, "muerte_miedo");
    assert.equal(filtro.evaluar("ARMA").categoria, "armas");
    assert.equal(filtro.evaluar("Pokémon").categoria, "marcas_comerciales");
    assert.equal(filtro.evaluar("pokemon").categoria, "marcas_comerciales");
  });

  it("colapsa letras repetidas", () => {
    assert.equal(filtro.evaluar("puuuuta").categoria, "insultos");
    assert.equal(filtro.evaluar("muuuerte").categoria, "muerte_miedo");
    assert.equal(filtro.evaluar("drooogas").categoria, "drogas_alcohol");
    assert.equal(filtro.evaluar("peeene").categoria, "sexualidad");
  });

  it("revierte sustituciones comunes de letras (0→o, 1→i, 3→e, @→a, $→s)", () => {
    assert.equal(filtro.evaluar("m13rd@").categoria, "insultos");
    assert.equal(filtro.evaluar("dr0g@").categoria, "drogas_alcohol");
    assert.equal(filtro.evaluar("p0l1t1c@").categoria, "politica");
    assert.equal(filtro.evaluar("$3x0").categoria, "sexualidad");
    assert.equal(filtro.evaluar("m@t@r").categoria, "violencia");
    assert.equal(filtro.evaluar("c@ncer").categoria, "enfermedades_salud");
  });

  it("combina las técnicas: mayúsculas, tildes, repeticiones y sustituciones a la vez", () => {
    assert.equal(filtro.evaluar("MÍ3RRRD@").categoria, "insultos");
    assert.equal(filtro.evaluar("¡¡D R0GAAAS!!".replace(/ /g, "")).categoria, "drogas_alcohol");
  });

  it("detecta plurales de los términos de la lista", () => {
    assert.equal(filtro.evaluar("drogas").categoria, "drogas_alcohol");
    assert.equal(filtro.evaluar("armas").categoria, "armas");
    assert.equal(filtro.evaluar("pistolas").categoria, "armas");
    assert.equal(filtro.evaluar("fantasmas").categoria, "muerte_miedo");
    assert.equal(filtro.evaluar("elecciones").categoria, "politica");
  });

  it("encuentra el término dentro de una frase, con signos de puntuación", () => {
    assert.equal(filtro.evaluar("quiero una actividad sobre armas y animales").categoria, "armas");
    assert.equal(filtro.evaluar("¡La muerte!").categoria, "muerte_miedo");
    assert.equal(filtro.evaluar("frutas, cerveza y jugos").categoria, "drogas_alcohol");
    assert.equal(filtro.evaluar("hijo-de-puta").categoria, "insultos");
    assert.equal(filtro.evaluar("el   partido    politico").categoria, "politica");
    assert.equal(filtro.evaluar("coca-cola").categoria, "marcas_comerciales");
    assert.equal(filtro.evaluar("McDonald's").categoria, "marcas_comerciales");
  });

  it("por palabra completa: un término dentro de otra palabra no bloquea", () => {
    assert.deepEqual(filtro.evaluar("computadora"), { permitido: true });
    assert.deepEqual(filtro.evaluar("círculo"), { permitido: true });
    assert.deepEqual(filtro.evaluar("alarma"), { permitido: true });
    // pero el término suelto, aunque esté entre palabras inocentes, sí
    assert.equal(filtro.evaluar("computadora arma círculo").categoria, "armas");
  });

  it("la ñ no se confunde con la n", () => {
    // "año" no debe volverse "ano": se compara como ñ
    assert.deepEqual(filtro.evaluar("año"), { permitido: true });
    assert.deepEqual(filtro.evaluar("niño piña araña"), { permitido: true });
  });
});

describe("FiltroContenidoJson: el resultado no repite lo bloqueado", () => {
  it("devuelve solo la categoría, nunca el término ni el texto", () => {
    for (const [categoria, terminos] of Object.entries(BLOQUEADAS)) {
      for (const termino of terminos) {
        const resultado = filtro.evaluar(`sonidos de ${termino} para niños`);
        // Exactamente estos dos campos: ni el término, ni el texto evaluado, ni una versión normalizada de ellos
        assert.deepEqual(resultado, { permitido: false, categoria }, termino);
      }
    }
  });

  it("si hay varios términos, informa solo una categoría, la primera del texto", () => {
    const r = filtro.evaluar("cerveza y pistola");
    assert.equal(r.permitido, false);
    assert.equal(typeof r.categoria, "string");
  });

  it("es determinista y no guarda estado entre llamadas", () => {
    assert.deepEqual(filtro.evaluar("pistola"), filtro.evaluar("pistola"));
    filtro.evaluar("pistola");
    assert.deepEqual(filtro.evaluar("manzana"), { permitido: true });
  });
});

describe("terminosBloqueados.json: lista revisable por un docente", () => {
  it("tiene las 10 categorías del puerto y todas con términos", () => {
    assert.deepEqual(Object.keys(datos.categorias), IFiltroContenido.CATEGORIAS);
    for (const [categoria, terminos] of Object.entries(datos.categorias)) {
      assert.ok(Array.isArray(terminos) && terminos.length >= 10, `${categoria} debería tener al menos 10 términos`);
    }
  });

  it("documenta que es una defensa parcial y cómo editarla", () => {
    assert.ok(datos.meta && typeof datos.meta.descripcion === "string");
    assert.match(datos.meta.limites, /parcial/i);
    assert.match(datos.meta.limites, /docente/i);
    assert.equal(typeof datos.meta.comoEditar, "string");
  });

  it("cada término de la lista se bloquea a sí mismo y con su categoría", () => {
    for (const [categoria, terminos] of Object.entries(datos.categorias)) {
      for (const termino of terminos) assert.deepEqual(filtro.evaluar(termino), { permitido: false, categoria }, termino);
    }
  });

  it("ningún término de la lista bloquea una palabra del catálogo ni de las inocentes", () => {
    const inocentes = Object.values(INOCENTES).flat();
    for (const palabra of inocentes) assert.equal(filtro.evaluar(palabra).permitido, true, palabra);
  });

  it("sin términos repetidos: dentro de una categoría ni entre categorías", () => {
    const vistos = new Map();
    for (const [categoria, terminos] of Object.entries(datos.categorias)) {
      for (const t of terminos) {
        const clave = t.toLowerCase();
        assert.equal(vistos.has(clave), false, `"${t}" está en ${categoria} y en ${vistos.get(clave)}`);
        vistos.set(clave, categoria);
      }
    }
  });
});

describe("FiltroContenidoJson: una lista mal armada es un error al cargar", () => {
  const con = (categorias) => () => new FiltroContenidoJson({ categorias });
  const base = Object.fromEntries(IFiltroContenido.CATEGORIAS.map((c, i) => [c, [`termino${"abcdefghij"[i]}x`]]));

  it("acepta una lista completa y válida", () => {
    assert.doesNotThrow(con(base));
  });

  it("rechaza datos sin categorías, una categoría desconocida o una que falta", () => {
    assert.throws(() => new FiltroContenidoJson({}), EntradaInvalida);
    assert.throws(() => new FiltroContenidoJson(null), EntradaInvalida);
    assert.throws(con({ ...base, inventada: ["xx"] }), EntradaInvalida);
    const { insultos, ...sin } = base;
    assert.throws(con(sin), EntradaInvalida);
  });

  it("rechaza términos vacíos, que no son texto, de una sola letra o sin letras", () => {
    for (const malo of ["", "   ", 5, null, "a", "123", "!!"]) {
      assert.throws(con({ ...base, politica: [malo] }), EntradaInvalida, String(malo));
    }
  });

  it("rechaza el mismo término en dos categorías, aunque cambie la escritura", () => {
    assert.throws(con({ ...base, politica: ["gobierno"], religion: ["GOBIERNOO"] }), EntradaInvalida);
    assert.throws(con({ ...base, politica: ["gobierno"], religion: ["gobierno"] }), EntradaInvalida);
  });
});
