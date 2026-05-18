# WHAT THIS IS
## GBrain — Production AI Knowledge Brain

**Author:** Garry Tan (@garrytan) — President and CEO of Y Combinator
**Version:** 0.35.4.0 | **License:** MIT | **Status:** Production

---

GBrain gives AI agents persistent, searchable, self-wiring memory.

Postgres-native hybrid RAG (vector + keyword + graph). 34 skills.
P@5 49.1% · R@5 97.9% on a 240-page benchmark corpus.
3,700+ tests. Built in 12 days. Running in production.

**Start here:**
- `AGENTS.md` — if you're an AI agent
- `CLAUDE.md` — if you're Claude (architecture, trust boundary, privacy rules)
- `README.md` — full overview, benchmarks, install
- `CONTRIBUTING.md` — architecture and dev setup
- `STRUCTURE.md` — complete folder map (this review)
- `KNOWN_GAPS.md` — honest open items (this review)
- `JOURNAL.md` — AI agent handoff log (this review)

**30-second install:**
```bash
git clone https://github.com/garrytan/gbrain.git
cd gbrain && bun install && bun link && gbrain init
```

Or paste into your agent:
```
Retrieve and follow: https://raw.githubusercontent.com/garrytan/gbrain/master/INSTALL_FOR_AGENTS.md
```

**Privacy rule:** Always read `CLAUDE.md`'s privacy section before writing any
docs, changelog entries, PR bodies, or examples. Real names are not permitted
in public artifacts. Use generic placeholders.

---

*GBrain v0.35.4.0 — MIT — Garry Tan*
