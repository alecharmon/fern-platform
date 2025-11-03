import re
from typing import Any
from urllib.parse import urlparse

from bs4 import (
    BeautifulSoup,
    Comment,
)
from markdownify import markdownify as md


class ContentExtractor:
    CODE_LANGUAGES = [
        "python",
        "javascript",
        "java",
        "bash",
        "shell",
        "sql",
        "json",
        "yaml",
        "xml",
        "html",
        "css",
        "typescript",
        "go",
        "rust",
        "ruby",
        "php",
        "c",
        "cpp",
        "csharp",
    ]

    NOISE_SELECTORS = [
        "nav",
        "header",
        "footer",
        "aside",
        ".sidebar",
        ".navigation",
        ".nav",
        ".menu",
        ".navbar",
        ".breadcrumb",
        ".breadcrumbs",
        '[role="navigation"]',
        '[role="banner"]',
        '[role="contentinfo"]',
        ".toc",
        ".table-of-contents",
        "#toc",
        "#table-of-contents",
        ".edit-page",
        ".edit-link",
        ".github-link",
        ".page-edit",
        ".feedback",
        ".rating",
        ".social-share",
        ".share-buttons",
        ".advertisement",
        ".ad",
        ".ads",
        ".banner-ad",
        "script",
        "style",
        "noscript",
        "iframe",
        ".cookie-banner",
        ".popup",
        ".modal",
        ".overlay",
        ".newsletter-signup",
        ".subscription-form",
        ".search",
        ".search-box",
        ".filter",
        ".sort",
        ".print-only",
        ".no-web",
    ]

    NOISE_ATTRIBUTES = [
        ("role", "navigation"),
        ("role", "banner"),
        ("role", "contentinfo"),
        ("aria-hidden", "true"),
        ("hidden", ""),
        ("style", re.compile(r"display:\s*none", re.I)),
    ]

    def extract_content(self, html: str, url: str) -> dict[str, Any]:
        soup = BeautifulSoup(html, "html.parser")
        title = self._extract_title(soup)
        metadata = self._extract_metadata(soup, url)
        self._remove_noise(soup)
        content_root = soup.find("body") or soup
        markdown_content = self._html_to_markdown(content_root)
        markdown_content = self._clean_markdown(markdown_content)

        return {"title": title, "markdown_content": markdown_content, "metadata": metadata}

    def _extract_title(self, soup: BeautifulSoup) -> str:
        title_tag = soup.find("title")
        if title_tag and title_tag.text.strip():
            title = title_tag.text.strip()
            title = re.split(r"\s*[|\-–—]\s*", title)[0]
            return title.strip()

        h1 = soup.find("h1")
        if h1:
            return h1.get_text(strip=True)

        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return og_title["content"]

        return "Untitled"

    def _remove_noise(self, soup: BeautifulSoup) -> None:
        for selector in self.NOISE_SELECTORS:
            elements = soup.select(selector)
            for element in elements:
                if element and element.parent:
                    element.decompose()

        for attr_name, attr_value in self.NOISE_ATTRIBUTES:
            if isinstance(attr_value, re.Pattern):
                elements = [el for el in soup.find_all() if hasattr(el, "get")]
                for element in elements:
                    try:
                        attr = element.get(attr_name)
                        if attr and attr_value.search(str(attr)):
                            if element.parent:
                                element.decompose()
                    except (AttributeError, TypeError):
                        continue
            else:
                elements = soup.find_all(attrs={attr_name: attr_value})
                for element in elements:
                    if element and element.parent:
                        element.decompose()

        comments = soup.find_all(string=lambda text: isinstance(text, Comment))
        for comment in comments:
            try:
                comment.extract()
            except (AttributeError, ValueError):
                continue

    def _html_to_markdown(self, soup: BeautifulSoup) -> str:
        markdown = md(
            str(soup),
            heading_style="ATX",
            bullets="-",
            code_language_callback=self._extract_code_language,
            strip=["a"],
        )

        return markdown

    def _extract_code_language(self, element: Any) -> str:
        classes = element.get("class", [])
        for cls in classes:
            if cls.startswith("language-"):
                return cls.replace("language-", "")
            elif cls.startswith("lang-"):
                return cls.replace("lang-", "")
            elif cls in self.CODE_LANGUAGES:
                return cls
        return ""

    def _clean_markdown(self, markdown: str) -> str:
        import unicodedata

        markdown = unicodedata.normalize("NFKD", markdown)

        replacements = {
            "\u00a0": " ",
            "\u2018": "'",
            "\u2019": "'",
            "\u201c": '"',
            "\u201d": '"',
            "\u2013": "-",
            "\u2014": "-",
            "\u2026": "...",
            "\u200b": "",
            "\ufeff": "",
        }

        for old, new in replacements.items():
            markdown = markdown.replace(old, new)

        markdown = re.sub(r"\n{3,}", "\n\n", markdown)
        markdown = markdown.strip()
        markdown = markdown.replace("\\_", "_")
        markdown = markdown.replace("\\*", "*")
        markdown = re.sub(r"\[\]\(\)", "", markdown)

        return markdown

    def _extract_metadata(self, soup: BeautifulSoup, url: str) -> dict[str, str | list[str]]:
        metadata: dict[str, str | list[str]] = {"url": url}

        description = soup.find("meta", attrs={"name": "description"})
        if description and description.get("content"):
            metadata["description"] = description["content"]

        og_description = soup.find("meta", property="og:description")
        if og_description and og_description.get("content") and "description" not in metadata:
            metadata["description"] = og_description["content"]

        keywords = soup.find("meta", attrs={"name": "keywords"})
        if keywords and keywords.get("content"):
            metadata["keywords"] = keywords["content"]

        canonical = soup.find("link", rel="canonical")
        if canonical and canonical.get("href"):
            metadata["canonical_url"] = canonical["href"]

        path_parts = [p for p in urlparse(url).path.split("/") if p]
        if path_parts:
            metadata["url_path"] = path_parts

        return metadata
