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

`HLX_DOMAIN_PREFIX` is not exported by the `.env` file — it is computed by the build and test tooling.

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
