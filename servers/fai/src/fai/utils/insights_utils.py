from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed,
)

import numpy as np
import pandas as pd
from openai import (
    AsyncOpenAI,
    OpenAI,
)
from sklearn.cluster import KMeans

from src.fai.models.api.analytics_api import GetInsightsResponse
from src.fai.models.types.analytics_types import (
    Insight,
    InsightWithCount,
)
from src.fai.models.types.query_types import Query
from src.settings import (
    CONFIG,
    LOGGER,
    VARIABLES,
)


async def get_insights_from_queries(domain: str, queries: list[Query]) -> GetInsightsResponse:
    df = pd.DataFrame([{"text": query.text} for query in queries])
    df["embedding"] = await get_embeddings(df["text"].tolist())
    df["cluster"], kmeans = cluster_embeddings(df["embedding"].tolist())

    top_cluster_ids = select_top_clusters(df, kmeans)
    summaries = summarize_clusters_parallel(domain, df, top_cluster_ids)

    insights = [
        InsightWithCount(
            insightText=summaries[cluster_id].insightText,
            numberOfQueries=len(df[df["cluster"] == cluster_id]),
            examples=summaries[cluster_id].examples,
        )
        for cluster_id in top_cluster_ids
    ]
    return GetInsightsResponse(insights=insights)


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    async with AsyncOpenAI(api_key=VARIABLES.OPENAI_API_KEY) as openai_client:
        embeddings = []
        for i in range(0, len(texts), CONFIG.EMBEDDING_BATCH_SIZE):
            batch = texts[i : i + CONFIG.EMBEDDING_BATCH_SIZE]
            response = await openai_client.embeddings.create(model="text-embedding-3-large", input=batch)
            embeddings.extend([e.embedding for e in response.data])
        return embeddings


def cluster_embeddings(embeddings: list[list[float]]) -> tuple[np.ndarray, KMeans]:
    embedding_matrix = np.array(embeddings)
    kmeans = KMeans(n_clusters=CONFIG.INSIGHTS_NUM_CLUSTERS, random_state=42)
    clusters = kmeans.fit_predict(embedding_matrix)
    return clusters, kmeans


def select_top_clusters(df: pd.DataFrame, kmeans: KMeans) -> list[int]:
    cluster_stddevs = {}
    embedding_matrix = np.array(df["embedding"].tolist())

    for cluster_id in range(CONFIG.INSIGHTS_NUM_CLUSTERS):
        cluster_embeddings = embedding_matrix[df["cluster"] == cluster_id]
        centroid = kmeans.cluster_centers_[cluster_id]
        distances = np.linalg.norm(cluster_embeddings - centroid, axis=1)
        cluster_stddevs[cluster_id] = np.std(distances)

    sorted_clusters = sorted(cluster_stddevs.items(), key=lambda x: x[1])
    return [cluster_id for cluster_id, _ in sorted_clusters[: CONFIG.INSIGHTS_NUM_CLUSTERS]]


def summarize_cluster(cluster_id: int, domain: str, filtered_df: pd.DataFrame) -> tuple[int, Insight]:
    LOGGER.info(f"Processing cluster {cluster_id}...")
    openai_client = OpenAI(api_key=VARIABLES.OPENAI_API_KEY)
    try:
        inputs = filtered_df[filtered_df["cluster"] == cluster_id]["text"].head(CONFIG.INSIGHTS_MAX_EXAMPLES).tolist()
        cluster_text = "\n".join(f"{i+1}. {x}" for i, x in enumerate(inputs))

        prompt = (
            f"You are an API expert analyzing common queries users have about your documentation site, {domain}. "
            f"Here are text examples from a semantic cluster. "
            "Briefly summarize, in 1-2 sentences, a key insight into questions users have about your service, "
            "documentation, or API. "
            "This insight will be used to improve the documentation for the service, so keep it concise, "
            "specific, and actionable. "
            "Cite any examples from the cluster that are particularly relevant to the insight.\n\n"
            f"{cluster_text}\n\n"
            "Return your response as JSON with fields 'insight' (string) and 'examples' (list of strings)."
        )

        response = openai_client.responses.parse(
            model="gpt-4.1-2025-04-14",
            input=[{"role": "user", "content": prompt}],
            text_format=Insight,
        )
        parsed_response: Insight = response.output_parsed
        return (cluster_id, parsed_response)

    except Exception as e:
        raise e


def summarize_clusters_parallel(domain: str, df: pd.DataFrame, cluster_ids: list[int]) -> dict[int, Insight]:
    results = {}
    with ThreadPoolExecutor(max_workers=CONFIG.INSIGHTS_NUM_CLUSTERS) as executor:
        futures = {executor.submit(summarize_cluster, cluster_id, domain, df): cluster_id for cluster_id in cluster_ids}
        for future in as_completed(futures):
            cluster_id, insight = future.result()
            results[cluster_id] = insight
    return results
