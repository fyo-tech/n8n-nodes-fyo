# AGENTS.md — n8n-nodes-fyo

Instructions for AI coding agents working on this repository.

## Project

n8n community node package for [FYO API](https://api.fyo.com/docs) integration (grain trading, finance, AFIP — Argentina).

- Package: `n8n-nodes-fyo` v0.6.0
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

- **n8n's built-in `oAuth2Api` credential does NOT support password grant.** Confirmed by the n8n team. Supported grant types in `oAuth2Api` are only: `authorizationCode`, `clientCredentials`, `pkce`.
- The credential (`FyoApi`) is a **custom type** with `preAuthentication` — it fetches the token via POST `/token` and stores it in an `accessToken` field with `typeOptions: { expirable: true }`. n8n manages token lifecycle automatically.
- The node calls `this.helpers.httpRequestWithAuthentication.call(this, 'fyoApi', options)`. The credential's `authenticate` property injects the `Authorization: Bearer` header.
- This follows the **Metabase credential pattern** from n8n's official examples.

Do NOT add manual token caching or call `/token` from the node — the credential handles it. Do NOT attempt to refactor to `extends = ['oAuth2Api']` — it will not work for password grant.

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

- `pageSize: 1000` is hardcoded in `getMovimientos` — matches FYO API's max.
- `displayName: 'fyo'` — all lowercase per official brand guidelines.
