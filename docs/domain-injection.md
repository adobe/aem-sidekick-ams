# Domain Injection

## Purpose

The AEM Sidekick extension is built for multiple customer environments, each with its own domain (e.g. `ent-aem.page`, `gov-aem.page`). Domain strings are not committed to the repository. Instead, the correct domain is injected at build time from environment variables, producing a customer-specific extension without modifying source code between builds.

## How It Works

Source files reference domain values as `process.env.HLX_PROD_SERVER_HOST_PAGE`, `process.env.HLX_PROD_SERVER_HOST_LIVE`, and `process.env.HLX_DOMAIN_PREFIX`. These are substituted with real values at build time — before the extension is packaged — so the built output contains no `process.env` references.

The domain values come from the customer `.env` files in `ams-eds-terraform/environments/`. These must be sourced before building or running tests.

## Environment Variables

| Variable | Source | Example |
|---|---|---|
| `HLX_PROD_SERVER_HOST_PAGE` | Exported by the `.env` file | `ent-aem.page` |
| `HLX_PROD_SERVER_HOST_LIVE` | Exported by the `.env` file | `ent-aem.live` |
| `HLX_DOMAIN_PREFIX` | Derived at build time (strip `.page`) | `ent-aem` |
| `HELIX_BUCKET_SUFFIX` | Exported by the `.env` file | `eds-ca` |
| `DA_DOMAIN` | Exported by the `.env` file (optional, defaults to `da.live`) | `ssa-da.live` |

`HLX_DOMAIN_PREFIX` is not exported by the `.env` file — it is computed by the build and test tooling.

`HELIX_BUCKET_SUFFIX` identifies the customer environment. It is injected into the `{{CUSTOMER}}` placeholder in the locale files, upper-cased, so the extension name reads e.g. `AEM Sidekick - SSA - EDS-CA`. `NODE_ENV` is not used for this.

`DA_DOMAIN` is the Document Authoring domain. It is used to exclude DA from admin auth token injection and to detect DA content sources. When unset, the commercial `da.live` is used.

### `SIDEKICK_API_UPGRADE` (optional)

By default the sidekick talks to the new Admin API (`api.<HLX_PROD_SERVER_HOST_LIVE>`). The new API's `/login` only knows the upstream identity providers. Environments that sign in with another provider, such as Okta-only environments (helix-admin pinned to `HLX_ADMIN_AUTH_PROVIDER=okta`), must build with `SIDEKICK_API_UPGRADE=false`. Every admin call, including sign-in, then goes to the legacy Admin API (`admin.<HLX_PROD_SERVER_HOST_PAGE>`), which offers the environment's provider. Without it, "Sign in" redirects to Adobe IMS and fails.

```sh
source ../ams-eds-terraform/environments/afsvc.env && SIDEKICK_API_UPGRADE=false npm run build
```

Any other value, or leaving it unset, keeps the upstream behavior.

## Rules

- **No hard-coded domain strings in source.** All domain values must use the `process.env.*` references above. This applies to source files and test files.
- **Source an env file before building or testing.** Both `rollup.config.js` and `web-test-runner.config.mjs` will throw a clear error and abort if the env vars are not set.
- **One build per environment.** Each `npm run build` targets a single customer environment. The env file determines the output domain.
- **Tests use the sourced environment.** The test suite is environment-agnostic — it runs correctly against whichever env file was sourced, and assertions use `process.env.*` rather than any fixed domain value.

## Build and Test

```sh
source ../ams-eds-terraform/environments/ent-aem.env && npm run build
source ../ams-eds-terraform/environments/ent-aem.env && npm run test
```

## See Also

- [extension-id.md](extension-id.md) — pinning the extension ID (`manifest key`) for
  unpacked/self-hosted builds vs. the Chrome Web Store, and matching `SIDEKICK_ID`.
