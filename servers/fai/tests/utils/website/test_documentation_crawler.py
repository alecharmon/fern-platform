from collections import deque
from unittest.mock import (
    Mock,
    patch,
)

import pytest
import requests

from fai.utils.website.crawler import DocumentationCrawler


class TestDocumentationCrawler:
    @pytest.fixture
    def basic_crawler(self) -> DocumentationCrawler:
        return DocumentationCrawler(
            start_url="https://docs.example.com/guide",
            domain_filter="docs.example.com",
            chunk_size=1000,
            chunk_overlap=200,
        )

    @pytest.fixture
    def sample_html_page(self) -> str:
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Documentation Guide</title>
        </head>
        <body>
            <h1>Getting Started</h1>
            <p>Welcome to our documentation with enough content to pass minimum length requirements.</p>
            <a href="/guide/intro">Introduction</a>
            <a href="/guide/advanced">Advanced Topics</a>
            <a href="https://external.com/resource">External Link</a>
        </body>
        </html>
        """

    @pytest.fixture
    def sample_html_with_content(self) -> str:
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>API Reference | Example Docs</title>
            <meta name="description" content="API documentation">
        </head>
        <body>
            <main>
                <h1>API Reference</h1>
                <h2>Authentication</h2>
                <p>Use API keys for authentication. Here's how to get started with our authentication system.</p>

                <h2>Endpoints</h2>
                <p>Available endpoints for the API with detailed descriptions and examples.</p>

                <pre><code class="language-python">
import requests
response = requests.get("https://api.example.com/data")
                </code></pre>
            </main>
        </body>
        </html>
        """

    def test_initialization(self, basic_crawler: DocumentationCrawler) -> None:
        assert basic_crawler.start_url == "https://docs.example.com/guide"
        assert basic_crawler.domain_filter == "docs.example.com"
        assert basic_crawler.chunker.chunk_size == 1000
        assert basic_crawler.chunker.chunk_overlap == 200
        assert len(basic_crawler.visited) == 0
        assert len(basic_crawler.to_visit) == 1
        to_visit_list = list(basic_crawler.to_visit)
        assert basic_crawler.start_url in to_visit_list

    def test_initialization_auto_domain_filter(self) -> None:
        crawler = DocumentationCrawler(start_url="https://docs.example.com/path")
        assert crawler.domain_filter == "docs.example.com"

    def test_is_valid_url_same_domain(self, basic_crawler: DocumentationCrawler) -> None:
        assert basic_crawler._is_valid_url("https://docs.example.com/guide/intro")
        assert basic_crawler._is_valid_url("https://docs.example.com/other/path")

    def test_is_valid_url_different_domain(self, basic_crawler: DocumentationCrawler) -> None:
        assert not basic_crawler._is_valid_url("https://other-site.com/guide")
        assert not basic_crawler._is_valid_url("https://example.com/guide")

    def test_is_valid_url_with_path_filter(self) -> None:
        crawler = DocumentationCrawler(start_url="https://docs.example.com/en/guide", path_filter="/en/")

        assert crawler._is_valid_url("https://docs.example.com/en/tutorial")
        assert not crawler._is_valid_url("https://docs.example.com/fr/tutorial")

    def test_is_valid_url_with_pattern(self) -> None:
        crawler = DocumentationCrawler(start_url="https://docs.example.com/v1/guide", url_pattern=r".*\/v\d+\/.*")

        assert crawler._is_valid_url("https://docs.example.com/v1/guide")
        assert crawler._is_valid_url("https://docs.example.com/v2/tutorial")
        assert not crawler._is_valid_url("https://docs.example.com/latest/guide")

    def test_is_valid_url_excludes_file_extensions(self, basic_crawler: DocumentationCrawler) -> None:
        assert not basic_crawler._is_valid_url("https://docs.example.com/guide.pdf")
        assert not basic_crawler._is_valid_url("https://docs.example.com/image.png")
        assert not basic_crawler._is_valid_url("https://docs.example.com/script.js")
        assert not basic_crawler._is_valid_url("https://docs.example.com/data.json")

    def test_is_valid_url_excludes_utility_pages(self, basic_crawler: DocumentationCrawler) -> None:
        assert not basic_crawler._is_valid_url("https://docs.example.com/search?q=test")
        assert not basic_crawler._is_valid_url("https://docs.example.com/print/guide")
        assert not basic_crawler._is_valid_url("https://docs.example.com/download/pdf")
        assert not basic_crawler._is_valid_url("https://docs.example.com/login")

    def test_normalize_url_removes_fragment(self, basic_crawler: DocumentationCrawler) -> None:
        url = "https://docs.example.com/guide#section-2"
        normalized = basic_crawler._normalize_url(url)
        assert "#section-2" not in normalized
        assert normalized == "https://docs.example.com/guide"

    def test_normalize_url_removes_trailing_slash(self, basic_crawler: DocumentationCrawler) -> None:
        url = "https://docs.example.com/guide/"
        normalized = basic_crawler._normalize_url(url)
        assert not normalized.endswith("/")
        assert normalized == "https://docs.example.com/guide"

    def test_normalize_url_keeps_version_params(self, basic_crawler: DocumentationCrawler) -> None:
        url = "https://docs.example.com/guide?version=2.0&lang=en&utm_source=google"
        normalized = basic_crawler._normalize_url(url)

        assert "version=2.0" in normalized
        assert "lang=en" in normalized
        assert "utm_source" not in normalized

    def test_normalize_url_removes_tracking_params(self, basic_crawler: DocumentationCrawler) -> None:
        url = "https://docs.example.com/guide?utm_source=twitter&ref=homepage"
        normalized = basic_crawler._normalize_url(url)

        assert normalized == "https://docs.example.com/guide"

    def test_extract_links_finds_valid_links(self, basic_crawler: DocumentationCrawler, sample_html_page: str) -> None:
        current_url = "https://docs.example.com/guide"
        links = basic_crawler._extract_links(sample_html_page, current_url)

        assert "https://docs.example.com/guide/intro" in links
        assert "https://docs.example.com/guide/advanced" in links

        assert "https://external.com/resource" not in links

    def test_extract_links_converts_relative_urls(self, basic_crawler: DocumentationCrawler) -> None:
        html = """
        <html><body>
            <a href="/guide/intro">Intro</a>
            <a href="../other">Other</a>
            <a href="page.html">Page</a>
        </body></html>
        """
        current_url = "https://docs.example.com/guide/start"
        links = basic_crawler._extract_links(html, current_url)

        for link in links:
            assert link.startswith("https://")

    def test_extract_links_normalizes_urls(self, basic_crawler: DocumentationCrawler) -> None:
        html = """
        <html><body>
            <a href="/guide#section">Link with fragment</a>
            <a href="/guide/">Link with slash</a>
        </body></html>
        """
        current_url = "https://docs.example.com/"
        links = basic_crawler._extract_links(html, current_url)

        assert "https://docs.example.com/guide" in links
        assert all("#" not in link for link in links)

    @patch("fai.utils.website.crawler.requests.get")
    def test_fetch_page_success(
        self, mock_get: Mock, basic_crawler: DocumentationCrawler, sample_html_with_content: str
    ) -> None:
        mock_response = Mock()
        mock_response.text = sample_html_with_content
        mock_response.status_code = 200
        mock_response.encoding = "utf-8"
        mock_get.return_value = mock_response

        response = basic_crawler._fetch_page("https://docs.example.com/page")

        assert response.text == sample_html_with_content
        mock_get.assert_called_once()

    @patch("fai.utils.website.crawler.requests.get")
    def test_fetch_page_sets_user_agent(self, mock_get: Mock, basic_crawler: DocumentationCrawler) -> None:
        mock_response = Mock()
        mock_response.text = "<html></html>"
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        basic_crawler._fetch_page("https://docs.example.com/page")

        call_kwargs = mock_get.call_args[1]
        assert "User-Agent" in call_kwargs["headers"]

    @patch("fai.utils.website.crawler.requests.get")
    def test_crawl_single_page(
        self, mock_get: Mock, basic_crawler: DocumentationCrawler, sample_html_with_content: str
    ) -> None:
        mock_response = Mock()
        mock_response.text = sample_html_with_content
        mock_response.status_code = 200
        mock_response.encoding = "utf-8"
        mock_get.return_value = mock_response

        chunks = basic_crawler.crawl(max_pages=1, delay=0, verbose=False)

        assert len(basic_crawler.visited) == 1
        assert len(chunks) > 0
        assert basic_crawler.start_url in basic_crawler.visited

    @patch("fai.utils.website.crawler.requests.get")
    def test_crawl_respects_max_pages(self, mock_get: Mock, sample_html_with_content: str) -> None:
        html_with_links = """
        <html>
        <head><title>Page</title></head>
        <body>
            <p>Content with enough text to pass minimum length requirements for chunking and processing properly.</p>
            <a href="/page1">Page 1</a>
            <a href="/page2">Page 2</a>
            <a href="/page3">Page 3</a>
        </body>
        </html>
        """

        mock_response = Mock()
        mock_response.text = html_with_links
        mock_response.status_code = 200
        mock_response.encoding = "utf-8"
        mock_get.return_value = mock_response

        crawler = DocumentationCrawler(start_url="https://docs.example.com/start")
        crawler.crawl(max_pages=2, delay=0, verbose=False)

        assert len(crawler.visited) == 2

    @patch("fai.utils.website.crawler.requests.get")
    def test_crawl_skips_visited_urls(self, mock_get: Mock, basic_crawler: DocumentationCrawler) -> None:
        test_url = "https://docs.example.com/guide"
        basic_crawler.visited.add(test_url)
        basic_crawler.to_visit = deque([test_url])

        basic_crawler.crawl(max_pages=1, delay=0, verbose=False)

        mock_get.assert_not_called()

    @patch("fai.utils.website.crawler.requests.get")
    def test_crawl_skips_insufficient_content(self, mock_get: Mock, basic_crawler: DocumentationCrawler) -> None:
        short_html = "<html><head><title>Short</title></head><body><p>Hi</p></body></html>"

        mock_response = Mock()
        mock_response.text = short_html
        mock_response.status_code = 200
        mock_response.encoding = "utf-8"
        mock_get.return_value = mock_response

        chunks = basic_crawler.crawl(max_pages=1, delay=0, verbose=False)

        assert len(basic_crawler.visited) == 1
        assert len(chunks) == 0

    @patch("fai.utils.website.crawler.requests.get")
    def test_crawl_handles_http_errors(self, mock_get: Mock, basic_crawler: DocumentationCrawler) -> None:
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        mock_get.return_value.raise_for_status.side_effect = requests.exceptions.HTTPError(response=mock_response)

        basic_crawler.crawl(max_pages=1, delay=0, verbose=False)

        assert len(basic_crawler.failed_urls) == 1
        assert basic_crawler.failed_urls[0]["url"] == basic_crawler.start_url
        assert basic_crawler.failed_urls[0]["status"] == 404

    @patch("fai.utils.website.crawler.requests.get")
    def test_crawl_handles_request_exceptions(self, mock_get: Mock, basic_crawler: DocumentationCrawler) -> None:
        mock_get.side_effect = requests.exceptions.ConnectionError("Connection failed")

        basic_crawler.crawl(max_pages=1, delay=0, verbose=False)

        assert len(basic_crawler.failed_urls) == 1
        assert "Connection failed" in basic_crawler.failed_urls[0]["error"]

    @patch("fai.utils.website.crawler.requests.get")
    def test_crawl_discovers_new_links(self, mock_get: Mock, basic_crawler: DocumentationCrawler) -> None:
        html_with_links = """
        <html>
        <head><title>Start Page</title></head>
        <body>
            <p>Start page with enough content to meet minimum requirements for processing and chunking properly.</p>
            <a href="https://docs.example.com/page1">Page 1</a>
            <a href="https://docs.example.com/page2">Page 2</a>
        </body>
        </html>
        """

        mock_response = Mock()
        mock_response.text = html_with_links
        mock_response.status_code = 200
        mock_response.encoding = "utf-8"
        mock_get.return_value = mock_response

        basic_crawler.crawl(max_pages=1, delay=0, verbose=False)

        assert len(basic_crawler.visited) == 1
        to_visit_list = list(basic_crawler.to_visit)
        assert (
            "https://docs.example.com/page1" in to_visit_list
            or "https://docs.example.com/page1" in basic_crawler.visited
        )
        assert (
            "https://docs.example.com/page2" in to_visit_list
            or "https://docs.example.com/page2" in basic_crawler.visited
        )

    @patch("fai.utils.website.crawler.requests.get")
    def test_crawl_produces_chunks_with_metadata(
        self, mock_get: Mock, basic_crawler: DocumentationCrawler, sample_html_with_content: str
    ) -> None:
        mock_response = Mock()
        mock_response.text = sample_html_with_content
        mock_response.status_code = 200
        mock_response.encoding = "utf-8"
        mock_get.return_value = mock_response

        chunks = basic_crawler.crawl(max_pages=1, delay=0, verbose=False)

        assert len(chunks) > 0
        for chunk in chunks:
            assert hasattr(chunk, "content")
            assert hasattr(chunk, "metadata")
            assert "document_title" in chunk.metadata
            assert "url" in chunk.metadata

    def test_get_statistics(self, basic_crawler: DocumentationCrawler) -> None:
        basic_crawler.visited = {"url1", "url2", "url3"}
        basic_crawler.all_chunks = [Mock(), Mock(), Mock(), Mock(), Mock()]
        basic_crawler.failed_urls = [{"url": "failed1"}]
        basic_crawler.to_visit = deque(["url4", "url5"])

        stats = basic_crawler.get_statistics()

        assert stats["total_pages"] == 3
        assert stats["total_chunks"] == 5
        assert stats["failed_urls"] == 1
        assert stats["avg_chunks_per_page"] == 5 / 3
        assert stats["urls_in_queue"] == 2

    def test_get_statistics_empty_crawler(self, basic_crawler: DocumentationCrawler) -> None:
        basic_crawler.to_visit.clear()

        stats = basic_crawler.get_statistics()

        assert stats["total_pages"] == 0
        assert stats["total_chunks"] == 0
        assert stats["failed_urls"] == 0
        assert stats["avg_chunks_per_page"] == 0
        assert stats["urls_in_queue"] == 0

    @patch("fai.utils.website.crawler.requests.get")
    def test_crawl_uses_apparent_encoding_when_missing(
        self, mock_get: Mock, basic_crawler: DocumentationCrawler
    ) -> None:
        html_content = (
            "<html><head><title>Test</title></head><body><p>Content here with sufficient text.</p></body></html>"
        )

        mock_response = Mock()
        mock_response.text = html_content
        mock_response.status_code = 200
        mock_response.encoding = None
        mock_response.apparent_encoding = "utf-8"
        mock_get.return_value = mock_response

        basic_crawler.crawl(max_pages=1, delay=0, verbose=False)

        assert len(basic_crawler.visited) == 1

    def test_multiple_crawlers_independent(self) -> None:
        crawler1 = DocumentationCrawler(start_url="https://site1.com/docs")
        crawler2 = DocumentationCrawler(start_url="https://site2.com/docs")

        crawler1.visited.add("https://site1.com/page1")
        crawler2.visited.add("https://site2.com/page2")

        assert len(crawler1.visited) == 1
        assert len(crawler2.visited) == 1
        assert "https://site1.com/page1" in crawler1.visited
        assert "https://site1.com/page1" not in crawler2.visited
