#!/usr/bin/env python3
"""
generate_mirrors.py — Génère des markdown mirrors pour chaque page HTML de docs/
Usage : python generate_mirrors.py
"""

from pathlib import Path
from datetime import datetime, timezone
from bs4 import BeautifulSoup
from markdownify import markdownify as md
import re

DOCS_DIR = Path(__file__).parent / "docs"
BASE_URL = "https://www.genie-montauban.fr"

# Pages publiques à traiter (on exclut admin)
EXCLUDE = {"admin.html"}

# Sélecteurs à supprimer avant conversion
STRIP_SELECTORS = [
    "nav", "footer", "header",
    "#cookie-banner", ".cookie-banner",
    "#main-nav", ".nav",
    "script", "style", "noscript",
    "[aria-hidden='true']",
    ".modal", ".popup", ".overlay",
    "iframe",
]


def get_meta(soup, name):
    tag = soup.find("meta", attrs={"name": name}) or soup.find("meta", attrs={"property": f"og:{name}"})
    return tag["content"].strip() if tag and tag.get("content") else ""


def html_to_markdown(html_path: Path) -> str:
    html = html_path.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")

    # Métadonnées
    title = soup.title.string.strip() if soup.title else html_path.stem
    description = get_meta(soup, "description")
    canonical = soup.find("link", rel="canonical")
    url = canonical["href"] if canonical else f"{BASE_URL}/{html_path.name}"
    last_updated = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Supprimer les éléments indésirables
    for selector in STRIP_SELECTORS:
        for tag in soup.select(selector):
            tag.decompose()

    # Garder uniquement le contenu principal
    main = soup.find("main") or soup.find(id="main-content") or soup.body
    if not main:
        main = soup

    # Convertir en markdown
    content = md(
        str(main),
        heading_style="ATX",
        bullets="-",
        strip=["a", "img"],  # on garde les liens mais on nettoie les images inline
    )

    # Nettoyer les lignes vides excessives
    content = re.sub(r'\n{3,}', '\n\n', content).strip()

    # Frontmatter
    frontmatter = f"""---
title: {title}
description: {description}
url: {url}
last_updated: {last_updated}
source: markdown mirror — version texte propre pour IA
---

"""
    return frontmatter + content


def main():
    html_files = [f for f in DOCS_DIR.glob("*.html") if f.name not in EXCLUDE]
    generated = []

    for html_file in sorted(html_files):
        out_path = html_file.with_suffix(".md")
        try:
            content = html_to_markdown(html_file)
            out_path.write_text(content, encoding="utf-8")
            generated.append(out_path)
            print(f"OK {html_file.name} -> {out_path.name} ({len(content)} chars)")
        except Exception as e:
            print(f"FAIL {html_file.name} : {e}")

    print(f"\n{len(generated)} fichiers générés dans {DOCS_DIR}")
    return generated


if __name__ == "__main__":
    main()
