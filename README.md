# dpt106.github.io

[![pages-build-deployment](https://github.com/dpt106/dpt106.github.io/actions/workflows/pages/pages-build-deployment/badge.svg?branch=main)](https://github.com/dpt106/dpt106.github.io/actions/workflows/pages/pages-build-deployment)

Personal site for publishing things that are useful to me, built with [Jekyll](https://jekyllrb.com/) and published via GitHub Pages at https://dpt106.github.io/.

## Publishing a new page

1. Add a `.md` file at the repo root (or a subfolder), e.g. `some-page.md`:

   ```markdown
   ---
   layout: page
   title: "Some Page"
   permalink: /some-page/
   ---

   Page content goes here, in Markdown.
   ```

2. Add a link to it from `index.md`.
3. Commit on a branch, open a PR, merge it.
4. GitHub Pages rebuilds the site automatically (no build step to run yourself) — live within a minute or two of merging.

## Local preview (optional)

Requires Ruby + Bundler:

```
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000.
