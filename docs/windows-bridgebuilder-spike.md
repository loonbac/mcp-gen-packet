# BridgeBuilder in-process (upstream spike — UNVALIDATED)

Source: `y0konad/mcp-gemini-packet` (commit `e85adb0`).

Files brought verbatim (Windows-only, **not tested** — no Windows host available):

- `BridgeBuilder.pts` — Packet Tracer extension for direct in-process
  bridge communication (claims lower latency than HTTP polling).
- `scripts/install-bridgebuilder.ps1` — installer for the extension.
- `scripts/build-bridge-extension.mjs` — build helper for the extension.
- `scripts/packetTracerAutomation.ps1` — automation helper script.
- `run.ps1` — Windows launcher.

## Status

- NOT wired into `src/` — our bridge (`HttpBridgeServer` + `LiveBridge`,
  result circuit with `requestId` correlation) stays canonical.
- NOT covered by tests (616 automated tests are Linux-green; these
  files require Packet Tracer on Windows).

## Next step (needs Windows)

Spike: install `BridgeBuilder.pts` in Packet Tracer on Windows, measure
latency vs HTTP polling (`/next` 500ms + result circuit), then decide:
new `ProcessTransport` behind `BridgePort`, or keep HTTP as canonical.
