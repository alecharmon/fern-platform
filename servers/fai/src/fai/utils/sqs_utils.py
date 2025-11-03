import json
from enum import Enum
from typing import Any

import aioboto3
from botocore.exceptions import ClientError

from ..settings import LOGGER


class SQSMessageType(str, Enum):
    INTERRUPT = "INTERRUPT"
    RESUME = "RESUME"
    TERMINATE = "TERMINATE"


class SQSMessage:
    def __init__(self, message_type: SQSMessageType, editing_id: str, timestamp: str):
        self.message_type = message_type
        self.editing_id = editing_id
        self.timestamp = timestamp

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.message_type.value,
            "editing_id": self.editing_id,
            "timestamp": self.timestamp,
        }


class InterruptMessage(SQSMessage):
    def __init__(self, editing_id: str, timestamp: str):
        super().__init__(SQSMessageType.INTERRUPT, editing_id, timestamp)


class ResumeMessage(SQSMessage):
    def __init__(self, editing_id: str, prompts: list[str], timestamp: str):
        super().__init__(SQSMessageType.RESUME, editing_id, timestamp)
        self.prompts = prompts

    def to_dict(self) -> dict[str, Any]:
        data = super().to_dict()
        data["prompts"] = self.prompts
        return data


class TerminateMessage(SQSMessage):
    def __init__(self, editing_id: str, reason: str, timestamp: str):
        super().__init__(SQSMessageType.TERMINATE, editing_id, timestamp)
        self.reason = reason

    def to_dict(self) -> dict[str, Any]:
        data = super().to_dict()
        data["reason"] = self.reason
        return data


async def create_session_queue(editing_id: str, region: str = "us-east-1") -> str | None:
    queue_name = f"editing-session-{editing_id}.fifo"

    try:
        session = aioboto3.Session()
        async with session.client("sqs", region_name=region) as sqs_client:
            response = await sqs_client.create_queue(
                QueueName=queue_name,
                Attributes={
                    "FifoQueue": "true",
                    "ContentBasedDeduplication": "true",
                    "MessageRetentionPeriod": "3600",
                    "VisibilityTimeout": "300",
                },
            )
            queue_url = response["QueueUrl"]
            LOGGER.info(f"Created SQS FIFO queue for session {editing_id}: {queue_url}")
            return queue_url

    except ClientError as e:
        LOGGER.error(f"Failed to create SQS queue for session {editing_id}: {e.response['Error']['Message']}")
        return None
    except Exception as e:
        LOGGER.error(f"Unexpected error creating SQS queue for session {editing_id}: {str(e)}", exc_info=True)
        return None


async def delete_session_queue(queue_url: str) -> bool:
    try:
        session = aioboto3.Session()
        async with session.client("sqs") as sqs_client:
            await sqs_client.delete_queue(QueueUrl=queue_url)
            LOGGER.info(f"Deleted SQS queue: {queue_url}")
            return True

    except ClientError as e:
        LOGGER.error(f"Failed to delete SQS queue {queue_url}: {e.response['Error']['Message']}")
        return False
    except Exception as e:
        LOGGER.error(f"Unexpected error deleting SQS queue {queue_url}: {str(e)}", exc_info=True)
        return False


async def send_message_to_queue(queue_url: str, message: SQSMessage) -> bool:
    try:
        session = aioboto3.Session()
        async with session.client("sqs") as sqs_client:
            message_body = json.dumps(message.to_dict())

            await sqs_client.send_message(
                QueueUrl=queue_url,
                MessageBody=message_body,
                MessageGroupId=message.editing_id,
            )

            LOGGER.info(f"Sent {message.message_type.value} message to queue {queue_url}")
            return True

    except ClientError as e:
        LOGGER.error(f"Failed to send message to queue {queue_url}: {e.response['Error']['Message']}", exc_info=True)
        return False
    except Exception as e:
        LOGGER.error(f"Unexpected error sending message to queue {queue_url}: {str(e)}", exc_info=True)
        return False


async def receive_messages_from_queue(
    queue_url: str, max_messages: int = 10, wait_time_seconds: int = 0
) -> list[dict[str, Any]]:
    try:
        session = aioboto3.Session()
        async with session.client("sqs") as sqs_client:
            response = await sqs_client.receive_message(
                QueueUrl=queue_url,
                MaxNumberOfMessages=min(max_messages, 10),
                WaitTimeSeconds=wait_time_seconds,
                AttributeNames=["All"],
            )

            messages = response.get("Messages", [])
            parsed_messages = []

            for msg in messages:
                try:
                    body = json.loads(msg["Body"])
                    parsed_messages.append(
                        {
                            "body": body,
                            "receipt_handle": msg["ReceiptHandle"],
                            "message_id": msg["MessageId"],
                        }
                    )
                except json.JSONDecodeError:
                    LOGGER.warning(f"Failed to parse message body as JSON: {msg['Body']}")
                    continue

            if parsed_messages:
                LOGGER.info(f"Received {len(parsed_messages)} messages from queue {queue_url}")

            return parsed_messages

    except ClientError as e:
        LOGGER.error(f"Failed to receive messages from queue {queue_url}: {e.response['Error']['Message']}")
        return []
    except Exception as e:
        LOGGER.error(f"Unexpected error receiving messages from queue {queue_url}: {str(e)}", exc_info=True)
        return []


async def delete_message_from_queue(queue_url: str, receipt_handle: str) -> bool:
    try:
        session = aioboto3.Session()
        async with session.client("sqs") as sqs_client:
            await sqs_client.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt_handle)
            LOGGER.debug(f"Deleted message from queue {queue_url}")
            return True

    except ClientError as e:
        LOGGER.error(f"Failed to delete message from queue {queue_url}: {e.response['Error']['Message']}")
        return False
    except Exception as e:
        LOGGER.error(f"Unexpected error deleting message from queue {queue_url}: {str(e)}", exc_info=True)
        return False


async def purge_queue(queue_url: str) -> bool:
    try:
        session = aioboto3.Session()
        async with session.client("sqs") as sqs_client:
            await sqs_client.purge_queue(QueueUrl=queue_url)
            LOGGER.info(f"Purged all messages from queue {queue_url}")
            return True

    except ClientError as e:
        LOGGER.error(f"Failed to purge queue {queue_url}: {e.response['Error']['Message']}")
        return False
    except Exception as e:
        LOGGER.error(f"Unexpected error purging queue {queue_url}: {str(e)}", exc_info=True)
        return False
