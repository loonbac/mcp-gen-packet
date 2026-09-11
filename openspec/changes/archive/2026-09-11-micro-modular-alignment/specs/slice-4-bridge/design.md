# Design: Slice 5 Catalogs and Server Handlers

## Status

- **status**: `designed_with_delivery_gate`
- **change**: `micro-modular-alignment`
- **scope**: `slice-5-catalogs-server; final change slice`
- **artifact_store**: `openspec`
- **review_budget**: `<400 changed lines per review unit`
- **skill_resolution**: `fallback-path`

## Executive summary

Slice 5 separates four catalog datasets from 16 one-function query files, preserves all historical catalog entry points as re-export façades, extracts typed MCP resource and tool handlers, and leaves `src/server.ts` as a bridge/server/transport composition root below 60 physical lines. S5a through S5d are independently green units planned below 400 changed lines. Aggregate delivery packaging remains subject to `ask-on-risk`; neither chaining nor `size:exception` is selected.

The complete exact-signature, data-flow, file-change, TDD, budget, rollout, risk, and archive design is authoritative at:

- [`specs/slice-5-catalogs-server/design.md`](./specs/slice-5-catalogs-server/design.md)

After S5d passes the focused suite, all 434 pre-existing tests, the augmented suite, and TypeScript build, Slice 5 is synchronized to canonical OpenSpec and `micro-modular-alignment` is archived. No Slice 6 follows.

## SDD result

- **status**: `designed_with_delivery_gate`
- **executive_summary**: Complete the final architecture slice with pure catalog data, 16 atomic queries, compatibility façades, dedicated MCP handlers, bridge injection, and a server root below 60 lines.
- **artifacts**:
  - `openspec/changes/micro-modular-alignment/proposal.md`
  - `openspec/changes/micro-modular-alignment/specs/slice-5-catalogs-server/spec.md`
  - `openspec/changes/micro-modular-alignment/specs/slice-5-catalogs-server/design.md`
  - `openspec/changes/micro-modular-alignment/design.md`
- **next_recommended**: `tasks` — plan strict RED-first S5a → S5b → S5c → S5d work, forecast each unit below 400 changed lines, then verify, synchronize, and archive.
- **risks**: Rename-detection line inflation, ordering drift, link alias deduplication, MCP registration argument reversal, SDK/Zod typing drift, test side effects, and premature archive.
- **skill_resolution**: `fallback-path`
