# Extension ID (manifest `key`)

Chrome derives an extension's ID from the `key` field in its manifest
(`ID = SHA-256(key)` mapped to a–p). This fork can pin that ID so the tools
website can reliably target the extension via its `SIDEKICK_ID` — but the
**Chrome Web Store forbids the `key` field** (it assigns and owns the ID). You
therefore build differently depending on how you distribute.

## Two build modes

| Goal | Command | `key` in manifest? | Resulting ID |
|---|---|---|---|
| Publish to the Chrome Web Store | `npm run build` | **No** | Assigned by the store on first upload |
| Unpacked / self-hosted `.crx` | `SIDEKICK_PIN_ID=true npm run build` | **Yes** (from `CRX_KEY` in `build/build.js`) | Deterministic, shared across all builds |

- If you leave `key` in a package uploaded to the store, it is rejected with
  *"key field is not allowed in manifest."* So the default `npm run build` omits it.
- The pinned `key` is a **public** key (safe to commit). Its private half is only
  needed to sign a self-hosted `.crx`; unpacked loads don't need it.

## Matching `SIDEKICK_ID`

The tools website (`utils/sidekick.js`) pings a fixed `SIDEKICK_ID`. It must equal
the ID of whichever build you actually run:

- **Unpacked, pinned (`SIDEKICK_PIN_ID=true`):** the ID is the deterministic one
  derived from `CRX_KEY`. Set `SIDEKICK_ID` to that value.
- **Unpacked, no `key`:** Chrome falls back to an unstable, path-derived ID
  (differs per machine/folder) — avoid relying on it; use the pinned build instead.
- **Published to the store:** the ID is the **store-assigned** one (not the pinned
  value, not the path-derived one). After publishing, copy the ID from the Web
  Store dashboard and set `SIDEKICK_ID` to it.

## Using one ID for both local dev and the published extension

After the store item exists, copy **the store item's public key** from the
dashboard and paste it into `CRX_KEY` in `build/build.js`, replacing the
self-minted key. Then:

- `SIDEKICK_PIN_ID=true npm run build` → unpacked build gets the **store** ID.
- `npm run build` → uploaded build publishes under the **same** store ID.
- A single `SIDEKICK_ID` (the store's) then works for both.

## Notes

- One `key`/ID is shared across all customer deployments; deployments are told
  apart by their **display name**, not their ID. A single Chrome profile can only
  run one extension per ID at a time.
- Regenerating `CRX_KEY` changes the ID for every deployment and requires updating
  every tools website's `SIDEKICK_ID`.

See also: [domain-injection.md](domain-injection.md).
