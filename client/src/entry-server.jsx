import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { App } from "./App";

// Solo para el prerender de las páginas públicas en `npm run build`
export const render = (url) =>
  renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>
  );
