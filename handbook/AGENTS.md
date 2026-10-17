# handbook/ — Beacon Documentation Site

SvelteKit 3 static site (adapter-static, `fallback: '404.html'`), deployed to GitHub Pages at `/beacon`. Separate npm project: run commands inside `handbook/`. `README.md` here is the unedited `sv` template.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (base path empty) |
| `npm run build` | Static build to `build/` (CI sets `BASE_PATH=/beacon`) |
| `npm run check` | `svelte-check` + service-worker `tsc` |

## Key Patterns

- **Pages are Markdown**: `src/routes/v{version}/{page}/+page.md`, compiled by mdsvex with `src/lib/components/DocLayout.svelte` as layout, Shiki highlighting (`src/lib/shiki-beacon-theme.json`), `rehype-slug` anchors
- **Runes**: `.svelte` files compile with runes on, `.md` files with runes off (`vite.config.ts` `dynamicCompileOptions`)
- **Versions are frozen route trees**: one directory per release (`v1.0.0` … `v2001.0.0`). Edit the newest one for current docs; older trees are historical
- **`/latest`** has no copy of the docs. `src/routes/latest/[page=slug]/+page.ts` globs `../../v2001.0.0/*/+page.md`; that glob must match `latestSource` in `src/lib/versions.ts`
- **Adding a version** touches: a new `src/routes/v{version}/` tree, `versions` + `latestSource` in `src/lib/versions.ts`, `versionConfigs` in `src/lib/navigation.ts` (sidebar sections via `has*` flags), and the `/latest` glob
- **LLM endpoints**: `[version]/llms.txt`, `[version]/llms-full.txt`, `[version]/[page].md` are `+server.ts` routes built from `src/lib/llm-docs.ts` (root `llms.txt` has its own `+server.ts`); it strips `<script>` blocks and rewrites `<Version />` / `<VersionLink>` in page source
- **Import alias**: `#lib/*` → `./src/lib/*` (`package.json` `imports`)
- **Deploy**: `.github/workflows/deploy-handbook.yml` on pushes to `trunk` that touch `handbook/**`

<!-- BEACON-START -->[Handbook Index]|root: ./handbook|IMPORTANT: Docs for a new release go in a new src/routes/v{version}/ tree; keep versions.ts, navigation.ts and the /latest glob in sync|src/routes:{v*/,latest/,[version]/,*.svelte,*.ts}|src/lib:{*.ts,shiki-beacon-theme.json}|src/lib/components:{*.svelte}|src:{app.html,app.css,params.ts,service-worker.ts}|static:{favicon.svg,fonts/}|.:{package.json,vite.config.ts,tsconfig.json}<!-- BEACON-END -->
