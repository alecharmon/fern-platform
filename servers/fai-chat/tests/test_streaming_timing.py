"""Quick diagnostic to test if SSE streaming is working."""

import time

import httpx
import pytest

pytestmark = pytest.mark.skip(reason="Requires external network access to fai-chat service")


def test_streaming() -> None:
    start = time.time()
    print(f"[{0:.0f}ms] Starting request...")

    with httpx.Client(timeout=120.0, http2=False) as client:
        with client.stream(
            "POST",
            "https://fai-chat.buildwithfern.com/chat",
            json={
                "skipSaveQuery": True,
                "messages": [{"role": "user", "parts": [{"type": "text", "text": "Hi"}]}],
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "x-fern-host": "buildwithfern.com",
                # Mimic browser headers
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept-Encoding": "identity",  # Disable compression
            },
        ) as response:
            print(f"Response headers: {dict(response.headers)}")
            chunk_count = 0
            for chunk in response.iter_raw():
                elapsed = (time.time() - start) * 1000
                chunk_count += 1
                preview = chunk[:80].decode("utf-8", errors="replace").replace("\n", "\\n")
                print(f"[{elapsed:.0f}ms] Chunk {chunk_count}: {preview}...")

    total = (time.time() - start) * 1000
    print(f"\n[{total:.0f}ms] Done. Received {chunk_count} chunks.")


if __name__ == "__main__":
    test_streaming()
