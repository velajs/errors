# @velajs/errors

Unified error layer for Vela: a single branded `VelaError` whose every field is an own-enumerable property (so it rides any wire codec, `structuredClone`, or Durable Object RPC prop-copy unchanged), composable error catalogs that default status/hint/docs from a code, and the one `toErrorBody` seam that redacts internal errors before they reach the wire. Zero runtime dependencies, edge-runtime safe.
