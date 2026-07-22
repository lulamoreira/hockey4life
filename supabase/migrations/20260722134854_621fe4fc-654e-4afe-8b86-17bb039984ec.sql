
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS chapeu text;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_chapeu_len;
ALTER TABLE public.posts ADD CONSTRAINT posts_chapeu_len CHECK (chapeu IS NULL OR char_length(chapeu) <= 30);

UPDATE public.posts SET chapeu = 'Tour da taça' WHERE slug = 'dia-com-a-stanley-cup-atacante-do-carolina-hurricanes-para-em-barraca-de-limonada-e-leva-trofeu-para-criancas';
UPDATE public.posts SET chapeu = 'Parceirinha' WHERE slug = 'parceirinha-atacante-do-florida-panthers-mostra-treino-adoravel-com-a-filha-na-pre-temporada';
UPDATE public.posts SET chapeu = 'De volta' WHERE slug = 'goleiro-retorna-ao-florida-panthers-e-exibe-com-orgulho-e-alegria-camiseta-do-time-ao-lado-do-filho';
UPDATE public.posts SET chapeu = 'Orgulho do fã' WHERE slug = 'carolina-hurricanes-celebra-sucesso-de-haaland-torcedor-do-time-da-nhl-que-lidera-a-noruega-na-copa-do-mundo';
UPDATE public.posts SET chapeu = 'Grande amiga' WHERE slug = 'mascote-do-florida-panthers-presenteia-ariana-grande-com-camisa-brilhante-antes-de-show-da-cantora';
