import pytest
from bs4 import (
    BeautifulSoup,
    Comment,
)

from fai.utils.website.extractor import ContentExtractor


class TestContentExtractor:
    @pytest.fixture
    def extractor(self) -> ContentExtractor:
        return ContentExtractor()

    @pytest.fixture
    def sample_html_with_title(self) -> str:
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Page | Site Name</title>
        </head>
        <body>
            <h1>Main Heading</h1>
            <p>Content here</p>
        </body>
        </html>
        """

    @pytest.fixture
    def sample_html_with_noise(self) -> str:
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Clean Content Test</title>
        </head>
        <body>
            <nav>
                <a href="/home">Home</a>
                <a href="/about">About</a>
            </nav>
            <header>
                <h1>Site Header</h1>
            </header>
            <main>
                <h1>Article Title</h1>
                <p>This is the actual content we want to keep.</p>
                <pre><code class="language-python">print("hello")</code></pre>
            </main>
            <aside class="sidebar">
                <div class="toc">Table of Contents</div>
            </aside>
            <footer>
                <p>Copyright 2024</p>
            </footer>
            <script>console.log("tracking");</script>
            <style>.hidden { display: none; }</style>
        </body>
        </html>
        """

    @pytest.fixture
    def sample_html_with_metadata(self) -> str:
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Page</title>
            <meta name="description" content="This is a test page description">
            <meta name="keywords" content="test, sample, page">
            <meta property="og:title" content="OG Title">
            <meta property="og:description" content="OG Description">
            <link rel="canonical" href="https://example.com/canonical">
        </head>
        <body>
            <p>Content</p>
        </body>
        </html>
        """

    @pytest.fixture
    def sample_html_with_code_blocks(self) -> str:
        return """
        <!DOCTYPE html>
        <html>
        <body>
            <h1>Code Examples</h1>
            <pre><code class="language-python">def hello(): pass</code></pre>
            <pre><code class="lang-javascript">const x = 1;</code></pre>
            <pre><code class="python">print("test")</code></pre>
            <pre><code>plain code</code></pre>
        </body>
        </html>
        """

    def test_extract_title_from_title_tag(self, extractor: ContentExtractor) -> None:
        html = "<html><head><title>Page Title | Site Name</title></head><body></body></html>"
        soup = BeautifulSoup(html, "html.parser")
        title = extractor._extract_title(soup)
        assert title == "Page Title"

    def test_extract_title_from_title_tag_with_dash(self, extractor: ContentExtractor) -> None:
        html = "<html><head><title>Page Title - Site Name</title></head><body></body></html>"
        soup = BeautifulSoup(html, "html.parser")
        title = extractor._extract_title(soup)
        assert title == "Page Title"

    def test_extract_title_from_h1_fallback(self, extractor: ContentExtractor) -> None:
        html = "<html><body><h1>H1 Title</h1></body></html>"
        soup = BeautifulSoup(html, "html.parser")
        title = extractor._extract_title(soup)
        assert title == "H1 Title"

    def test_extract_title_from_og_title_fallback(self, extractor: ContentExtractor) -> None:
        html = '<html><head><meta property="og:title" content="OG Title"></head><body></body></html>'
        soup = BeautifulSoup(html, "html.parser")
        title = extractor._extract_title(soup)
        assert title == "OG Title"

    def test_extract_title_returns_untitled_when_missing(self, extractor: ContentExtractor) -> None:
        html = "<html><body><p>No title here</p></body></html>"
        soup = BeautifulSoup(html, "html.parser")
        title = extractor._extract_title(soup)
        assert title == "Untitled"

    def test_remove_noise_removes_navigation(self, extractor: ContentExtractor) -> None:
        html = "<html><body><nav>Navigation</nav><main>Content</main></body></html>"
        soup = BeautifulSoup(html, "html.parser")
        extractor._remove_noise(soup)
        assert soup.find("nav") is None
        assert soup.find("main") is not None

    def test_remove_noise_removes_scripts_and_styles(self, extractor: ContentExtractor) -> None:
        html = '<html><body><script>alert("hi")</script><p>Content</p><style>.x{}</style></body></html>'
        soup = BeautifulSoup(html, "html.parser")
        extractor._remove_noise(soup)
        assert soup.find("script") is None
        assert soup.find("style") is None
        assert soup.find("p") is not None

    def test_remove_noise_removes_hidden_elements(self, extractor: ContentExtractor) -> None:
        html = '<html><body><div aria-hidden="true">Hidden</div><div>Visible</div></body></html>'
        soup = BeautifulSoup(html, "html.parser")
        extractor._remove_noise(soup)
        hidden_div = soup.find("div", {"aria-hidden": "true"})
        assert hidden_div is None

    def test_remove_noise_removes_comments(self, extractor: ContentExtractor) -> None:
        html = "<html><body><!-- Comment --><p>Content</p></body></html>"
        soup = BeautifulSoup(html, "html.parser")
        extractor._remove_noise(soup)
        # Check that no Comment objects remain in the soup
        comments = soup.find_all(string=lambda text: isinstance(text, Comment))
        assert len(comments) == 0

    def test_extract_code_language_with_language_prefix(self, extractor: ContentExtractor) -> None:
        # Use BeautifulSoup to create a real element
        html = '<code class="language-python highlight"></code>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("code")
        language = extractor._extract_code_language(element)
        assert language == "python"

    def test_extract_code_language_with_lang_prefix(self, extractor: ContentExtractor) -> None:
        html = '<code class="lang-javascript"></code>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("code")
        language = extractor._extract_code_language(element)
        assert language == "javascript"

    def test_extract_code_language_direct_match(self, extractor: ContentExtractor) -> None:
        html = '<code class="python highlight"></code>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("code")
        language = extractor._extract_code_language(element)
        assert language == "python"

    def test_extract_code_language_no_match(self, extractor: ContentExtractor) -> None:
        html = '<code class="some-other-class"></code>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("code")
        language = extractor._extract_code_language(element)
        assert language == ""

    def test_clean_markdown_removes_excess_newlines(self, extractor: ContentExtractor) -> None:
        markdown = "Line 1\n\n\n\n\nLine 2"
        cleaned = extractor._clean_markdown(markdown)
        assert "\n\n\n" not in cleaned
        assert "Line 1\n\nLine 2" == cleaned

    def test_clean_markdown_normalizes_unicode(self, extractor: ContentExtractor) -> None:
        markdown = "Hello\u00a0World\u2019s\u201cquoted\u201d"
        cleaned = extractor._clean_markdown(markdown)
        assert "\u00a0" not in cleaned  # Non-breaking space removed
        assert "'" in cleaned  # Smart quote converted
        assert '"' in cleaned  # Smart quotes converted

    def test_clean_markdown_fixes_escaped_characters(self, extractor: ContentExtractor) -> None:
        markdown = r"This is \_escaped\_ and \*also\* escaped"
        cleaned = extractor._clean_markdown(markdown)
        assert r"\_" not in cleaned
        assert r"\*" not in cleaned
        assert "_escaped_" in cleaned
        assert "*also*" in cleaned

    def test_clean_markdown_removes_empty_links(self, extractor: ContentExtractor) -> None:
        markdown = "Text with []() empty link"
        cleaned = extractor._clean_markdown(markdown)
        assert "[]()" not in cleaned

    def test_clean_markdown_strips_whitespace(self, extractor: ContentExtractor) -> None:
        markdown = "\n\n  Content here  \n\n"
        cleaned = extractor._clean_markdown(markdown)
        assert cleaned == "Content here"

    def test_extract_metadata_extracts_description(self, extractor: ContentExtractor) -> None:
        html = '<html><head><meta name="description" content="Test description"></head></html>'
        soup = BeautifulSoup(html, "html.parser")
        metadata = extractor._extract_metadata(soup, "https://example.com/page")
        assert metadata["description"] == "Test description"

    def test_extract_metadata_prefers_description_over_og_description(self, extractor: ContentExtractor) -> None:
        html = """<html><head>
            <meta name="description" content="Meta description">
            <meta property="og:description" content="OG description">
        </head></html>"""
        soup = BeautifulSoup(html, "html.parser")
        metadata = extractor._extract_metadata(soup, "https://example.com/page")
        assert metadata["description"] == "Meta description"

    def test_extract_metadata_uses_og_description_fallback(self, extractor: ContentExtractor) -> None:
        html = '<html><head><meta property="og:description" content="OG description"></head></html>'
        soup = BeautifulSoup(html, "html.parser")
        metadata = extractor._extract_metadata(soup, "https://example.com/page")
        assert metadata["description"] == "OG description"

    def test_extract_metadata_extracts_keywords(self, extractor: ContentExtractor) -> None:
        html = '<html><head><meta name="keywords" content="python, testing, tutorial"></head></html>'
        soup = BeautifulSoup(html, "html.parser")
        metadata = extractor._extract_metadata(soup, "https://example.com/page")
        assert metadata["keywords"] == "python, testing, tutorial"

    def test_extract_metadata_extracts_canonical_url(self, extractor: ContentExtractor) -> None:
        html = '<html><head><link rel="canonical" href="https://example.com/canonical"></head></html>'
        soup = BeautifulSoup(html, "html.parser")
        metadata = extractor._extract_metadata(soup, "https://example.com/page")
        assert metadata["canonical_url"] == "https://example.com/canonical"

    def test_extract_metadata_extracts_url_path(self, extractor: ContentExtractor) -> None:
        html = "<html><body></body></html>"
        soup = BeautifulSoup(html, "html.parser")
        metadata = extractor._extract_metadata(soup, "https://example.com/docs/getting-started/")
        assert metadata["url_path"] == ["docs", "getting-started"]

    def test_extract_metadata_includes_url(self, extractor: ContentExtractor) -> None:
        html = "<html><body></body></html>"
        soup = BeautifulSoup(html, "html.parser")
        metadata = extractor._extract_metadata(soup, "https://example.com/page")
        assert metadata["url"] == "https://example.com/page"

    def test_extract_content_full_integration(self, extractor: ContentExtractor, sample_html_with_noise: str) -> None:
        result = extractor.extract_content(sample_html_with_noise, "https://example.com/test")

        # Check title is extracted
        assert result["title"] == "Clean Content Test"

        # Check that noise elements are not in markdown
        markdown = result["markdown_content"]
        assert "Home" not in markdown  # Nav removed
        assert "Site Header" not in markdown  # Header removed
        assert "Copyright" not in markdown  # Footer removed
        assert "Table of Contents" not in markdown  # Sidebar removed

        # Check that actual content is present
        assert "Article Title" in markdown
        assert "actual content" in markdown

        # Check that code blocks are preserved
        assert "print" in markdown or "hello" in markdown  # Code content should be present

        # Check metadata
        assert result["metadata"]["url"] == "https://example.com/test"

    def test_extract_content_with_metadata(self, extractor: ContentExtractor, sample_html_with_metadata: str) -> None:
        result = extractor.extract_content(sample_html_with_metadata, "https://example.com/docs/guide")

        metadata = result["metadata"]
        assert metadata["description"] == "This is a test page description"
        assert metadata["keywords"] == "test, sample, page"
        assert metadata["canonical_url"] == "https://example.com/canonical"
        assert metadata["url_path"] == ["docs", "guide"]

    def test_html_to_markdown_preserves_headings(self, extractor: ContentExtractor) -> None:
        html = "<body><h1>Title</h1><h2>Subtitle</h2><p>Text</p></body>"
        soup = BeautifulSoup(html, "html.parser")
        markdown = extractor._html_to_markdown(soup)

        assert "# Title" in markdown
        assert "## Subtitle" in markdown

    def test_html_to_markdown_preserves_lists(self, extractor: ContentExtractor) -> None:
        html = "<body><ul><li>Item 1</li><li>Item 2</li></ul></body>"
        soup = BeautifulSoup(html, "html.parser")
        markdown = extractor._html_to_markdown(soup)

        assert "- Item 1" in markdown or "* Item 1" in markdown
        assert "- Item 2" in markdown or "* Item 2" in markdown

    def test_extract_content_handles_empty_body(self, extractor: ContentExtractor) -> None:
        html = "<html><head><title>Empty</title></head><body></body></html>"
        result = extractor.extract_content(html, "https://example.com/empty")

        assert result["title"] == "Empty"
        assert result["markdown_content"] == ""
        assert result["metadata"]["url"] == "https://example.com/empty"
