"""
Manual test script for LLM providers.

Tests Anthropic, Bedrock, and Cohere providers with streaming and non-streaming responses.

Usage:
    # Test with environment variables
    export ANTHROPIC_API_KEY=your_key
    export AWS_ACCESS_KEY_ID=your_key
    export AWS_SECRET_ACCESS_KEY=your_secret
    export COHERE_API_KEY=your_key
    python tests/manual_test_llm_providers.py

    # Or pass as arguments
    python tests/manual_test_llm_providers.py --anthropic-key sk-... --aws-key ... --aws-secret ... --cohere-key ...

    # Test specific provider only
    python tests/manual_test_llm_providers.py --provider anthropic
    python tests/manual_test_llm_providers.py --provider bedrock
    python tests/manual_test_llm_providers.py --provider cohere
"""

import argparse
import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from llm.factory import _create_llm_provider  # noqa: E402
from llm.models import (  # noqa: E402
    LLMMessage,
    MessageRole,
)


async def test_anthropic_streaming(api_key: str) -> None:
    print("\n" + "=" * 60)
    print("TEST: Anthropic Streaming")
    print("=" * 60)

    provider = _create_llm_provider(
        model="claude-4.5-haiku",
        temperature=0.0,
        max_tokens=512,
        provider_preference=["anthropic"],
    )

    messages = [
        LLMMessage(role=MessageRole.SYSTEM, content="You are a helpful assistant. Be concise."),
        LLMMessage(role=MessageRole.USER, content="Explain quantum computing in one sentence."),
    ]

    print("\nStreaming response:")
    try:
        async for event in provider.generate_stream(messages):
            print(event.to_sse(), end="", flush=True)
        print("\n✓ Anthropic streaming test passed")
    except Exception as e:
        print(f"\n✗ Anthropic streaming test failed: {e}")
        raise


async def test_anthropic_non_streaming(api_key: str) -> None:
    print("\n" + "=" * 60)
    print("TEST: Anthropic Non-Streaming")
    print("=" * 60)

    provider = _create_llm_provider(
        model="claude-4.5-haiku",
        temperature=0.0,
        max_tokens=512,
        provider_preference=["anthropic"],
    )

    messages = [
        LLMMessage(role=MessageRole.SYSTEM, content="You are a helpful math assistant."),
        LLMMessage(role=MessageRole.USER, content="What is 2+2?"),
    ]

    print("\nGenerating response...")
    try:
        response = await provider.generate(messages)
        print(f"Model: {response.model_id}")
        print(f"Provider: {response.provider}")
        print(f"Content: {response.content}")
        print("Metrics:")
        print(f"  - Total time: {response.metrics.total_time_ms:.2f}ms")
        print(f"  - Input tokens: {response.metrics.input_tokens}")
        print(f"  - Output tokens: {response.metrics.output_tokens}")
        print(f"Finish reason: {response.finish_reason}")
        print("✓ Anthropic non-streaming test passed")
    except Exception as e:
        print(f"✗ Anthropic non-streaming test failed: {e}")
        raise


async def test_bedrock_streaming(aws_key_id: str, aws_secret: str) -> None:
    print("\n" + "=" * 60)
    print("TEST: Bedrock Streaming")
    print("=" * 60)

    provider = _create_llm_provider(
        model="claude-3.7",
        temperature=0.0,
        max_tokens=512,
        provider_preference=["bedrock"],
    )

    messages = [
        LLMMessage(role=MessageRole.SYSTEM, content="You are a helpful assistant. Be concise."),
        LLMMessage(role=MessageRole.USER, content="What is the capital of France?"),
    ]

    print("\nStreaming response:")
    try:
        async for event in provider.generate_stream(messages):
            print(event.to_sse(), end="", flush=True)
        print("\n✓ Bedrock streaming test passed")
    except Exception as e:
        print(f"\n✗ Bedrock streaming test failed: {e}")
        raise


async def test_bedrock_non_streaming(aws_key_id: str, aws_secret: str) -> None:
    print("\n" + "=" * 60)
    print("TEST: Bedrock Non-Streaming")
    print("=" * 60)

    provider = _create_llm_provider(
        model="claude-3.7",
        temperature=0.0,
        max_tokens=512,
        provider_preference=["bedrock"],
    )

    messages = [
        LLMMessage(role=MessageRole.SYSTEM, content="You are a helpful assistant."),
        LLMMessage(role=MessageRole.USER, content="Say hello in one word."),
    ]

    print("\nGenerating response...")
    try:
        response = await provider.generate(messages)
        print(f"Model: {response.model_id}")
        print(f"Provider: {response.provider}")
        print(f"Content: {response.content}")
        print("Metrics:")
        print(f"  - Total time: {response.metrics.total_time_ms:.2f}ms")
        print(f"  - Input tokens: {response.metrics.input_tokens}")
        print(f"  - Output tokens: {response.metrics.output_tokens}")
        print(f"Finish reason: {response.finish_reason}")
        print("✓ Bedrock non-streaming test passed")
    except Exception as e:
        print(f"✗ Bedrock non-streaming test failed: {e}")
        raise


async def test_cohere_streaming(api_key: str) -> None:
    print("\n" + "=" * 60)
    print("TEST: Cohere Streaming")
    print("=" * 60)

    provider = _create_llm_provider(
        model="command-a-03-2025",
        temperature=0.0,
        max_tokens=512,
        provider_preference=["cohere"],
    )

    messages = [
        LLMMessage(role=MessageRole.SYSTEM, content="You are a helpful assistant. Be concise."),
        LLMMessage(role=MessageRole.USER, content="Explain machine learning in one sentence."),
    ]

    print("\nStreaming response:")
    try:
        async for event in provider.generate_stream(messages):
            print(event.to_sse(), end="", flush=True)
        print("\n✓ Cohere streaming test passed")
    except Exception as e:
        print(f"\n✗ Cohere streaming test failed: {e}")
        raise


async def test_cohere_non_streaming(api_key: str) -> None:
    print("\n" + "=" * 60)
    print("TEST: Cohere Non-Streaming")
    print("=" * 60)

    provider = _create_llm_provider(
        model="command-a-03-2025",
        temperature=0.0,
        max_tokens=512,
        provider_preference=["cohere"],
    )

    messages = [
        LLMMessage(role=MessageRole.SYSTEM, content="You are a helpful assistant."),
        LLMMessage(role=MessageRole.USER, content="What is 5+3?"),
    ]

    print("\nGenerating response...")
    try:
        response = await provider.generate(messages)
        print(f"Model: {response.model_id}")
        print(f"Provider: {response.provider}")
        print(f"Content: {response.content}")
        print("Metrics:")
        print(f"  - Total time: {response.metrics.total_time_ms:.2f}ms")
        print(f"  - Input tokens: {response.metrics.input_tokens}")
        print(f"  - Output tokens: {response.metrics.output_tokens}")
        print(f"Finish reason: {response.finish_reason}")
        print("✓ Cohere non-streaming test passed")
    except Exception as e:
        print(f"✗ Cohere non-streaming test failed: {e}")
        raise


async def test_fallback(anthropic_key: str, aws_key_id: str, aws_secret: str) -> None:
    print("\n" + "=" * 60)
    print("TEST: Fallback Provider (Anthropic → Bedrock)")
    print("=" * 60)

    provider = _create_llm_provider(
        model="claude-3.7",
        temperature=0.0,
        max_tokens=256,
        provider_preference=["anthropic", "bedrock"],
    )

    messages = [LLMMessage(role=MessageRole.USER, content="Say 'test successful' in 2 words.")]

    print("\nGenerating response with fallback chain...")
    try:
        response = await provider.generate(messages)
        print(f"Provider used: {response.provider}")
        print(f"Content: {response.content}")
        print("✓ Fallback test passed")
    except Exception as e:
        print(f"✗ Fallback test failed: {e}")
        raise


async def main(args: argparse.Namespace) -> None:
    anthropic_key = args.anthropic_key or os.environ.get("ANTHROPIC_API_KEY")
    aws_key_id = args.aws_key or os.environ.get("AWS_ACCESS_KEY_ID")
    aws_secret = args.aws_secret or os.environ.get("AWS_SECRET_ACCESS_KEY")
    cohere_key = args.cohere_key or os.environ.get("COHERE_API_KEY")

    provider = args.provider

    if provider in [None, "anthropic"]:
        if not anthropic_key:
            print("⚠ Skipping Anthropic tests (no API key)")
        else:
            await test_anthropic_streaming(anthropic_key)
            await test_anthropic_non_streaming(anthropic_key)
            pass

    if provider in [None, "bedrock"]:
        if not aws_key_id or not aws_secret:
            print("⚠ Skipping Bedrock tests (no AWS credentials)")
        else:
            await test_bedrock_streaming(aws_key_id, aws_secret)
            await test_bedrock_non_streaming(aws_key_id, aws_secret)

    if provider in [None, "cohere"]:
        if not cohere_key:
            print("⚠ Skipping Cohere tests (no API key)")
        else:
            await test_cohere_streaming(cohere_key)
            await test_cohere_non_streaming(cohere_key)

    if provider is None and anthropic_key and aws_key_id and aws_secret:
        await test_fallback(anthropic_key, aws_key_id, aws_secret)

    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test LLM providers")
    parser.add_argument("--anthropic-key", help="Anthropic API key")
    parser.add_argument("--aws-key", help="AWS access key ID")
    parser.add_argument("--aws-secret", help="AWS secret access key")
    parser.add_argument("--cohere-key", help="Cohere API key")
    parser.add_argument(
        "--provider",
        choices=["anthropic", "bedrock", "cohere"],
        help="Test specific provider only",
    )

    args = parser.parse_args()

    asyncio.run(main(args))
