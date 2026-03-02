# AGENTS.md — n8n-nodes-fyo

Instructions for AI coding agents working on this repository.

## Project

n8n community node package for [FYO API](https://api.fyo.com/docs) integration (grain trading, finance, AFIP — Argentina).

- Package: `n8n-nodes-fyo` v0.5.7
- Repo: https://github.com/fyo-tech/n8n-nodes-fyo
- Node manager: npm (packageManager: npm@10.2.4, Node >=20)

## Key Files

```
credentials/FyoApi.credentials.ts   — OAuth2 Password Grant credential definition
nodes/Fyo/Fyo.node.ts               — Main node (~1260 lines), all resources and operations
nodes/Fyo/fyo.svg                   — Node icon
package.json                        — n8nNodesApiVersion: 1
```

## Build & Dev Commands

```bash
npm run build        # tsc + gulp build:icons — run after any .ts change
npm run dev          # tsc --watch
npm run lint         # eslint nodes credentials package.json
npm run lintfix      # eslint --fix
npm run format       # prettier nodes credentials --write
```

Always run `npm run build` after editing `.ts` files to verify the TypeScript compiles cleanly before committing.

## Architecture

### Authentication — CRITICAL CONSTRAINT

The FYO API uses **OAuth2 Resource Owner Password Credentials Grant (Password Grant)**. This is a hard constraint:

- **n8n's built-in `oAuth2Api` credential does NOT support password grant.** This was confirmed by the n8n team. Supported grant types in `oAuth2Api` are only: `authorizationCode`, `clientCredentials`, `pkce`.
- Therefore `httpRequestWithAuthentication()` cannot be used with an `extends = ['oAuth2Api']` credential for this API.
- The correct approach is the current one: a **custom credential type** (`FyoApi`) that captures `clientId`, `username`, `password`, `scope`, `environment`.
- Token fetching is handled manually in `Fyo.node.ts` via `getAccessToken()`, which POSTs to `/token` and caches the result in a module-level `Map` with expiry tracking (60s buffer).

Do NOT attempt to refactor this to `extends = ['oAuth2Api']` — it will not work for password grant.

### Resources & Operations

| Resource  | Operations |
|-----------|-----------|
| `granos`  | getContratos, getLiquidaciones, getFacturas, getAplicaciones, getFijaciones, getDescargas, getRetenciones |
| `finanzas`| getTiposComprobante (GET), getDetallesComprobante, getMovimientos |
| `afip`    | getCartaPorte |

### Environments

- Production: `https://api.fyo.com`
- Demo: `https://demoapi.fyo.com`
- Custom: user-defined URL

`getBaseUrl(credentials)` in `Fyo.node.ts` centralizes this logic. Always use it — never hardcode URLs.

### API Call Pattern

- All operations except `getTiposComprobante` use POST with a JSON body.
- `getTiposComprobante` uses GET with no body.
- All responses follow: `[{ status: {...}, metadata: {...}, data: [...] }]`
- The node extracts `response[0].data` as the output items.

### Validation Helpers (top of Fyo.node.ts)

- `formatDateForApi(dateValue)` — converts any date to `YYYY-MM-DD`
- `validateDate(dateString, fieldName)` — validates existence + no future dates
- `validateDateRange(dateFrom, dateTo)` — max 31-day range
- `validateRequiredNumber(value, fieldName)` — must be > 0

## Code Style

- TypeScript strict mode
- n8n ESLint plugin: `eslint-plugin-n8n-nodes-base`
- No external runtime dependencies (only `n8n-workflow` as peer dep)
- All string parameters cast with `as string`, numbers with `as number`
- Each operation group uses its own `searchType` parameter (e.g. `searchTypeContratos`) due to n8n property display limitations — do not consolidate these

## Known Limitations / Design Decisions

- `tokenCache` is a module-level `Map` — it persists across executions within the same process. Cache key is `baseUrl:clientId:username` to avoid cross-credential contamination.
- `pageSize: 1000` is hardcoded in `getMovimientos` — matches FYO API's max.
- `displayName: 'FyO'` uses capital O per brand guidelines.
