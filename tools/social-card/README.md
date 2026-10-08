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
| `icon` | path | SVG or PNG, relative to the content file |
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

An open spellbook on leather: owner, name with a red opening (its first letter, or
`name_accent` if the name starts with it), headline, description, an optional
`epigraph` quotation with its `epigraph_source`, and footer on the left page; the chips as numbered chapters on the right, under
`chips_title` (default "Spells within"). The icon is drawn as a gold seal behind the
right page's lower corner; it is used as a mask, so any single-colour SVG or PNG works.

Footer styles: `muted` (default), `fg`, `string`, `success`.

`[style]` keys: `leather`, `leather-edge`, `cover`, `parchment`, `parchment-edge`,
`page-stack`, `ink`, `ink-faded`, `rubric`, `gold`, `sigil-size`.

### Writing a layout

A layout is a [Jinja](https://jinja.palletsprojects.com/) template rendered at
1280×640. Besides the content fields it receives:

- `style_vars`: put it in `<html style="{{ style_vars }}">` so `[style]` overrides
  the defaults the layout declares on `:root`.
- `fonts`: URL of `fonts/`, for `@font-face`.
- `icon`: already a URL.

If the layout needs work after the fonts load, such as fitting text, assign a promise
to `window.cardReady`; the screenshot waits for it.

## Fonts

`fonts/` bundles Noto Sans ([OFL](fonts/NotoSans-OFL.txt)), Cinzel
([OFL](fonts/Cinzel-OFL.txt)), EB Garamond Italic ([OFL](fonts/EBGaramond-OFL.txt))
and DejaVu Sans Mono ([licence](fonts/DejaVu-LICENSE.txt)) so cards render the same on
every machine.
