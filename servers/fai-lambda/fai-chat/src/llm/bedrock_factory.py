"""Bedrock provider factory."""

import os

from .bedrock import BedrockProvider
from .models import ModelId
from .provider_factory import ProviderFactory

BEDROCK_MODEL_CONFIGS: dict[ModelId, dict[str, str]] = {
    "claude-3.7": {
        "model_id": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
        "region": "us-east-1",
    },
    "claude-4": {
        "model_id": "us.anthropic.claude-sonnet-4-20250514-v1:0",
        "region": "us-east-1",
    },
    "claude-4.5": {
        "model_id": "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        "region": "us-east-1",
    },
    "claude-4.5-haiku": {
        "model_id": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        "region": "us-east-1",
    },
}


class BedrockProviderFactory(ProviderFactory):
    def __init__(self) -> None:
        self._aws_access_key_id = os.environ.get("AWS_ACCESS_KEY_ID")
        self._aws_secret_access_key = os.environ.get("AWS_SECRET_ACCESS_KEY")

    def create(
        self,
        model: str,
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> BedrockProvider | None:
        if model not in BEDROCK_MODEL_CONFIGS:
            return None

        if not self._aws_access_key_id or not self._aws_secret_access_key:
            raise ValueError("Bedrock provider requires AWS credentials")

        config = BEDROCK_MODEL_CONFIGS[model]  # type: ignore
        return BedrockProvider(
            model_id=config["model_id"],
            region=config["region"],
            temperature=temperature,
            max_tokens=max_tokens,
            aws_access_key_id=self._aws_access_key_id,
            aws_secret_access_key=self._aws_secret_access_key,
        )

    def is_available(self) -> bool:
        return bool(self._aws_access_key_id and self._aws_secret_access_key)

    def get_supported_models(self) -> dict[str, str]:
        return {alias: config["model_id"] for alias, config in BEDROCK_MODEL_CONFIGS.items()}

    @property
    def provider_name(self) -> str:
        return "bedrock"
