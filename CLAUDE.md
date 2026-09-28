# CLAUDE.md

## Stack & Conventions

**Hard constraint:** vanilla HTML, CSS, and JavaScript only — no frameworks, no build step.

## Running locally

The page loads `data/analytics.json` with `fetch()`, which browsers block on `file://`. Serve the folder instead:

```sh
python3 -m http.server
```

Then open http://localhost:8000. Regenerate the sample data with `node tools/generate-sample-data.js` (optional tooling, not a build step).
