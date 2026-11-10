import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const input = z.object({
  texto: z.string().trim().min(50, "Cole pelo menos 50 caracteres do texto.").max(40000),
  rede: z.enum(["instagram", "bluesky", "facebook", "x"]).default("instagram"),
});

const LIMITES: Record<string, string> = {
  instagram: "até 1.200 caracteres, 3 a 6 hashtags no final, incluindo #BrasilTemNHL",
  bluesky: "no máximo 280 caracteres no total, 1 ou 2 hashtags",
  facebook: "até 600 caracteres, sem excesso de hashtags (no máximo 2)",
  x: "no máximo 270 caracteres no total, 1 ou 2 hashtags",
};

/** Gera uma legenda para redes sociais a partir do texto de uma matéria (equipe editorial). */
export const gerarLegenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => input.parse(v))
  .handler(async ({ data, context }) => {
    const { data: perm } = await context.supabase.rpc("tem_permissao" as any, {
      _user_id: context.userId, _permissao: "escrever",
    });
    if (!perm) return { ok: false as const, erro: "Você não tem permissão para usar este recurso." };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, erro: "Recurso de IA não configurado." };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    let falha: unknown = null;
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      maxRetries: 0,
      system:
        "Você é editor de redes sociais do Hockey4Life, portal brasileiro de histórias de vida, superação e gentileza com o hóquei no gelo como pano de fundo. " +
        "Escreva em português do Brasil, tom humano e caloroso, sem sensacionalismo, sem inventar fatos que não estejam no texto. " +
        "Comece com uma frase de impacto, resuma a história em poucas linhas e termine com um convite para ler a matéria completa (link na bio/no post). " +
        "Responda APENAS com a legenda pronta, sem comentários nem aspas.",
      prompt: `Rede: ${data.rede} (${LIMITES[data.rede]}).\n\nTexto da matéria:\n${data.texto}`,
      onError: ({ error }) => { falha = error; },
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    try {
      const texto = (await result.text).trim();
      if (falha) throw falha;
      if (!texto) return { ok: false as const, erro: "O modelo não retornou uma legenda. Tente com outro trecho." };
      return { ok: true as const, legenda: texto };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      console.error("gerarLegenda falhou", status, e?.responseBody ?? e?.message);
      if (status === 429) return { ok: false as const, erro: "Muitas solicitações agora. Aguarde um minuto e tente de novo." };
      if (status === 402) return { ok: false as const, erro: "Os créditos de IA acabaram. Adicione créditos em Configurações → Planos e créditos." };
      if (status === 403) return { ok: false as const, erro: "O uso de IA está bloqueado para este espaço de trabalho." };
      return { ok: false as const, erro: "Não foi possível gerar a legenda agora." };
    }
  });
