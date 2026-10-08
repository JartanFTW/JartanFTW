#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["jinja2>=3.1", "playwright>=1.55"]
# ///
"""Render a social preview card from a TOML content file and an HTML layout.

Usage: card.py CONTENT.toml [-l LAYOUT] [-o OUT.png]
"""

import argparse
import re
import tempfile
import tomllib
from pathlib import Path

import jinja2
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
WIDTH, HEIGHT = 1280, 640  # GitHub's recommended social preview size
CSS_NAME = re.compile(r"[a-z][a-z0-9-]*")
# Layouts shrink .fit lines to fit; one that still overflows would be cut off.
OVERFLOWING = """() => [...document.querySelectorAll(".fit")]
    .filter((el) => el.scrollWidth > el.clientWidth)
    .map((el) => el.textContent.trim())"""


def layout_path(layout, content_dir):
    """A bare name picks a bundled layout; a .html path is relative to the content file."""
    if layout.endswith(".html"):
        return (content_dir / layout).resolve()
    return HERE / "layouts" / f"{layout}.html"


def style_vars(style):
    """Turn the [style] table into CSS custom properties for the <html style> attribute."""
    for name in style:
        if not CSS_NAME.fullmatch(name):
            raise SystemExit(f"[style] key {name!r} is not a valid CSS custom property name")
    return "; ".join(f"--{name}: {value}" for name, value in style.items())


def resolve_icons(value, base):
    """Turn every `icon` path, at any depth, into a file URL relative to the content file."""
    if isinstance(value, dict):
        return {
            key: (base / item).resolve().as_uri()
            if key == "icon" and isinstance(item, str)
            else resolve_icons(item, base)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [resolve_icons(item, base) for item in value]
    return value


def render_html(content_file, layout_override=None):
    content = tomllib.loads(content_file.read_text())
    content_dir = content_file.parent
    layout = layout_path(content.pop("layout", "showcase"), content_dir)
    if layout_override:
        layout = layout_path(layout_override, Path.cwd())
    if not layout.is_file():
        raise SystemExit(f"layout not found: {layout}")

    content = resolve_icons(content, content_dir)
    content["style_vars"] = style_vars(content.pop("style", {}))
    content["fonts"] = (HERE / "fonts").as_uri()

    # The bundled layouts stay on the search path so a custom layout can extend their bases.
    loader = jinja2.FileSystemLoader([layout.parent, HERE / "layouts"])
    env = jinja2.Environment(loader=loader, autoescape=True)
    return env.get_template(layout.name).render(content)


def screenshot(html, out):
    # Loaded from a file:// page so the layout can reach local fonts and icons.
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        page_file = Path(tmp) / "card.html"
        page_file.write_text(html)
        # CSS masks are fetched with CORS, which Chromium refuses between file:// URLs.
        browser = p.chromium.launch(args=["--allow-file-access-from-files"])
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        page.goto(page_file.as_uri())
        page.evaluate("async () => { await document.fonts.ready; await window.cardReady; }")
        overflowing = page.evaluate(OVERFLOWING)
        if not overflowing:
            page.screenshot(path=out)
        browser.close()
    if overflowing:
        lines = "\n".join(f"  {text!r}" for text in overflowing)
        raise SystemExit(f"text too long to fit, even at the smallest size:\n{lines}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("content", type=Path, help="TOML content file")
    parser.add_argument("-l", "--layout", help="layout to use instead of the content file's")
    parser.add_argument("-o", "--out", type=Path, help="PNG path (default: out/<content>.png)")
    args = parser.parse_args()

    suffix = f"-{Path(args.layout).stem}" if args.layout else ""
    out = args.out or HERE / "out" / f"{args.content.stem}{suffix}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    screenshot(render_html(args.content.resolve(), args.layout), out)
    print(out)


if __name__ == "__main__":
    main()
