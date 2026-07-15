#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_seo.py — Régénère automatiquement les fichiers SEO du site :
  1. sitemap.xml  (dates lastmod tirées de l'historique git de chaque page)
  2. md/*.md      (miroirs markdown des pages publiques, pour les moteurs IA)
  3. llms.txt     (mise à jour de la ligne « Dernière mise à jour »)

Exécuté à chaque déploiement + tous les jours par GitHub Actions
(.github/workflows/deploy.yml). Aucune intervention manuelle nécessaire.

Usage : python generate_seo.py
Dépendances (miroirs uniquement) : pip install beautifulsoup4 markdownify
"""

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
BASE_URL = "https://genie-montauban.fr"
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")

# Pages indexables : (fichier, priorité, changefreq)
PAGES = [
    ("index.html",                  "1.0", "weekly"),
    ("reservation.html",            "0.9", "weekly"),
    ("tarifs.html",                 "0.9", "monthly"),
    ("activites.html",              "0.8", "weekly"),
    ("academie.html",               "0.8", "monthly"),
    ("notre-histoire.html",         "0.7", "yearly"),
    ("inscription.html",            "0.6", "monthly"),
    ("proposition-formateur.html",  "0.5", "monthly"),
    ("cgv.html",                    "0.3", "yearly"),
    ("confidentialite.html",        "0.3", "yearly"),
    ("mentions_legales.html",       "0.3", "yearly"),
    ("chikhi-fr.html",              "0.2", "yearly"),
]

# Pages avec miroir markdown dans /md/ (référencées dans llms.txt)
MIRROR_PAGES = [
    "index.html", "reservation.html", "tarifs.html",
    "activites.html", "academie.html", "notre-histoire.html",
]


def git_lastmod(filename: str) -> str:
    """Date du dernier commit touchant le fichier (honnête pour Google)."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", filename],
            cwd=ROOT, capture_output=True, text=True, timeout=30,
        ).stdout.strip()
        return out or TODAY
    except Exception:
        return TODAY


def page_url(filename: str) -> str:
    return f"{BASE_URL}/" if filename == "index.html" else f"{BASE_URL}/{filename}"


def build_sitemap() -> None:
    entries = []
    for filename, priority, changefreq in PAGES:
        if not (ROOT / filename).exists():
            print(f"  sitemap : {filename} absent, ignoré")
            continue
        entries.append(
            "  <url>\n"
            f"    <loc>{page_url(filename)}</loc>\n"
            f"    <lastmod>{git_lastmod(filename)}</lastmod>\n"
            f"    <changefreq>{changefreq}</changefreq>\n"
            f"    <priority>{priority}</priority>\n"
            "  </url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
    print(f"sitemap.xml : {len(entries)} URLs")


def refresh_llms_date() -> None:
    llms = ROOT / "llms.txt"
    if not llms.exists():
        return
    content = llms.read_text(encoding="utf-8")
    content = re.sub(
        r"Dernière mise à jour : \d{4}-\d{2}-\d{2}",
        f"Dernière mise à jour : {TODAY}",
        content,
    )
    llms.write_text(content, encoding="utf-8")
    print(f"llms.txt : date {TODAY}")


def build_mirrors() -> None:
    try:
        from bs4 import BeautifulSoup
        from markdownify import markdownify as md
    except ImportError:
        print("miroirs : beautifulsoup4/markdownify non installés — étape sautée")
        return

    strip_selectors = [
        "nav", "footer", "header", "script", "style", "noscript",
        "#cookie-banner", ".cookie-banner", "[aria-hidden='true']",
        ".modal", ".popup", ".overlay", "iframe",
    ]
    out_dir = ROOT / "md"
    out_dir.mkdir(exist_ok=True)

    for filename in MIRROR_PAGES:
        path = ROOT / filename
        if not path.exists():
            continue
        soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else path.stem
        desc_tag = soup.find("meta", attrs={"name": "description"})
        description = desc_tag["content"].strip() if desc_tag and desc_tag.get("content") else ""
        for selector in strip_selectors:
            for tag in soup.select(selector):
                tag.decompose()
        main = soup.find("main") or soup.body or soup
        content = md(str(main), heading_style="ATX", bullets="-", strip=["img"])
        content = re.sub(r"\n{3,}", "\n\n", content).strip()
        frontmatter = (
            "---\n"
            f"title: {title}\n"
            f"description: {description}\n"
            f"url: {page_url(filename)}\n"
            f"last_updated: {git_lastmod(filename)}\n"
            "source: miroir markdown — version texte pour moteurs IA\n"
            "---\n\n"
        )
        out = out_dir / (path.stem + ".md")
        out.write_text(frontmatter + content, encoding="utf-8", newline="\n")
        print(f"miroir : md/{out.name} ({len(content)} caractères)")


if __name__ == "__main__":
    build_sitemap()
    refresh_llms_date()
    build_mirrors()
