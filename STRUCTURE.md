# STRUCTURE
## GBrain — Repository Map v0.35.4.0

*Added during structural review by @LabyrinthCoder — May 2026*
*Nothing renamed or moved — this is a map of what exists*

---

## Root

```
AGENTS.md              Agent operating protocol — start here if you're an AI agent
CLAUDE.md              Claude-specific protocol (architecture, privacy rules, trust boundary)
CONTRIBUTING.md        Dev setup, project structure, test layout
INSTALL_FOR_AGENTS.md  Full 9-step agent installation walkthrough
README.md              Full overview, benchmarks, install guide
SECURITY.md            Security disclosure policy
TODOS.md               Open items — authoritative backlog (2,000+ lines, 44+ items)
CHANGELOG.md           Full version history (~975 KB)
VERSION                Current version (0.35.4.0)
llms.txt               Documentation map for LLM context loading
llms-full.txt          Full docs inlined for single-fetch LLM context (~500 KB)
gbrain.yml             GBrain config schema (storage tiering)
package.json           Bun package definition
tsconfig.json          TypeScript config
bunfig.toml            Bun configuration
docker-compose.*.yml   CI and test Docker configurations
.env.testing.example   Environment template for test runs
openclaw.plugin.json   OpenClaw plugin manifest
.gitignore             Standard exclusions
.gitleaks.toml         Secret scanning config

WHAT_THIS_IS.md        Quick orientation (added this review)
STRUCTURE.md           This file (added this review)
KNOWN_GAPS.md          Gap highlights from TODOS.md (added this review)
JOURNAL.md             AI agent handoff log (added this review)
labyrinth/             Labyrinth OS integration files (added this review)
```

---

## src/ — Core Implementation

```
src/
  cli.ts                    CLI entry point
  openclaw-context-engine.ts OpenClaw plugin surface

  commands/                 CLI-only commands
    init.ts                 Brain initialisation (PGLite or Postgres)
    upgrade.ts              Schema migration + post-upgrade hooks
    import.ts               File import pipeline
    export.ts               Brain export + restore
    sync.ts                 Source sync (git remotes, local repos)
    embed.ts                Embedding (--stale, --all)
    reindex.ts              Chunker-version bump re-index (v0.32.7+)
    migrate-engine.ts       Bidirectional PGLite↔Postgres migration
    storage.ts              Storage tiering status
    ... (40+ commands total)

  core/
    operations.ts           Contract-first operation definitions — THE FOUNDATION
                            ~47 shared ops. CLI and MCP server both generated from this.
    engine.ts               BrainEngine interface
    engine-factory.ts       Dynamic engine import ('pglite' | 'postgres')
    postgres-engine.ts      Postgres + pgvector implementation (Supabase/self-hosted)
    pglite-engine.ts        PGLite (embedded Postgres 17.5 via WASM) implementation
    pglite-schema.ts        PGLite-specific DDL
    db.ts                   Connection management + schema loader
    import-file.ts          Import pipeline (chunk + embed + tags)
    sync.ts                 Pure sync functions (manifest, filtering, slug conversion)
    migrate.ts              Migration helpers
    schema.sql              Postgres DDL
    types.ts                TypeScript types
    markdown.ts             Frontmatter parsing
    config.ts               Config file management
    storage.ts              Pluggable storage interface
    storage-config.ts       Storage tiering config loader
    disk-walk.ts            Efficient brain repo walker
    cjk.ts                  CJK detection (single source of truth v0.32.7+)
    utils.ts                Shared SQL utilities
    git-remote.ts           SSRF-hardened git invocations (v0.35.3+)
    audit-slug-fallback.ts  ISO-week-rotated slug fallback audit log
    embedding-pricing.ts    Embedding cost estimation
    post-upgrade-reembed.ts Chunker-bump cost prompt logic

    search/                 Hybrid search implementation
      vector search, keyword search, hybrid, expansion, dedup, SQL ranking

    chunkers/               3-tier chunking
      recursive.ts          Recursive character splitter
      semantic.ts           Semantic chunker
      ... (LLM chunker, utils)

    entities/               Entity extraction + typed graph links
      zero LLM calls, typed relations: attended/works_at/invested_in/founded/advises

    ai/                     Embedding + LLM gateway
    storage/                Storage backends (S3, Supabase, local)

  mcp/
    server.ts               MCP stdio server — generated from operations.ts
    types/                  MCP type definitions
```

---

## test/ — Tests (3,700+ unit tests)

**Note:** 397 unit test files sit flat at `test/` root. CI uses
`test/**/*.test.ts` (recursive glob) so reorganisation is safe, but
`scripts/select-e2e.ts` references `test/e2e/*.test.ts` specifically —
that subdirectory must stay put before any reorganisation.

```
test/                   Unit tests — bun test, no DB required
  *.test.ts             397 unit test files (flat — known structural issue)

  e2e/                  E2E tests — requires DATABASE_URL + real Postgres
    fixtures/           Miniature realistic brain corpus (16 files)
    helpers.ts          DB lifecycle, fixture import, timing
    mechanical.test.ts  All operations against real DB
    mcp.test.ts         MCP tool generation verification
    skills.test.ts      Tier 2 skill tests

  serial/               Tests that must run serially
  slow/                 Tests marked as slow
```

---

## skills/ — 34 AI Agent Skills (107 files)

```
skills/
  RESOLVER.md                   Functional area resolver (primary dispatch, 8.6 KB)
  _brain-filing-rules.md/.json  Filing rules (brain-first protocol)
  _friction-protocol.md         Friction gate protocol
  _output-rules.md              Output formatting rules

  academic-verify/              Academic source verification
  archive-crawler/              Web archive crawling
  article-enrichment/           Article metadata enrichment
  ask-user/                     User clarification protocol
  book-mirror/                  Book import and mirroring
  brain-ops/                    Core brain operations
  brain-pdf/                    PDF import
  briefing/                     Briefing generation
  citation-fixer/               Citation correction
  cold-start/                   Fresh brain bootstrap (18.9 KB)
  concept-synthesis/            Concept extraction + synthesis
  ... (22 more skills)

  conventions/                  Cross-skill conventions
    brain-first.md              Brain-first retrieval before web
    brain-routing.md            Brain/source routing decision table
    cron-via-minions.md         Cron delegation pattern
    model-routing.md            Model selection per task
    quality.md                  Quality standards
    salience-and-recency.md     Ranking signals
```

---

## docs/ — Documentation (79 files)

```
docs/
  architecture/         Core design decisions (4 files)
    brains-and-sources.md  Two-axis mental model (brain=DB, source=repo in DB)
    ...

  guides/               Setup + operational guides (35 files)
  eval/                 BrainBench methodology (2 files)
  integrations/         Embedding provider docs (6 files)
  ai-providers/         Provider-specific docs
  designs/              Design proposals + RFCs (5 files)
  ethos/                Project philosophy (2 files)
  mcp/                  MCP integration docs (7 files)
  proposals/            Feature proposals
  issues/               Issue tracking docs

  ENGINES.md            PGLite vs Postgres decision guide
  GBRAIN_RECOMMENDED_SCHEMA.md  Recommended brain schema
  GBRAIN_SKILLPACK.md   Skill pack documentation
  GBRAIN_VERIFY.md      Verification procedures
  GBRAIN_V0.md          V0 architecture reference
  UPGRADING_DOWNSTREAM_AGENTS.md  Agent upgrade guide
  eval-bench.md         Benchmark methodology
  eval-capture.md       Eval capture procedures
  eval-takes-quality.md Takes quality evaluation
  storage-tiering.md    Storage tiering guide
  contradictions.md     Contradiction handling
  embedding-migrations.md  Embedding migration guide
  progress-events.md    Progress event reference
  takes-vs-facts.md     Takes vs facts distinction
```

---

## scripts/ — Build and Verification (48 files)

```
scripts/
  check-privacy.sh        Enforces private name scrubbing (see CLAUDE.md)
  check-proposal-pii.sh   PII check on proposals
  check-test-isolation.sh Test isolation verification
  check-source-id-projection.sh  Source ID projection check
  check-*.sh              14 other lint/check scripts
  run-unit-parallel.sh    Parallel test runner (8 shards)
  run-unit-shard.sh       Single shard runner
  run-e2e.sh              E2E test runner
  select-e2e.ts           E2E test selection (references test/e2e/ directly)
  build-*.ts              Build tooling
  generate-metric-glossary.ts  Metric glossary generator
  ... (48 files total)
```

---

## Other

```
recipes/      Embedding provider recipes (24 files — 14 providers + 8 operational)
evals/        Functional-area-resolver eval harness (15 files)
admin/        Admin utilities (6 files)
templates/    Skill + config templates (4 files)
.github/      CI/CD workflows
```

---

## labyrinth/ — Labyrinth OS Integration Files (added this review)

See `LabyrinthCoder-Was-Here.md` inside this folder for full context.
These are standalone TypeScript files — zero changes to GBrain internals.
Garry Tan decides whether to adopt any of them.

```
labyrinth/
  LabyrinthCoder-Was-Here.md   What was done, what wasn't, integration proposals
  labyrinth-gbrain-hashchain.ts     SHA-256 hash chain for tamper-evident ledger (8 tests)
  labyrinth-gbrain-labeler.ts       Epistemic labels on query results (8 tests)
  labyrinth-gbrain-enforcement.ts   EnforcementMode SOFT/HARD/PAUSE (9 tests)
  labyrinth-gbrain-assumptions.ts   ACP-1 assumption tracker with AT_RISK propagation (7 tests)
```

---

*@LabyrinthCoder — structural review — May 2026*
