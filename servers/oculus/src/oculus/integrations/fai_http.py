import os
import time

import requests

from oculus.integrations.base import AnswerMetadata, SourceMetadata

CITATION_PREFIX = "\nSource: "


class FAIHTTPIntegration:
    """Integration that calls FAI HTTP /chat endpoint."""

    def __init__(
        self,
        domain: str,
        model: str = "claude-4-sonnet-20250514",
        system_prompt: str | None = None,
        fai_url: str | None = None,
        fern_token: str | None = None,
        rewrite_query: bool = False,
    ):
        self.domain = domain
        self.model = model
        self.system_prompt = system_prompt
        self.fai_url = fai_url or os.environ.get("FAI_URL", "https://fai.buildwithfern.com")
        self.fern_token = fern_token or os.environ.get("FERN_TOKEN")
        self.rewrite_query = rewrite_query

        if not self.fern_token:
            raise ValueError("FERN_TOKEN is required for FAI HTTP integration")

    def generate_answer(self, question: str) -> tuple[str, AnswerMetadata]:
        start_time = time.time()

        try:
            payload = {
                "messages": [{"role": "user", "content": question}],
                "model": self.model,
                "rewrite_query": self.rewrite_query,
            }

            if self.system_prompt:
                payload["system_prompt"] = self.system_prompt

            response = requests.post(
                f"{self.fai_url}/chat/{self.domain}",
                headers={
                    "Authorization": f"Bearer {self.fern_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=120,
            )

            response.raise_for_status()
            data = response.json()

            turns = data.get("turns", [])
            if not turns:
                raise ValueError("No turns in response")

            answer_text = "\n\n".join([turn.get("content", "") for turn in turns if turn.get("role") == "assistant"])

            citations = data.get("citations", [])
            clean_citations = [
                citation.removeprefix(CITATION_PREFIX).strip() if isinstance(citation, str) else citation
                for citation in citations
            ]
            sources: list[SourceMetadata] = [
                {"url": citation, "title": None, "slug": None} for citation in clean_citations
            ]

            response_time_ms = (time.time() - start_time) * 1000
            metadata: AnswerMetadata = {
                "integration_type": "fai-http",
                "model": self.model,
                "sources": sources,
                "fai_http_citations": clean_citations,
                "response_time_ms": response_time_ms,
            }

            return answer_text, metadata

        except requests.exceptions.RequestException as e:
            error_metadata_req: AnswerMetadata = {
                "integration_type": "fai-http",
                "model": self.model,
                "sources": [],
                "response_time_ms": (time.time() - start_time) * 1000,
            }
            return f"ERROR: HTTP request failed: {str(e)}", error_metadata_req

        except Exception as e:
            error_metadata_gen: AnswerMetadata = {
                "integration_type": "fai-http",
                "model": self.model,
                "sources": [],
                "response_time_ms": (time.time() - start_time) * 1000,
            }
            return f"ERROR: {str(e)}", error_metadata_gen
