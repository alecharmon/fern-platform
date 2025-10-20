import asyncio
from functools import partial

import numpy as np
import pandas as pd
from openai import AsyncOpenAI
from sklearn.cluster import KMeans

from fai.models.api.analytics_api import GetInsightsResponse
from fai.models.types.analytics_types import (
    Insight,
    InsightExample,
    InsightWithMetadata,
)
from fai.models.types.query_types import Query
from fai.settings import (
    CONFIG,
    LOGGER,
    VARIABLES,
)


async def get_insights_from_queries(domain: str, queries: list[Query]) -> GetInsightsResponse:
    df = pd.DataFrame([{"text": query.text, "conversation_id": query.conversation_id} for query in queries])
    df["embedding"] = await get_embeddings(df["text"].tolist())

    loop = asyncio.get_event_loop()
    df["cluster"], kmeans = await loop.run_in_executor(
        None, partial(_cluster_embeddings_sync, df["embedding"].tolist())
    )

    top_cluster_ids = await loop.run_in_executor(None, partial(_select_top_clusters_sync, df, kmeans))

    summaries = await summarize_clusters_async(domain, df, top_cluster_ids)

    insights = []
    for cluster_id in top_cluster_ids:
        cluster_df = df[df["cluster"] == cluster_id]
        insight_summary = summaries[cluster_id]

        examples = []
        for example_text in insight_summary.examples:
            for _, row in cluster_df.iterrows():
                if row["text"] == example_text:
                    examples.append(InsightExample(query=example_text, conversationId=row["conversation_id"]))
                    break

        if not examples and len(cluster_df) > 0:
            for i in range(min(CONFIG.MAX_INSIGHTS_EXAMPLES, len(cluster_df))):
                row = cluster_df.iloc[i]
                examples.append(InsightExample(query=row["text"], conversationId=row["conversation_id"]))

        insights.append(
            InsightWithMetadata(
                insightText=insight_summary.insightText,
                numberOfQueries=len(cluster_df),
                examples=examples,
            )
        )

    insights.sort(key=lambda x: x.numberOfQueries, reverse=True)
    return GetInsightsResponse(insights=insights)


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        embeddings = []
        for i in range(0, len(texts), CONFIG.EMBEDDING_BATCH_SIZE):
            batch = texts[i : i + CONFIG.EMBEDDING_BATCH_SIZE]
            response = await openai_client.embeddings.create(model="text-embedding-3-large", input=batch)
            embeddings.extend([e.embedding for e in response.data])
        return embeddings


def _cluster_embeddings_sync(embeddings: list[list[float]]) -> tuple[np.ndarray, KMeans]:
    embedding_matrix = np.array(embeddings)
    kmeans = KMeans(n_clusters=CONFIG.INSIGHTS_NUM_CLUSTERS, random_state=42)
    clusters = kmeans.fit_predict(embedding_matrix)
    return clusters, kmeans


def _select_top_clusters_sync(df: pd.DataFrame, kmeans: KMeans) -> list[int]:
    cluster_stddevs = {}
    embedding_matrix = np.array(df["embedding"].tolist())

    for cluster_id in range(CONFIG.INSIGHTS_NUM_CLUSTERS):
        cluster_embeddings = embedding_matrix[df["cluster"] == cluster_id]
        centroid = kmeans.cluster_centers_[cluster_id]
        distances = np.linalg.norm(cluster_embeddings - centroid, axis=1)
        cluster_stddevs[cluster_id] = np.std(distances)

    sorted_clusters = sorted(cluster_stddevs.items(), key=lambda x: x[1])
    return [cluster_id for cluster_id, _ in sorted_clusters[: CONFIG.INSIGHTS_NUM_CLUSTERS]]


async def summarize_cluster_async(
    cluster_id: int, domain: str, filtered_df: pd.DataFrame, openai_client: AsyncOpenAI
) -> tuple[int, Insight]:
    LOGGER.info(f"Processing cluster {cluster_id}...")
    try:
        inputs = filtered_df[filtered_df["cluster"] == cluster_id]["text"].head(CONFIG.INSIGHTS_MAX_EXAMPLES).tolist()
        cluster_text = "\n".join(f"{i+1}. {x}" for i, x in enumerate(inputs))

        prompt = (
            f"You are an API and developer experience expert analyzing common queries users have "
            f"about the documentation site {domain}. Here are text examples from a semantic cluster. "
            "Your task is to extract a clear, actionable suggestion for how the developer documentation "
            "could be improved to reduce confusion and better serve developers. "
            "Focus on identifying gaps, unclear explanations, missing examples, or structural improvements. "
            "Be concise (1 sentence) and specific about what change should be made to the documentation. "
            "Cite any examples from the cluster that are particularly relevant to the suggestion.\n\n"
            f"{cluster_text}\n\n"
            "Return your response as JSON with fields:\n"
            "  'insightText' (string): a clear suggestion for improving the documentation\n"
            "  'examples' (list of strings): representative queries that motivated this suggestion"
        )

        response = await openai_client.responses.parse(
            model="gpt-4.1-2025-04-14",
            input=[{"role": "user", "content": prompt}],
            text_format=Insight,
        )
        parsed_response: Insight = response.output_parsed
        return (cluster_id, parsed_response)

    except Exception as e:
        raise e


async def summarize_clusters_async(domain: str, df: pd.DataFrame, cluster_ids: list[int]) -> dict[int, Insight]:
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        tasks = [summarize_cluster_async(cluster_id, domain, df, openai_client) for cluster_id in cluster_ids]
        results_list = await asyncio.gather(*tasks)

        results = {}
        for cluster_id, insight in results_list:
            results[cluster_id] = insight
        return results