import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";

const params = z.object({ ano: z.string().regex(/^\d{4}$/) });

export const Route = createFileRoute("/arquivo/$ano")({
  parseParams: (p) => params.parse(p),
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/arquivo", search: { q: "", temas: [], ano: Number(params.ano), mes: null, ordem: "desc", page: 1 } as any });
  },
  component: () => null,
});
