# Testing

Build the rebuttal app and create the paper tool's Python environment first
(see the root README). From the repository root:

```bash
apps/paper-compare/.venv/bin/python tests/api_smoke.py
```

The API test launches both applications on free local ports with temporary
databases/workspaces. It checks save conflicts, history restoration, persistence
after server restart, ready-state validation, origin/host protection, annotation
storage and source-hash invalidation. It does not modify your working papers.

Paper annotation unit tests:

```bash
cd apps/paper-compare
.venv/bin/python -m unittest discover -s scripts -p 'test_*.py'
```

Optional browser checks use the running servers at ports 3000 and 8767:

```bash
npm ci
npx playwright install chromium
npm run test:browser
```

**Run browser checks only against disposable demonstration projects.** They edit
and restore the first rebuttal draft (creating history entries), and create,
resolve and soft-delete a paper annotation. They also replace the two README
screenshots in `docs/`. `REBUTTAL_URL`, `PAPER_URL` and `CHROMIUM_PATH` override
the default endpoints or browser executable. Use `PAPER_PYTHON` to override the
Python interpreter used by the API smoke test.

## Optional GitHub Actions

`docs/github-actions-checks.yml` is an example CI workflow covering the production
build, annotation tests, PDF build and API smoke test. To enable it in your own
fork, copy it to `.github/workflows/checks.yml` and push with an account/token
allowed to write workflows. It is not enabled in this repository's initial
release.
