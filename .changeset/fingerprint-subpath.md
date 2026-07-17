---
"@velajs/errors": minor
---

Add the `@velajs/errors/fingerprint` subpath: a zero-dependency, cross-runtime error-grouping hash. `fingerprintError({ functionPath, message, code? })` returns a stable 16-hex-char digest over `functionPath` plus a normalized message bucket — `code` is metadata and never hashed, so redacted wire errors and raw server-side errors group identically. Ships `bucketMessage` (strips URLs, UUIDs, IPs, ids, paths, timestamps; ReDoS-clamped), `FINGERPRINT_VERSION` for persisted-fingerprint migrations, and a portable synchronous `sha256Hex` (content-addressing only, never a security primitive). Grouping approach inspired by @superlog/fingerprint (Apache-2.0), independently implemented.
