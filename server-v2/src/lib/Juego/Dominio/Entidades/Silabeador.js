// Divide una palabra en sílabas según las reglas de la ortografía del español. Es puro: no importa nada.
//
// Principio: NUNCA adivina. Si la palabra cae en un caso que las reglas no resuelven con certeza (hiatos,
// consonantes que se separan distinto según el hablante, extranjerismos, letras ambiguas), no devuelve una
// división: devuelve { seguro: false, motivo }. Quien lo use decide qué hacer con la palabra rechazada.
//
// Reglas que aplica:
// - Vocales abiertas: a e o. Cerradas: i u (ü y la y final de palabra cuentan como cerradas). Acentuadas í ú.
// - Diptongo: abierta + cerrada (o al revés), o dos cerradas distintas. Triptongo: cerrada + abierta + cerrada.
// - Hiato: dos abiertas, o una abierta con una cerrada acentuada. Se rechaza a propósito (no se adivina cuál se enseña).
// - Una consonante entre vocales va con la vocal siguiente. ch, ll y rr son una sola consonante.
// - Dos consonantes se separan, salvo pl pr bl br fl fr gl gr kl kr cl cr dr tr, que van juntas con la vocal siguiente.
// - Tres o cuatro consonantes: la "s" se queda con la sílaba anterior (obs-tá-culo, cons-truir).
// - qu y gu antes de e/i son una consonante (la u es muda); gü antes de e/i tiene la ü pronunciada.
//
// Límite conocido: criado, vaciado y otras formas verbales con cerrada + abierta se aceptan como diptongo, aunque
// según el hablante sean hiato (cri-a-do). Las reglas no lo distinguen, así que la revisión del docente es la red final.

const FUERTES = new Set(["a", "e", "o", "á", "é", "ó"]);
const CERRADAS_ACENTUADAS = new Set(["í", "ú"]);
const CERRADAS = new Set(["i", "u", "ü", "y"]);
const VOCALES = new Set([...FUERTES, ...CERRADAS_ACENTUADAS, "i", "u", "ü"]);
// La w se excluye: puede ser vocal o consonante (kiwi, web) y no hay regla segura
const CONSONANTES = new Set("bcdfghjklmnñpqrstvxyz".split(""));
const LETRAS = new Set([...VOCALES, ...CONSONANTES]);
const MUDAS_ANTES_DE = new Set(["e", "i", "é", "í"]);
const GRUPOS_INSEPARABLES = new Set(["pl", "pr", "bl", "br", "fl", "fr", "gl", "gr", "kl", "kr", "cl", "cr", "dr", "tr"]);

const rechazo = (motivo) => ({ seguro: false, motivo });
const base = (v) => ({ í: "i", ú: "u", ü: "u" })[v] || v;

// Separa la palabra en consonantes y vocales, uniendo los dígrafos. Devuelve { tokens } o un rechazo.
function tokenizar(palabra) {
  const tokens = [];
  const consonante = (texto) => tokens.push({ tipo: "C", texto });
  const vocal = (texto) => tokens.push({ tipo: "V", texto });
  for (let i = 0; i < palabra.length; i++) {
    const c = palabra[i];
    const sig = palabra[i + 1];
    const anterior = tokens[tokens.length - 1];
    if ((c === "c" && sig === "h") || (c === "l" && sig === "l") || (c === "r" && sig === "r")) {
      consonante(c + sig);
      i++;
    } else if (c === "q") {
      // qu solo existe antes de e/i; "quasar" o una q suelta no tienen regla segura
      if (sig !== "u" || !MUDAS_ANTES_DE.has(palabra[i + 2])) return rechazo("LETRA_DUDOSA");
      consonante("qu");
      i++;
    } else if (c === "g") {
      if (sig === "u" && MUDAS_ANTES_DE.has(palabra[i + 2])) {
        consonante("gu");
        i++;
      } else {
        consonante("g");
      }
    } else if (c === "ü") {
      // La diéresis solo existe tras g y antes de e/i (pingüino)
      if (!(anterior && anterior.tipo === "C" && anterior.texto === "g") || !MUDAS_ANTES_DE.has(sig)) return rechazo("LETRA_DUDOSA");
      vocal(c);
    } else if (c === "y") {
      const sigEsVocal = sig !== undefined && VOCALES.has(sig);
      const antesEsVocal = anterior && anterior.tipo === "V";
      if (sig === undefined && antesEsVocal) vocal("y"); // hoy, rey, muy: vocal cerrada
      else if (sigEsVocal && (!anterior || antesEsVocal)) consonante("y"); // yema, playa
      else return rechazo("LETRA_DUDOSA");
    } else if (VOCALES.has(c)) {
      vocal(c);
    } else {
      consonante(c);
    }
  }
  return { tokens };
}

// Comprueba que un grupo de vocales seguidas sea un diptongo o un triptongo seguro
function motivoDeGrupoVocalico(vocales) {
  const clase = (v) => (FUERTES.has(v) ? "F" : CERRADAS_ACENTUADAS.has(v) ? "A" : "D");
  for (let i = 0; i < vocales.length - 1; i++) {
    const [a, b] = [vocales[i], vocales[i + 1]];
    const [ca, cb] = [clase(a), clase(b)];
    if (ca === "F" && cb === "F") return "HIATO";
    if ((ca === "F" && cb === "A") || (ca === "A" && cb === "F")) return "HIATO";
    if (ca !== "F" && cb !== "F" && base(a) === base(b)) return "VOCAL_REPETIDA";
    if (ca === "A" && cb === "A") return "GRUPO_VOCALICO_DUDOSO"; // dos cerradas con tilde no existen
  }
  if (vocales.length === 1 || vocales.length === 2) return null;
  const [c1, c2, c3] = vocales.map(clase);
  return vocales.length === 3 && c1 === "D" && c2 === "F" && c3 === "D" ? null : "GRUPO_VOCALICO_DUDOSO";
}

const esGrupo = (a, b) => a.texto.length === 1 && b.texto.length === 1 && GRUPOS_INSEPARABLES.has(a.texto + b.texto);
const hayTl = (consonantes) => consonantes.some((c, i) => c.texto === "t" && consonantes[i + 1] && consonantes[i + 1].texto === "l");

// Cuántas consonantes de un grupo entre vocales se quedan con la sílaba anterior; null si no hay regla segura
function corteInterior(c) {
  if (hayTl(c)) return null;
  if (c.length === 1) return 0;
  if (c.length === 2) return esGrupo(c[0], c[1]) ? 0 : 1;
  if (c.length === 3) {
    if (esGrupo(c[1], c[2])) return 1;
    return c[1].texto === "s" ? 2 : null;
  }
  if (c.length === 4) return c[1].texto === "s" && esGrupo(c[2], c[3]) ? 2 : null;
  return null;
}

// Devuelve { seguro: true, silabas: [...] } o { seguro: false, motivo }. Las sílabas salen en minúsculas.
function silabear(entrada) {
  if (typeof entrada !== "string") return rechazo("PALABRA_VACIA");
  const palabra = entrada.trim().normalize("NFC").toLowerCase();
  if (palabra === "") return rechazo("PALABRA_VACIA");
  if ([...palabra].some((c) => !LETRAS.has(c))) return rechazo("CARACTER_NO_PERMITIDO");

  // sub + l/r (sublime, subrayar) se corta distinto que en "obra" o "abrazo"; -iar/-uar (liar, actuar) puede ser hiato
  if (/^sub[lr]/.test(palabra)) return rechazo("PREFIJO_DUDOSO");
  if (/[iu]ar$/.test(palabra)) return rechazo("TERMINACION_DUDOSA");

  const tokenizado = tokenizar(palabra);
  if (tokenizado.seguro === false) return tokenizado;
  const { tokens } = tokenizado;
  if (!tokens.some((t) => t.tipo === "V")) return rechazo("SIN_VOCAL");

  // Se alternan grupos de consonantes y de vocales: C* (V+ C*)+
  const grupos = [];
  for (const token of tokens) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.tipo === token.tipo) ultimo.items.push(token);
    else grupos.push({ tipo: token.tipo, items: [token] });
  }
  for (const g of grupos.filter((x) => x.tipo === "V")) {
    const motivo = motivoDeGrupoVocalico(g.items.map((t) => t.texto));
    if (motivo) return rechazo(motivo);
  }

  const unir = (items) => items.map((t) => t.texto).join("");
  const silabas = [];
  let actual = "";
  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i];
    if (g.tipo === "V") {
      actual += unir(g.items);
    } else if (i === 0) {
      // Comienzo de palabra: una consonante o un grupo inseparable (tr, bl…); "ps", "gn" y similares son extranjerismos
      const valido = g.items.length === 1 || (g.items.length === 2 && esGrupo(g.items[0], g.items[1]));
      if (!valido) return rechazo("GRUPO_CONSONANTICO_DUDOSO");
      actual += unir(g.items);
    } else if (i === grupos.length - 1) {
      // Final de palabra: una sola consonante (ver, tres); "bíceps" o "robots" no siguen la regla
      if (g.items.length > 1) return rechazo("GRUPO_CONSONANTICO_DUDOSO");
      actual += unir(g.items);
    } else {
      const corte = corteInterior(g.items);
      if (corte === null) return rechazo("GRUPO_CONSONANTICO_DUDOSO");
      silabas.push(actual + unir(g.items.slice(0, corte)));
      actual = unir(g.items.slice(corte));
    }
  }
  silabas.push(actual);
  return { seguro: true, silabas };
}

// Compara una división propuesta (lista o texto con guiones) con la del servidor. Si el servidor duda, no coincide.
function coincideConPropuesta(palabra, propuesta) {
  const resultado = silabear(palabra);
  if (!resultado.seguro) return false;
  const piezas = typeof propuesta === "string" ? propuesta.split("-") : propuesta;
  if (!Array.isArray(piezas) || !piezas.every((p) => typeof p === "string")) return false;
  const normalizadas = piezas.map((p) => p.trim().normalize("NFC").toLowerCase());
  return normalizadas.length === resultado.silabas.length && normalizadas.every((p, i) => p === resultado.silabas[i]);
}

module.exports = { silabear, coincideConPropuesta };
