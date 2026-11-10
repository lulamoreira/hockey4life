import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// URLs antigas do WordPress terminavam com "/". Redireciona de forma PERMANENTE (301)
// para a versão sem barra, para o Google transferir a relevância.
const trailingSlashMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  if (url.pathname.length > 1 && url.pathname.endsWith("/") && (request.method === "GET" || request.method === "HEAD")) {
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return new Response(null, { status: 301, headers: { Location: url.pathname + url.search } });
  }
  return next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [trailingSlashMiddleware, errorMiddleware],
}));
