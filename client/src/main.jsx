import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";

const raiz = document.getElementById("root");
const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

// La portada llega prerenderizada (SEO). Hidratarla reutiliza ese HTML: si se volviera a crear,
// la animación de entrada del hero se reproduciría dos veces.
if (raiz.firstElementChild) hydrateRoot(raiz, app);
else createRoot(raiz).render(app);
