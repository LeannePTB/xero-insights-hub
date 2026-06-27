## Root cause

`src/routes/_authenticated/admin.security.tsx` wraps the markdown viewer in `<article className="prose prose-sm dark:prose-invert max-w-none">`, but `@tailwindcss/typography` is not installed or registered in this project. With no `prose` styles in the build, every markdown element collapses to plain `<p>` text:

- Headings lose their size/weight hierarchy
- Bullet lists render as flat paragraphs (no markers, no indent)
- The Section 1 / Technical controls tables collapse into stacked label/value lines instead of an actual `<table>` with rows and columns

That's exactly what your screenshot shows. The hub project has `@plugin "@tailwindcss/typography";` on line 3 of `src/styles.css` — this project does not.

## Fix

1. Install the plugin: `bun add -d @tailwindcss/typography`.
2. Add one line to `src/styles.css` (immediately after the existing `@import "tailwindcss" …;` block, before `@theme`, matching Tailwind v4 ordering rules and the hub setup):

   ```css
   @plugin "@tailwindcss/typography";
   ```

No other code changes needed — the route, posture card, Section 1 editor, sidebar navigation, PDF download, and bundled `?raw` markdown imports are already structured the same way as Business Hub Central. Once `prose` actually does its job, the Overview text, the "Detailed policies live in this folder" list, and the "Technical controls in place" table will render with proper headings, bullets, and a real bordered table — matching the hub.

## Verification

After the change I'll confirm the build succeeds and read the rendered HTML in the live preview to verify the `<ul>` shows markers and the `<table>` has the expected `border` / `th` / `td` layout from the typography plugin.