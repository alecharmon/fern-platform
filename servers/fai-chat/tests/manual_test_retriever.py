import asyncio
import os

from dotenv import load_dotenv
from fai_ai_core.embeddings.openai_generator import OpenAIEmbeddingsGenerator
from fai_ai_core.retrieval.interface import (
    RetrievalQuery,
    RetrievalStrategy,
)
from fai_ai_core.retrieval.turbopuffer_retriever import TurbopufferRetriever

load_dotenv()


async def test_retriever() -> None:
    turbopuffer_api_key = os.getenv("TURBOPUFFER_API_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    domain = os.getenv("TEST_DOMAIN", "buildwithfern.com")

    if not turbopuffer_api_key:
        print("❌ TURBOPUFFER_API_KEY environment variable not set")
        return

    if not openai_api_key:
        print("❌ OPENAI_API_KEY environment variable not set")
        return

    print("🔧 Initializing embeddings generator...")
    async with OpenAIEmbeddingsGenerator(
        api_key=openai_api_key,
        model="text-embedding-3-large",
    ) as embeddings_generator:
        print("🔧 Initializing TurbopufferRetriever...")
        async with TurbopufferRetriever(
            turbopuffer_api_key=turbopuffer_api_key,
            embeddings_generator=embeddings_generator,
            region=os.getenv("TURBOPUFFER_REGION", "gcp-us-east4"),
        ) as retriever:
            print(f"\n🔥 Warming up Turbopuffer cache for domain: {domain}")
            try:
                await retriever.warm_cache(domain)
                print("✅ Cache warm hint sent")
                print("⏳ Waiting 1 second for cache warmup...\n")
                await asyncio.sleep(1)
            except Exception as e:
                print(f"⚠️  Cache warmup failed (continuing anyway): {e}\n")

            print(f"🔍 Testing retrieval for domain: {domain}\n")

            test_queries = [
                ("What is Fern?", RetrievalStrategy.SEMANTIC),
                ("API documentation", RetrievalStrategy.BM25),
                ("How to get started", RetrievalStrategy.HYBRID),
            ]

            for query_text, strategy in test_queries:
                print(f"{'='*60}")
                print(f"Query: {query_text}")
                print(f"Strategy: {strategy.value}")
                print(f"{'='*60}")

                try:
                    query = RetrievalQuery(
                        query=query_text,
                        domain=domain,
                        top_k=3,
                        strategy=strategy,
                    )

                    result = await retriever.retrieve(query)

                    print(f"✅ Retrieved {len(result.documents)} documents")
                    print(f"⏱️  Retrieval time: {result.retrieval_time_ms:.2f}ms")

                    if result.timing:
                        print("\n📊 Timing Breakdown:")
                        if result.timing.embedding_ms:
                            print(f"   Embedding: {result.timing.embedding_ms:.2f}ms")
                        if result.timing.query_ms:
                            print(f"   Query: {result.timing.query_ms:.2f}ms")
                        if result.timing.rerank_ms:
                            print(f"   Rerank: {result.timing.rerank_ms:.2f}ms")
                        if result.timing.total_ms:
                            print(f"   Total: {result.timing.total_ms:.2f}ms")

                    for i, doc in enumerate(result.documents, 1):
                        print(f"Document ID: {doc.document_id}")
                        print(f"\n📄 Document {i}:")
                        print(f"   Score: {doc.score:.4f}")
                        if doc.metadata:
                            if doc.metadata.get("title"):
                                print(f"   Title: {doc.metadata['title']}")
                            if doc.metadata.get("url"):
                                print(f"   URL: {doc.metadata['url']}")
                        print(f"   Content: {doc.content[:200]}...")

                except Exception as e:
                    print(f"❌ Error: {e}")

                print()

            print(f"{'='*60}")
            print("Testing batch retrieval...")
            print(f"{'='*60}")

            try:
                batch_queries = [
                    RetrievalQuery(
                        query="API",
                        domain=domain,
                        top_k=2,
                        strategy=RetrievalStrategy.SEMANTIC,
                    ),
                    RetrievalQuery(
                        query="documentation",
                        domain=domain,
                        top_k=2,
                        strategy=RetrievalStrategy.SEMANTIC,
                    ),
                ]

                results = await retriever.batch_retrieve(batch_queries)

                print(f"✅ Batch retrieved {len(results)} results")
                for i, result in enumerate(results, 1):
                    print(f"\n   Query {i}: '{batch_queries[i-1].query}'")
                    print(f"   Documents: {len(result.documents)}")
                    print(f"   Time: {result.retrieval_time_ms:.2f}ms")

            except Exception as e:
                print(f"❌ Batch retrieval error: {e}")

            print(f"\n{'='*60}")
            print("✅ All tests completed!")
            print(f"{'='*60}")


if __name__ == "__main__":
    print("🧪 Manual Turbopuffer Retriever Test\n")
    print("Required environment variables:")
    print("  - TURBOPUFFER_API_KEY")
    print("  - OPENAI_API_KEY")
    print("  - TEST_DOMAIN (optional, defaults to 'buildwithfern.com')")
    print("  - TURBOPUFFER_REGION (optional, defaults to 'gcp-us-east4')")
    print()
    print("Note: Turbopuffer namespace will be {TEST_DOMAIN}_query")
    print()

    asyncio.run(test_retriever())
