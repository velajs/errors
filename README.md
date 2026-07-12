# @velajs/errors

Unified error layer for Vela: a single branded `VelaError` whose every field is an own-enumerable property (so it rides any wire codec, `structuredClone`, or Durable Object RPC prop-copy unchanged), composable error catalogs that default status/hint/docs from a code, and the one `toErrorBody` seam that redacts internal errors before they reach the wire. Zero runtime dependencies, edge-runtime safe.

## Why

Across HTTP, WebSocket, live queries, and queue reporting, Vela needs one answer to two questions: *"is this error safe to show a client?"* and *"what exact JSON goes on the wire?"* This package is that answer. Every transport edge funnels through `toErrorBody`, so the redaction invariant holds identically everywhere and the wire shape is pinned by a golden fixture.

## The three redaction rules

`toErrorBody(error, options?)` returns `{ body, status, redacted }`. Whether the original message/hint/details reach the client is decided by exactly these rules:

| # | Input error | Result | `redacted` |
| - | ----------- | ------ | ---------- |
| 1 | Anything not a branded `VelaError` (plain `Error`, a foreign driver error that merely has `code`+`status`, `null`, …) | Generic title for the fallback status; original message dropped | `true` |
| 2 | A branded `VelaError` whose code is the literal `internal`, **or** whose catalog entry has `internal: true` | `code` + `status` kept; message/hint/details dropped, replaced with the generic title for that status | `true` |
| 3 | Any other branded `VelaError` — catalogued or open (unknown) code | `code`, `message`, and any `hint`/`docsUrl`/`details` echoed verbatim | `false` |

Status alone never triggers redaction: an open code with `status: 500` still echoes (rule 3) — only the literal `internal` code or an `internal: true` catalog flag redacts (rule 2). `redacted: true` is the caller's signal to log the raw error server-side; `toErrorBody` itself never logs.

The canonical wire shape (pinned by `wire-fixture.test.ts`) is:

```json
{ "error": { "code": "not_found", "message": "no such route", "hint": "Run `vela route list`." } }
```

and, redacted:

```json
{ "error": { "code": "internal", "message": "Internal Server Error" } }
```

## The brand contract

`isVelaError` is a **branded structural** guard: it requires `error instanceof Error` plus `typeof code === 'string'`, `typeof status === 'number'`, and `type === 'VelaError'`. The `type` brand is an own-enumerable property, so it survives JSON round-trips, `structuredClone`, and DO↔worker RPC prop-copy — a wire-decoded twin (`Object.assign(new Error(msg), {...decoded})`) still passes. `instanceof VelaError` is deliberately **not** load-bearing (it breaks across realms and on decoded twins), so nothing in the redaction path uses it.

The consequence for new transport edges: **construct real `VelaError`s, not shape-alikes.** A foreign error that merely carries `code` and `status` is intentionally rejected by the guard and redacted by rule 1 — that is the mechanism that stops a database driver's `internal driver detail: host=10.0.0.5` from riding the client-echo path.

## Catalog composition

A catalog maps codes to defaults (`status`, `title`, optional `hint`/`docsUrl`, and the `internal` redaction posture). `CORE_CATALOG` ships the standard HTTP-shaped codes. Compose your app's catalog onto it; duplicate codes throw at composition time.

```ts
import { CORE_CATALOG, composeCatalogs, defineErrorCatalog } from '@velajs/errors';

const appCatalog = composeCatalogs(
  CORE_CATALOG,
  defineErrorCatalog({
    order_expired: { status: 410, title: 'Order expired', hint: 'Create a new order.' },
    db_corruption: { status: 500, title: 'Storage failure', internal: true },
  }),
);
```

> **Gotcha:** a custom catalog's `title` is **not** used as the thrown error's default message. Only core codes default their message to the catalog title; a throw for a custom-catalog code defaults its message to the code string unless you pass `message`. Pass `message` explicitly when you want human-readable text (and remember rule 2 will redact it anyway for `internal: true` entries). Use `catalog.error(code, options)` to inherit the entry's `status`/`hint`/`docsUrl`.

## Usage

```ts
import { invariant, toErrorBody, VelaError } from '@velajs/errors';

// Throw a catalogued error; status/hint default from the core catalog.
throw new VelaError('not_found', { message: 'no such route', hint: 'Run `vela route list`.' });

// Internal-coded errors are rich in logs, redacted on the wire.
invariant(subscription !== undefined, 'subscription registry out of sync', { subId });

// At every transport edge, funnel through the one seam:
const { body, status, redacted } = toErrorBody(caughtError, { catalog: appCatalog });
if (redacted) logger.error(caughtError); // safe details stay server-side
return Response.json(body, { status });
```

`invariant(condition, message, data?)` narrows types (`asserts condition`) and, on failure, throws an `internal`-coded `VelaError` — always redacted by rule 2. `unreachable(value: never)` is its exhaustiveness-check companion.

## API

- `VelaError`, `VelaErrorOptions` — the one error and its constructor options.
- `isVelaError`, `VelaErrorLike` — the branded structural guard and its type.
- `toErrorBody`, `WireErrorObject`, `ErrorBodyResult`, `ToErrorBodyOptions` — the single wire-redaction seam.
- `defineErrorCatalog`, `composeCatalogs`, `Catalog`, `ErrorCatalogEntry` — catalog authoring.
- `CORE_CATALOG`, `CORE_ENTRIES`, `CoreErrorCode`, `STATUS_TO_CODE` — the core catalog and its lookups.
- `invariant`, `unreachable` — internal-coded assertion helpers.
