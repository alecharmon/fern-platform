import json
import re
import time
from collections import deque
from urllib.parse import (
    parse_qs,
    urlencode,
    urljoin,
    urlparse,
)

import requests
from bs4 import BeautifulSoup
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
)

from fai.utils.website.chunker import MarkdownChunker
from fai.utils.website.extractor import ContentExtractor
from fai.utils.website.models import DocumentChunk


class DocumentationCrawler:
    def __init__(
        self,
        start_url: str,
        domain_filter: str | None = None,
        path_filter: str | None = None,
        url_pattern: str | None = None,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        min_content_length: int = 100,
        request_timeout: int = 15,
        max_retries: int = 3,
        user_agent: str = "Mozilla/5.0 (Documentation Scraper)",
    ):
        self.start_url = start_url
        self.domain_filter = domain_filter or urlparse(start_url).netloc
        self.path_filter = path_filter
        self.url_pattern = re.compile(url_pattern) if url_pattern else None
        self.min_content_length = min_content_length
        self.request_timeout = request_timeout
        self.max_retries = max_retries
        self.user_agent = user_agent

        self.visited: set[str] = set()
        self.to_visit: deque[str] = deque([start_url])

        self.extractor = ContentExtractor()
        self.chunker = MarkdownChunker(chunk_size, chunk_overlap)

        self.all_chunks: list[DocumentChunk] = []
        self.failed_urls: list[dict[str, str | int | None]] = []

    def _fetch_page(self, url: str) -> requests.Response:
        @retry(
            stop=stop_after_attempt(self.max_retries),
            wait=wait_exponential(multiplier=1, min=1, max=10),
            reraise=True,
        )
        def _fetch_with_retry() -> requests.Response:
            response = requests.get(url, timeout=self.request_timeout, headers={"User-Agent": self.user_agent})
            response.raise_for_status()
            return response

        return _fetch_with_retry()

    def crawl(self, max_pages: int | None = None, delay: float = 1.0, verbose: bool = True) -> list[DocumentChunk]:
        pages_crawled = 0

        while self.to_visit and (max_pages is None or pages_crawled < max_pages):
            url = self.to_visit.popleft()

            if url in self.visited:
                continue

            if verbose:
                print(f"Crawling [{pages_crawled + 1}]: {url}")

            try:
                response = self._fetch_page(url)

                if response.encoding is None:
                    response.encoding = response.apparent_encoding or "utf-8"
                elif response.encoding.lower() not in ["utf-8", "utf8"]:
                    response.encoding = "utf-8"

                self.visited.add(url)
                extracted = self.extractor.extract_content(response.text, url)

                if len(extracted["markdown_content"]) < self.min_content_length:
                    if verbose:
                        print("  ⚠ Skipped (insufficient content)")
                    continue

                chunks = self.chunker.chunk_document(
                    extracted["markdown_content"], extracted["title"], extracted["metadata"]
                )

                self.all_chunks.extend(chunks)

                if verbose:
                    print(f"  ✓ '{extracted['title']}' → {len(chunks)} chunks")

                new_links = self._extract_links(response.text, url)
                for link in new_links:
                    if link not in self.visited:
                        self.to_visit.append(link)

                pages_crawled += 1
                time.sleep(delay)

            except requests.exceptions.HTTPError as e:
                self.failed_urls.append({"url": url, "status": e.response.status_code if e.response else None})
                if verbose:
                    print(f"  ✗ HTTP Error: {e}")

            except requests.exceptions.RequestException as e:
                self.failed_urls.append({"url": url, "error": str(e)})
                if verbose:
                    print(f"  ✗ Request Error: {str(e)}")

            except Exception as e:
                self.failed_urls.append({"url": url, "error": str(e)})
                if verbose:
                    print(f"  ✗ Error: {str(e)}")

        return self.all_chunks

    def _extract_links(self, html: str, current_url: str) -> set[str]:
        soup = BeautifulSoup(html, "html.parser")
        links = set()

        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            full_url = urljoin(current_url, href)
            full_url = self._normalize_url(full_url)

            if self._is_valid_url(full_url):
                links.add(full_url)

        return links

    def _is_valid_url(self, url: str) -> bool:
        parsed = urlparse(url)

        if parsed.netloc != self.domain_filter:
            return False

        if self.path_filter and not parsed.path.startswith(self.path_filter):
            return False

        if self.url_pattern and not self.url_pattern.match(url):
            return False

        excluded_extensions = [
            ".pdf",
            ".zip",
            ".tar",
            ".gz",
            ".rar",
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".svg",
            ".ico",
            ".css",
            ".js",
            ".json",
            ".xml",
            ".mp4",
            ".mp3",
            ".avi",
            ".mov",
        ]
        if any(parsed.path.lower().endswith(ext) for ext in excluded_extensions):
            return False

        excluded_patterns = ["/search", "/print", "/download", "/login", "/signup"]
        if any(pattern in parsed.path.lower() for pattern in excluded_patterns):
            return False

        return True

    def _normalize_url(self, url: str) -> str:
        url = url.split("#")[0]
        url = url.rstrip("/")

        parsed = urlparse(url)
        if parsed.query:
            params = parse_qs(parsed.query)
            keep_params = {k: v for k, v in params.items() if k in ["version", "v", "lang", "language"]}
            if keep_params:
                query = urlencode(keep_params, doseq=True)
                url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{query}"
            else:
                url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

        return url

    def save_chunks(self, filename: str = "chunks.jsonl") -> None:
        with open(filename, "w", encoding="utf-8") as f:
            for chunk in self.all_chunks:
                json.dump(chunk.to_dict(), f, ensure_ascii=False)
                f.write("\n")

        print(f"\n✓ Saved {len(self.all_chunks)} chunks to {filename}")

    def save_markdown_docs(self, output_dir: str = "markdown_docs") -> None:
        import os

        os.makedirs(output_dir, exist_ok=True)

        docs_by_url: dict[str, dict[str, str | list[str]]] = {}
        for chunk in self.all_chunks:
            url_val = chunk.metadata.get("url")
            title_val = chunk.metadata.get("document_title")

            url = str(url_val) if url_val else "unknown"
            title = str(title_val) if title_val else "Untitled"

            if url not in docs_by_url:
                docs_by_url[url] = {"title": title, "chunks": []}

            chunks_list = docs_by_url[url]["chunks"]
            if isinstance(chunks_list, list):
                chunks_list.append(chunk.content)

        for i, (url, doc_info) in enumerate(docs_by_url.items()):
            filename = f"{output_dir}/doc_{i:04d}.md"
            title_val = doc_info["title"]
            chunks_val = doc_info["chunks"]

            title_str = str(title_val) if isinstance(title_val, str) else "Untitled"

            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"# {title_str}\n\n")
                f.write(f"Source: {url}\n\n")
                f.write("---\n\n")
                if isinstance(chunks_val, list):
                    f.write("\n\n".join(chunks_val))

        print(f"✓ Saved {len(docs_by_url)} markdown documents to {output_dir}/")

    def get_statistics(self) -> dict[str, int | float]:
        return {
            "total_pages": len(self.visited),
            "total_chunks": len(self.all_chunks),
            "failed_urls": len(self.failed_urls),
            "avg_chunks_per_page": len(self.all_chunks) / len(self.visited) if self.visited else 0,
            "urls_in_queue": len(self.to_visit),
        }
