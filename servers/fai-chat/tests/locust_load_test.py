import json
import time
from random import choice

import httpx
from locust import (
    User,
    between,
    events,
    task,
)

ttft_stats: list[float] = []
time_to_first_byte_stats: list[float] = []


@events.request.add_listener
def on_request(
    request_type: str,
    name: str,
    response_time: float,
    response_length: int,
    exception: Exception | None,
    context: dict,
    **kwargs,
) -> None:
    if exception is None:
        if "[TTFT]" in name:
            ttft_stats.append(response_time)
        elif "[TTFB]" in name:
            time_to_first_byte_stats.append(response_time)


def print_percentile_stats(name: str, stats: list[float]) -> None:
    if not stats:
        return
    sorted_stats = sorted(stats)
    n = len(sorted_stats)
    print(f"\n{name} Statistics ({n} samples):")
    print(f"  Average: {sum(stats) / n:.2f}ms")
    print(f"  Median (P50): {sorted_stats[n // 2]:.2f}ms")
    print(f"  P95: {sorted_stats[int(n * 0.95)]:.2f}ms")
    print(f"  P99: {sorted_stats[int(n * 0.99)]:.2f}ms")
    print(f"  Min: {min(stats):.2f}ms")
    print(f"  Max: {max(stats):.2f}ms")


@events.quitting.add_listener
def on_quitting(environment, **kwargs) -> None:
    print("\n" + "=" * 60)
    print_percentile_stats("Time to First Byte (TTFB)", time_to_first_byte_stats)
    print_percentile_stats("Time to First Token (TTFT)", ttft_stats)
    print("=" * 60 + "\n")


class StreamingUser(User):
    wait_time = between(0.5, 2)
    host = "https://fai-chat.buildwithfern.com"

    questions = [
        "How do I authenticate with Fern?",
        "How do I use the Fern API?",
        "How do I use the Fern CLI?",
        "How do I use the Fern SDK?",
        "How do I use the typescript SDK?",
        "How do I use the python SDK?",
        "How do I use the java SDK?",
        "How do I use the go SDK?",
        "How do I use the ruby SDK?",
        "How do I use the php SDK?",
        "How do I use the csharp SDK?",
        "How do I use the c++ SDK?",
        "How can I add a document to the Fern API?",
        "How do I publish?",
    ]

    def on_start(self) -> None:
        # Force HTTP/1.1 to avoid HTTP/2 multiplexing buffering
        # verify=False to skip SSL cert validation when hitting ELB directly
        self.client = httpx.Client(
            timeout=httpx.Timeout(120.0),
            http2=False,
            verify=False,
        )

    def on_stop(self) -> None:
        self.client.close()

    @task
    def stream_request(self) -> None:
        start_time = time.time()
        ttft: float | None = None
        ttfb: float | None = None
        token_count = 0
        first_token_received = False
        first_byte_received = False
        buffer = ""
        exception: Exception | None = None

        try:
            with self.client.stream(
                "POST",
                f"{self.host}/chat",
                json={
                    "skipSaveQuery": True,
                    "messages": [
                        {
                            "role": "user",
                            "parts": [{"type": "text", "text": choice(self.questions)}],
                        }
                    ],
                },
                headers={
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                    "x-fern-host": "buildwithfern.com",
                },
            ) as response:
                # iter_raw() bypasses decompression buffering for true streaming
                for chunk in response.iter_raw():
                    if not chunk:
                        continue

                    # Record TTFB on very first byte received
                    if not first_byte_received:
                        ttfb = time.time() - start_time
                        first_byte_received = True
                        events.request.fire(
                            request_type="POST",
                            name="/chat [TTFB]",
                            response_time=int(ttfb * 1000),
                            response_length=0,
                            exception=None,
                            context={},
                        )

                    buffer += chunk.decode("utf-8")

                    # Process complete SSE events (delimited by \n\n)
                    while "\n\n" in buffer:
                        event_str, buffer = buffer.split("\n\n", 1)

                        for line in event_str.split("\n"):
                            if not line.startswith("data: "):
                                continue

                            data = line[6:]
                            if data == "[DONE]" or not data:
                                continue

                            try:
                                event = json.loads(data)
                            except json.JSONDecodeError:
                                continue

                            if event.get("type") == "text-delta":
                                if not first_token_received:
                                    ttft = time.time() - start_time
                                    first_token_received = True
                                    events.request.fire(
                                        request_type="POST",
                                        name="/chat [TTFT]",
                                        response_time=int(ttft * 1000),
                                        response_length=0,
                                        exception=None,
                                        context={},
                                    )
                                token_count += 1

        except Exception as e:
            exception = e

        total_time = time.time() - start_time

        # Fire the main request event for Locust stats
        events.request.fire(
            request_type="POST",
            name="/chat",
            response_time=int(total_time * 1000),
            response_length=token_count,
            exception=exception,
            context={},
        )

        if exception is None and token_count > 0:
            tps = token_count / total_time
            ttfb_ms = ttfb * 1000 if ttfb else 0
            ttft_ms = ttft * 1000 if ttft else 0
            print(
                f"TTFB: {ttfb_ms:.0f}ms | TTFT: {ttft_ms:.0f}ms | "
                f"Total: {total_time * 1000:.0f}ms | Tokens: {token_count} | TPS: {tps:.1f}"
            )
