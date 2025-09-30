import atexit
import os

from upstash_redis import Redis

from src.settings import VARIABLES

SHARD_COUNT = 2
SHARD_KEY_PREFIX = "discord_shard"
SHARD_CLAIMED_KEY = "discord_shard_claimed"


class ShardManager:
    """Manages shard claiming and releasing using Upstash Redis for coordination."""

    def __init__(self) -> None:
        self.redis = Redis(url=VARIABLES.KV_REST_API_URL, token=VARIABLES.KV_REST_API_TOKEN)
        self.claimed_shard: int | None = None
        self.task_id = self._get_task_id()

    def _get_task_id(self) -> str:
        """Get a unique identifier for this task/container."""
        metadata_uri = os.environ.get("ECS_CONTAINER_METADATA_URI_V4", None)
        if metadata_uri:
            import requests

            try:
                response = requests.get(f"{metadata_uri}/task", timeout=2)
                task_arn = response.json()["TaskARN"]
                # Extract task ID from ARN (last part after /)
                return task_arn.split("/")[-1]
            except Exception as e:
                print(f"Failed to get ECS task ID: {e}")

        return os.environ.get("HOSTNAME", "unknown")

    def claim_shard(self) -> int:
        """
        Atomically claim an available shard ID.
        Returns the claimed shard ID (0 or 1 for SHARD_COUNT=2).
        """
        for shard_id in range(SHARD_COUNT):
            shard_key = f"{SHARD_KEY_PREFIX}:{shard_id}"

            result = self.redis.set(shard_key, self.task_id, nx=True, ex=300)

            if result:
                self.claimed_shard = shard_id
                print(f"Successfully claimed shard {shard_id} for task {self.task_id}")

                self._register_cleanup()
                return shard_id

        for shard_id in range(SHARD_COUNT):
            shard_key = f"{SHARD_KEY_PREFIX}:{shard_id}"
            owner = self.redis.get(shard_key)
            print(f"Shard {shard_id} is claimed by: {owner}")

        raise RuntimeError("Failed to claim any shard - all shards are already claimed")

    def refresh_claim(self) -> None:
        """Refresh the expiry on our claimed shard to keep it alive."""
        if self.claimed_shard is not None:
            shard_key = f"{SHARD_KEY_PREFIX}:{self.claimed_shard}"
            self.redis.expire(shard_key, 300)

    def release_shard(self) -> None:
        """Release the claimed shard back to the pool."""
        if self.claimed_shard is not None:
            shard_key = f"{SHARD_KEY_PREFIX}:{self.claimed_shard}"

            current_owner = self.redis.get(shard_key)
            if current_owner == self.task_id:
                self.redis.delete(shard_key)
                print(f"Released shard {self.claimed_shard} for task {self.task_id}")
            else:
                print(f"Warning: Shard {self.claimed_shard} is now owned by {current_owner}, not releasing")

            self.claimed_shard = None

    def _register_cleanup(self) -> None:
        """Register cleanup handlers for graceful shutdown."""
        atexit.register(self.release_shard)
