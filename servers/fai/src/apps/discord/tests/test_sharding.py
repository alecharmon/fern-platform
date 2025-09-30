"""
Test script to verify Discord sharding works correctly.
Run this to ensure messages are only processed once across both shards.
"""

import asyncio

import discord
from dotenv import load_dotenv

from src.settings import VARIABLES

load_dotenv()

message_count: dict[int, list[str]] = {}


class TestDiscordClient(discord.AutoShardedClient):
    def __init__(self, shard_id: int, name: str) -> None:
        intents = discord.Intents.default()
        intents.message_content = True
        intents.messages = True
        intents.guilds = True
        super().__init__(intents=intents, shard_count=2, shard_ids=[shard_id])
        self.name = name
        self.shard_id = shard_id

    async def on_ready(self) -> None:
        print(f"[{self.name}] Logged in with shard {self.shard_id}")
        print(f"[{self.name}] Connected to {len(self.guilds)} guilds:")
        for guild in self.guilds:
            expected_shard = (guild.id >> 22) % 2
            print(f"  - {guild.name} (ID: {guild.id}) -> shard {expected_shard}")

    async def on_message(self, message: discord.Message) -> None:
        if message.author.bot:
            return

        # Track how many times we've seen this message
        msg_id = message.id
        if msg_id not in message_count:
            message_count[msg_id] = []
        message_count[msg_id].append(self.name)

        print(f"[{self.name}] Received message {msg_id}: {message.content[:50]}")
        print(f"  Total handlers for this message: {len(message_count[msg_id])}")

        if len(message_count[msg_id]) > 1:
            print(f"  ⚠️  WARNING: Message processed by multiple shards: {message_count[msg_id]}")
        else:
            print("  ✅ Message processed by only one shard")


async def main() -> None:
    """Run both Discord clients simultaneously and verify sharding."""

    # Create two clients with different shards (simulating two ECS tasks)
    client1 = TestDiscordClient(shard_id=0, name="Client-Shard-0")
    client2 = TestDiscordClient(shard_id=1, name="Client-Shard-1")

    print("Starting both Discord clients...")
    print("Send some messages in Discord to test!")
    print("Press Ctrl+C to stop\n")

    try:
        # Run both clients concurrently
        await asyncio.gather(
            client1.start(VARIABLES.DISCORD_BOT_TOKEN),
            client2.start(VARIABLES.DISCORD_BOT_TOKEN),
        )
    except KeyboardInterrupt:
        print("\nShutting down...")
        await client1.close()
        await client2.close()

        # Print summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total unique messages: {len(message_count)}")

        duplicate_count = len([h for h in message_count.values() if len(h) > 1])
        if duplicate_count > 0:
            print(f"❌ FAILED: {duplicate_count} messages processed by multiple shards")
            for msg_id, handlers in message_count.items():
                if len(handlers) > 1:
                    print(f"  Message {msg_id}: {handlers}")
        else:
            print("✅ PASSED: All messages processed by exactly one shard")


if __name__ == "__main__":
    asyncio.run(main())
