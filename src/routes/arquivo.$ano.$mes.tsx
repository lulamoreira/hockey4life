import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const params = z.object({
  ano: z.string().regex(/^\d{4}$/),
  mes: z.string().regex(/^\d{1,2}$/),
});

export const Route = createFileRoute("/arquivo/$ano/$mes")({
  parseParams: (p) => params.parse(p),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/arquivo",
      search: { q: "", temas: [], ano: Number(params.ano), mes: Number(params.mes), ordem: "desc", page: 1 } as any,
    });
  },
  component: () => null,
});
