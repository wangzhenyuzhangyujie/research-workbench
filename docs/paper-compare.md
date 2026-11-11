# Paper comparison guide

## Workspace

`scripts/init_demo.py` copies original examples into `workspace/`. It refuses
to overwrite a non-empty directory. Set `PAPER_WORKSPACE` to an absolute path
to keep a separate project; use the same variable for init, build and serve.

```text
workspace/
  draft/content.tex          # your English manuscript
  draft/main.tex             # your TeX template
  reference/content.tex      # reference material you may use
  reference/main.tex
  translations/draft.zh.json
  translations/reference.zh.json
  sources/alignment.json     # optional paragraph mapping
  figures/                   # your figures, not bundled research data
  annotations/               # saved comments and readable export
  web/                       # generated reading page
  qa/                        # build reports and compilation logs
```

The public examples use the standard `article` class. Bring your own conference
template if needed. The reference examples are original illustrative prose,
not a redistribution of another author's paper.

## Paragraph markers

Only marked blocks enter the generated HTML and PDF body:

```tex
%WB motivation|p|intro
Readers need to understand the problem before evaluating our approach.
%WBEND
```

The three fields are `stable-id|kind|alignment-key`. Use unique IDs across both
papers, for example `ref-motivation` on the reference side. The builder rejects
duplicate IDs within one paper. Preserve IDs during edits so annotations stay
anchored. Useful kinds are `title`, `abstract`, `section`, `subsection`, `p`,
`equation`, `figure`, `table`, `reference` and `bibliography`.

The builder generates `title.tex` and `body.tex`; include those in `main.tex`.
Do not edit generated files directly. Pandoc converts prose and equations to
HTML. The small table renderer supports common `tabular`, `tabularx`,
`multicolumn` and `multirow` forms, not all LaTeX packages. Figures referenced
as PDF need a same-stem SVG or PNG for the HTML view. TeX/Pandoc input and cached
HTML are trusted author-controlled content; do not load untrusted TeX projects.

## Alignment

Without explicit mapping, a right-hand paragraph links to the first reference
paragraph with the same alignment key. For precise mapping, create:

```json
{
  "motivation": {
    "target": "ref-motivation",
    "role": "State the practical problem before introducing the method."
  }
}
```

Save this as `sources/alignment.json`. The ↔ button follows the mapping.
Navigation uses common keys such as `intro`, `method`, `experiments`, `analysis`,
`related`, `conclusion`, `appendix` and `title`.

## Reviewed translations

Each translation cache entry contains `sha256`, `zh_html`, `status` and `source`.
The hash is SHA-256 of the exact stripped English block body encoded in UTF-8.
Use `parse()` in `scripts/build.py` when computing it. After reviewing a
translation, set `status` to `reviewed` and record the correct hash.

If English changes, the builder replaces that block's stale cache entry with
an English fallback labeled **译文待更新**. Keep versioned backups of your workspace
if you want to retrieve earlier translations; the translation cache itself is
not a version history. Annotation records independently retain the source text
present when the comment was saved.

Optional local translation uses CTranslate2 and SentencePiece. Install them in
your environment and set `TRANSLATION_MODEL` to an existing compatible OPUS-MT
English-to-Chinese model directory containing `model/` and `sentencepiece.model`.
No model is bundled or downloaded automatically. Machine output is marked for
review; it is never labeled as a reviewed translation automatically.

## Builds and annotations

```bash
python scripts/build.py          # HTML only
python scripts/build.py --pdf    # also compile both main.tex files
python scripts/serve.py 8767     # initial build, then watch and serve
python scripts/serve.py 8767 --pdf
```

`PANDOC` and `LATEXMK` can override executable paths. The watcher debounces file
changes and keeps an edit made during a build pending for another build. The
page waits for unsaved annotation drafts before refreshing. Failed builds are
reported in `/status` and `qa/`; inspect the logs before trusting generated PDFs.

Comments are stored in `annotations/comments.json`, with an atomic previous
copy and a readable `review.md`. They survive rebuilds. Every edit includes a
revision; stale writes are rejected. Resolving records a resolution, deletion
is reversible through the API, and source changes are flagged.

The server binds to `127.0.0.1` and allows only reading artifacts through static
routes. It has no public login flow. Run one server per workspace: annotation
locking is in-process. Stop the server before manually editing comment files.
