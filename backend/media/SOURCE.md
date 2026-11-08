# Source provenance

Imported from the git-tracked deployed source at `/opt/l3gh-media`.

- Deployed commit: `75b00a3e4012e49e56e1b21303e89eca96174d34`
- Import date (UTC): 2026-11-08
- Method: `git archive --format=tar --prefix=backend/media/ HEAD`, extracted into a fresh ordinary clone of `https://github.com/l3gh/l3gh-site.git`.
- All 13 deployed tracked files are byte-for-byte unchanged; this provenance file is the only addition.
- No runtime or untracked files, environment credentials, media, databases, archives, virtual environment, or source Git metadata were copied. Paths mentioned in operational docs are references only.

Validation: 21 existing pytest tests passed against this imported copy using the deployed Python environment, with temporary test data and mocked OAuth. Optional Playwright regression was not run. Dependencies are pinned in `requirements.lock`; deployment units, Caddy template, backup/restore instructions, and historical deployment notes are retained. Those notes describe the source deployment as of the import date, not actions taken during import.

Security review: inspected tracked source and configuration references; checked file manifest and credential signatures (private keys, GitHub tokens, AWS access keys, credential-bearing URLs). No embedded credentials found. Secret-like literals in tests are synthetic fixtures. No `.env.example` exists in the deployed tracked source. No production environment or data was read. This is a source inspection, not a guarantee that every possible secret format can be detected.
