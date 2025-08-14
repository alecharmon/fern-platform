from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed

import pandas as pd

from openai import OpenAI

from src.fai.models.api.insights import InsightResponse
from src.settings import CONFIG
from src.settings import LOGGER
from src.settings import VARIABLES


MAX_EXAMPLES = 25


def summarize_cluster(cluster_id: int, domain: str, filtered_df: pd.DataFrame) -> tuple[int, InsightResponse]:
    LOGGER.info(f"Processing cluster {cluster_id}...")
    openai_client = OpenAI(api_key=VARIABLES.OPENAI_API_KEY)
    try:
        inputs = filtered_df[filtered_df["cluster"] == cluster_id]["text"].head(MAX_EXAMPLES).tolist()
        cluster_text = "\n".join(f"{i+1}. {x}" for i, x in enumerate(inputs))

        prompt = (
            f"You are an API expert analyzing common queries users have about your documentation site, {domain}. "
            f"Here are text examples from a semantic cluster. "
            "Briefly summarize, in 1-2 sentences, a key insight into questions users have about your service, documentation, or API. "
            "This insight will be used to improve the documentation for the service, so keep it concise, specific, and actionable. "
            "Cite any examples from the cluster that are particularly relevant to the insight.\n\n"
            f"{cluster_text}\n\n"
            "Return your response as JSON with fields 'insight' (string) and 'examples' (list of strings)."
        )

        response = openai_client.responses.parse(
            model="gpt-4.1-2025-04-14",
            input=[{"role": "user", "content": prompt}],
            text_format=InsightResponse,
        )
        parsed_response: InsightResponse = response.output_parsed
        return (cluster_id, parsed_response)

    except Exception as e:
        raise e


def summarize_clusters_parallel(domain: str, df: pd.DataFrame, cluster_ids: list[int]) -> dict[int, InsightResponse]:
    results = {}
    with ThreadPoolExecutor(max_workers=CONFIG.INSIGHTS_NUM_CLUSTERS) as executor:
        futures = {executor.submit(summarize_cluster, cluster_id, domain, df): cluster_id for cluster_id in cluster_ids}
        for future in as_completed(futures):
            cluster_id, insight = future.result()
            results[cluster_id] = insight
    return results
