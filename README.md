# dpt106.github.io

Personal site and blog, built with [Jekyll](https://jekyllrb.com/) and published via GitHub Pages at https://dpt106.github.io/.

## Publishing a new post

1. Add a file to `_posts/` named `YYYY-MM-DD-short-title.md`, e.g. `_posts/2026-08-21-my-new-post.md`:

   ```markdown
   ---
   layout: post
   title: "My New Post"
   date: 2026-08-21 09:00:00 -0400
   ---

   Post content goes here, in Markdown.
   ```

2. Commit on a branch, open a PR, merge it.
3. GitHub Pages rebuilds the site automatically (no build step to run yourself) — live within a minute or two of merging.

## Local preview (optional)

Requires Ruby + Bundler:

```
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000.
