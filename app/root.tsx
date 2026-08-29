import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { useAppStore } from "~/lib/store";
import { useThemeStore } from "~/lib/theme";
import { useI18nStore } from "~/lib/i18n";
import { useEffect } from "react";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=JetBrains+Mono:wght@400;500&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { init } = useAppStore();
  const { theme } = useThemeStore();
  const { language } = useI18nStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <html lang={language} className={theme === "dark" ? "dark" : ""}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-[#080c14] text-slate-900 dark:text-slate-100 transition-colors duration-300">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "Ha ocurrido un error inesperado.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "No se pudo encontrar la página solicitada."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="glass-card p-10 max-w-lg w-full space-y-4">
        <h1 className="text-5xl font-black text-rose-500">{message}</h1>
        <p className="text-slate-600 dark:text-slate-300">{details}</p>
        <a href="/" className="primary-button inline-flex text-sm mt-4">
          Volver al Inicio
        </a>
      </div>
      {stack && (
        <pre className="mt-8 max-w-2xl w-full p-4 text-xs font-mono text-left bg-slate-950 text-slate-300 rounded-xl overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
