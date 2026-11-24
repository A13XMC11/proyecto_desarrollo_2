import DoodleCrewFooter from "../shadcn/doodle-crew-footer";

// Enlaces reales de la portada: secciones de esta misma página y rutas públicas
const columnas = [
  {
    title: "Producto",
    links: [
      { label: "Cómo funciona", href: "#como-funciona" },
      { label: "En el aula", href: "#en-el-aula" },
      { label: "Precio", href: "#precio" },
      { label: "Preguntas", href: "#preguntas" }
    ]
  },
  {
    title: "Docentes",
    links: [
      { label: "Crear cuenta", href: "/registro" },
      { label: "Ingresar", href: "/ingresar" }
    ]
  },
  {
    title: "Estudiantes",
    links: [{ label: "Jugar con mi código", href: "/jugar" }]
  }
];

const acciones = [
  { label: "Jugar ahora", href: "/jugar", icon: "star", variant: "outline" },
  { label: "Crear mi cuenta", href: "/registro", icon: "bolt", variant: "solid" }
];

// Los personajes viven sobre las letras de L-E-T-R-I-T-A-S (índices 0 a 7)
const pandilla = [
  // El yeti va a la izquierda de la L (que en Nunito es angosta) para no taparla
  { kind: "yeti", letter: 0, seat: "front", offset: -1.15, name: "Bruno", says: "¡Tengo hambre de palabras!" },
  { kind: "bird", letter: 1, seat: "top", offset: 0.02, name: "Pío", says: "¡Pío, pío! ¿Te sabes las vocales?" },
  { kind: "mushroom", letter: 2, seat: "front", offset: 0.12, scale: 0.95, name: "Hongui", says: "¿Jugamos a armar sílabas?" },
  { kind: "kid", letter: 4, seat: "top", offset: -0.05, name: "Juno", says: "¡Desde aquí veo todas las letras!" },
  { kind: "ghost", letter: 6, seat: "behind", offset: 0, name: "Bu", says: "¡Bu! No te asustes, solo quiero leer contigo." },
  { kind: "cat", letter: 7, seat: "front", offset: 0.42, flip: true, name: "Pecas", says: "¡Miau! La S es mi letra favorita." }
];

const DATOS = {
  wordmark: "LETRITAS",
  blurb: "Minijuegos de vocales y sílabas para 1.º a 3.º de EGB. La IA arma el borrador y tú decides qué llega a tu aula.",
  tagline: "Primero la vocal, después la sílaba.",
  columns: columnas,
  actions: acciones
};

// Peor caso realista, solo en desarrollo (?pie=extremo o ?pie=corto). Se queda como prueba de regresión.
const DATOS_PRUEBA = {
  extremo: {
    ...DATOS,
    wordmark: "ABECEDARIO",
    columns: [
      ...columnas,
      {
        title: "Privacidad y protección de datos",
        links: [
          { label: "Cómo cuidamos los datos de los estudiantes menores de edad", href: "#" },
          { label: "Términos", href: "#" }
        ]
      }
    ],
    actions: []
  },
  corto: { ...DATOS, wordmark: "LEO", columns: columnas.slice(0, 1), tagline: "Leer." }
};
const datosPie = () => {
  if (!import.meta.env.DEV || typeof window === "undefined") return DATOS;
  return DATOS_PRUEBA[new URLSearchParams(window.location.search).get("pie")] || DATOS;
};

export const PiePagina = () => {
  const datos = datosPie();
  return (
  // Ancho completo: como elemento flex sin ancho, la palabra gigante se encoge
  <div className="w-full">
    <DoodleCrewFooter
      wordmark={datos.wordmark}
      brand="Letritas"
      blurb={datos.blurb}
      tagline={datos.tagline}
      columns={datos.columns}
      actions={datos.actions}
      copyright="© 2026 Letritas. Todos los derechos reservados."
      legal={[]}
      socials={[]}
      crew={pandilla}
      // Tokens del tema (index.css), con el valor de respaldo por si alguno faltara
      palette={{
        background: "var(--color-background, #ffffff)",
        ink: "var(--color-tinta, #0f172a)",
        accent: "var(--color-marca-600, #2563eb)"
      }}
      fontFamily='"Nunito", ui-rounded, "DM Sans", sans-serif'
      serifFamily='"DM Sans", ui-sans-serif, system-ui, sans-serif'
    />
  </div>
  );
};
