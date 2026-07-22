
CREATE TABLE public.importacao_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  nivel TEXT NOT NULL CHECK (nivel IN ('info','importada','atualizada','pulada','erro','fatal','imagem','lote')),
  wp_id BIGINT,
  msg TEXT NOT NULL,
  contexto JSONB
);
CREATE INDEX importacao_log_ts_idx ON public.importacao_log (ts DESC);
CREATE INDEX importacao_log_nivel_idx ON public.importacao_log (nivel);

GRANT SELECT ON public.importacao_log TO authenticated;
GRANT ALL ON public.importacao_log TO service_role;

ALTER TABLE public.importacao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe lê logs" ON public.importacao_log
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

ALTER TABLE public.importacao_estado
  ADD COLUMN IF NOT EXISTS tot_importados INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tot_atualizados INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tot_pulados INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tot_erros INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iniciado_em TIMESTAMPTZ;
