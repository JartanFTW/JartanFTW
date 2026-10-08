# social-card

Renders a 1280×640 social preview PNG for a repository from a TOML content file
and an HTML layout. The content says what the repository is; the layout decides how
it looks, so one content file can be rendered through any layout.

## Setup

Needs [uv](https://docs.astral.sh/uv/). `card.py` declares its own dependencies
(Jinja for templates, Playwright to screenshot them), so there is no venv to make.
Once per machine, fetch the browser and, on Linux, its system libraries:

```bash
uv run --with playwright playwright install chromium
uv run --with playwright playwright install-deps chromium  # Linux; uses sudo
```

## Usage

```bash
uv run tools/social-card/card.py tools/social-card/cards/scaffold.toml
# -> tools/social-card/out/scaffold.png; -o picks another path

# Try the same content in another layout, without editing the file:
uv run tools/social-card/card.py tools/social-card/cards/memcp.toml -l constellation
# -> tools/social-card/out/memcp-constellation.png
```

Upload the PNG in the repository's **Settings → General → Social preview**.

## Content

All fields are optional except `name`; a layout uses the ones it supports and ignores
the rest. `cards/` has worked examples.

| Field | Type | Meaning |
|-------|------|---------|
| `layout` | string | A layout in `layouts/` by name, or a path to an `.html` file relative to the content file. Default `showcase` |
| `owner` | string | Account or organization |
| `name` | string | Repository name |
| `headline` | string | One-line pitch |
| `description` | string | Longer text; `\n` forces a line break |
| `chips` | list of strings | Short feature labels |
| `footer` | list of `{ text, style }` | Text segments in a row; `style` is a class the layout defines |
| `icon` | path | SVG or PNG, relative to the content file. Any `icon` key in a nested table is resolved the same way |
| `name_accent` | string | Part of `name` to highlight, in layouts that support it |
| `chips_title` | string | Heading over the chips, in layouts that show one |
| `[style]` | table | Overrides for the layout's CSS custom properties, without the `--`: `tile-from = "#1a7f37"` sets `--tile-from` |

## Layouts

### showcase

Owner and name, an icon tile on the right, headline and description, up to two rows
of three chips, and a code-styled footer, on GitHub's dark palette. The tile appears
only when there is an `icon`.

Footer styles: `muted` (default), `fg`, `string`, `success`.

`[style]` keys: `tile-from`, `tile-to`, `tile-size`, `icon-size`, `chip-font`
(`"Noto Sans"` or `'"DejaVu Sans Mono"'`), and the palette: `bg-top`, `bg-bottom`,
`fg`, `muted`, `string`, `success`, `chip-fill`, `chip-line`, `chip-dot`.

### tome

An open spellbook on leather: owner, name with its first letter (or `name_accent`)
in red, headline, description, an optional `epigraph` quotation with its
`epigraph_source`, and footer on the left page; the chips as numbered chapters on
the right, under `chips_title` (default "Spells within"). The icon is drawn as a gold seal behind the
right page's lower corner; it is used as a mask, so any single-colour SVG or PNG works.

Footer styles: `muted` (default), `fg`, `string`, `success`.

`[style]` keys: `leather`, `leather-edge`, `cover`, `parchment`, `parchment-edge`,
`page-stack`, `ink`, `ink-faded`, `rubric`, `gold`, `sigil-size`.

### recall, recall-constellation, constellation, index-cards, devices, matrix, chart, terminal, gauge

Nine layouts that share a dark text column on the left: owner, name with
`name_accent` in a gradient, headline, description and footer. Each draws something
different on the right.

- **recall** shows a conversation in which an assistant uses a tool, for a project
  whose value is what happens across sessions:

  ```toml
  [[sessions]]
  label = "Mon · session 1"
  turns = [
    { user = "We deploy with uv, never pip." },
    { tool = "add_memory", result = "✓ stored", style = "success" },
  ]
  ```

  A turn is `user`, `ai` or `tool` (with an optional `result` and its `style`).
  `user` and `ai` take a string or footer-style segments, where `style = "code"` sets
  monospace.
- **recall-constellation** is recall with a faint constellation drawn inside the chat
  panel.
- **constellation** draws `nodes` (or, without them, `chips`) as labelled points
  linked to a hub that holds the icon, over a starfield.
- **index-cards** fans up to three `cards`, each `{ label, text }`, as ruled cards.
- **devices** shows up to three `devices` (`{ name, icon }`) as windows, each listing
  `tree_root` and the `tree` items with a check, linked through a hub that holds the
  icon.
- **matrix** sets the same `tree` against up to four `devices`, a check in every
  cell.
- **chart** plots one series from a `[chart]` table: `points` as `[x, y]` pairs,
  `x_ticks`, `y_ticks`, `y_max`, `y_suffix`, `x_label`, `y_label` and `log_x`. An
  optional `zone = { from, label }` shades everything past `from` in the critical
  colour, and `marker = { at, label, value }` draws a dashed line with its value.
- **terminal** shows a `[run]`: a `command`, `steps` (`{ name, result, failed }`) and
  an outcome box (`outcome_label`, `outcome` and `outcome_detail`, each a string or
  footer-style segments).
- **gauge** draws a `[gauge]` dial from `min` (default 0) to `max`, with `tick_step`,
  a needle at `value` (shown as `value_text` if given), a `caption`, and `bands`, each
  `{ to, style, label }` with `style` one of `good`, `warning`, `critical`.

The two constellation layouts scatter their stars from a fixed `seed` (a whole
number), so a render is repeatable; set it in the content file to try another
pattern.

Footer styles: `muted` (default), `fg`, `accent-text`, `success`.

`[style]` keys: `bg`, `glow`, `fg`, `muted`, `line`, `accent-from`, `accent-to`,
`success`; constellation adds `hub-size`, `link`, `node-glow`; recall-constellation
adds `link`, `node-glow`, `panel-fill`; devices adds `window`, `link-color`; all share `warning` and `critical` for status; index-cards adds
`card-paper`, `card-rule`, `card-ink`, `card-label`.

### Writing a layout

A layout is a [Jinja](https://jinja.palletsprojects.com/) template rendered at
1280×640. Besides the content fields it receives:

- `style_vars`: put it in `<html style="{{ style_vars }}">` so `[style]` overrides
  the defaults the layout declares on `:root`.
- `fonts`: URL of `fonts/`, for `@font-face`.
- `icon`: already a URL.

If the layout needs work after the fonts load, such as fitting text, assign a promise
to `window.cardReady`; the screenshot waits for it.

Bundled layouts stay on the template search path, so a layout kept anywhere can
`{% extends "_split.html" %}` (or any bundled layout) and override its `style`, `art`
and `script` blocks. `_macros.html` holds pieces shared between layouts: `check()`;
`glyph()`, which draws a single-colour icon in the surrounding text colour; and
`segments()`, which renders a string or a list of `{ text, style }`. In the split
layouts' scripts, `esc()` escapes text written into markup.

If a `.fit` line still overflows at the smallest size, `card.py` stops with an error
naming the text rather than writing a card with it cut off.

## Fonts

`fonts/` bundles Noto Sans ([OFL](fonts/NotoSans-OFL.txt)), Cinzel
([OFL](fonts/Cinzel-OFL.txt)), EB Garamond Italic ([OFL](fonts/EBGaramond-OFL.txt))
and DejaVu Sans Mono ([licence](fonts/DejaVu-LICENSE.txt)) so cards render the same on
every machine.
