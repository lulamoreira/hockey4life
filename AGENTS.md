<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Type search validators with `SearchSchemaInput` and the schema's input type when defaults produce required outputs; navigation must still allow omitted filters.
- Trailing-slash URLs are 301-redirected in `trailingSlashMiddleware` (src/start.ts) — preserves SEO of legacy WordPress URLs.
- Search Console data is read on demand via `src/lib/search-console.functions.ts` (gateway, property re-validated each call); AI captions via `src/lib/legenda.functions.ts` (AI Gateway Responses, server-only).
- Admin Instagram and X posts use current editor fields, share a cached Canvas feed image, and call the existing authorized caption function; X text uses twitter-text weighting, and generation never saves or publishes the article.
- Hero carousel title/summary sizes must come from `carrossel.tituloPx` (mobile) and `tituloPxLg` (desktop) rendered through `fluidPx()` in `src/lib/fluid-type.ts` — never hardcode font sizes in `MancheteCarrossel`, so the /admin/configuracoes sliders keep working.
