"use client";

import { useEffect, useRef } from "react";

type ReporterProps = {
  /* props solo en la global-error page */
  error?: Error & { digest?: string };
  reset?: () => void;
};

export default function ErrorReporter({ error, reset }: ReporterProps) {
  /* ─ instrumentation compartida ─ */
  const lastOverlayMsg = useRef<string>("");
  // En browser el tipo correcto para setInterval:
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Guardar por si renderiza en SSR (no debería por "use client", pero es seguro)
    if (typeof window === "undefined") return;

    const inIframe = window.parent !== window;
    if (!inIframe) return;

    const send = (payload: unknown) => window.parent.postMessage(payload, "*");

    const onError = (e: ErrorEvent) =>
      send({
        type: "ERROR_CAPTURED",
        error: {
          message: e.message,
          stack: (e as any).error?.stack,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          source: "window.onerror",
        },
        timestamp: Date.now(),
      });

    const onReject = (e: PromiseRejectionEvent) =>
      send({
        type: "ERROR_CAPTURED",
        error: {
          message: (e as any).reason?.message ?? String((e as any).reason),
          stack: (e as any).reason?.stack,
          source: "unhandledrejection",
        },
        timestamp: Date.now(),
      });

    const pollOverlay = () => {
      const overlay = document.querySelector("[data-nextjs-dialog-overlay]");
      const node =
        overlay?.querySelector(
          "h1, h2, .error-message, [data-nextjs-dialog-body]"
        ) ?? null;
      const txt = (node as HTMLElement | null)?.textContent ?? (node as HTMLElement | null)?.innerHTML ?? "";
      if (txt && txt !== lastOverlayMsg.current) {
        lastOverlayMsg.current = txt;
        send({
          type: "ERROR_CAPTURED",
          error: { message: txt, source: "nextjs-dev-overlay" },
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    if (!pollRef.current) {
      pollRef.current = setInterval(pollOverlay, 1000);
    }

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  /* ─ postMessage extra cuando es la global-error route ─ */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!error) return;

    window.parent.postMessage(
      {
        type: "global-error-reset",
        error: {
          message: error.message,
          stack: error.stack,
          digest: error.digest,
          name: error.name,
        },
        timestamp: Date.now(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
      "*"
    );
  }, [error]);

  /* ─ páginas ordinarias no muestran nada ─ */
  if (!error) return null;

  /* ─ UI de global-error ─ */
  // Nota: renderizar <html><body> en un Client Component es válido solo si este
  // archivo se usa como "global-error" (fuera del árbol normal). Si no, cambiar a un div.
  return (
    <html>
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-destructive">
              Something went wrong!
            </h1>
            <p className="text-muted-foreground">
              An unexpected error occurred. Please try again fixing with Orchids
            </p>
          </div>

          {process.env.NODE_ENV === "development" && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Error details
              </summary>
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                {error.message}
                {error.stack && (
                  <div className="mt-2 text-muted-foreground">{error.stack}</div>
                )}
                {error.digest && (
                  <div className="mt-2 text-muted-foreground">
                    Digest: {error.digest}
                  </div>
                )}
              </pre>
            </details>
          )}
        </div>
      </body>
    </html>
  );
}
