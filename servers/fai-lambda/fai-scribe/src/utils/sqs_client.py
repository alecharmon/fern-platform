import json
from typing import Any

import boto3
from botocore.exceptions import ClientError

from ..settings import LOGGER


class SQSClient:
    def __init__(self, queue_url: str):
        self.queue_url = queue_url
        self.sqs_client = boto3.client("sqs")
        self._last_checked_count = 0
        self._cached_messages: list[dict[str, Any]] = []

    def receive_messages(self, max_messages: int = 10) -> list[dict[str, Any]]:
        try:
            response = self.sqs_client.receive_message(
                QueueUrl=self.queue_url,
                MaxNumberOfMessages=min(max_messages, 10),
                WaitTimeSeconds=0,  # Short polling for Lambda
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
                self._last_checked_count += len(parsed_messages)
                LOGGER.info(f"Received {len(parsed_messages)} messages from queue")

            return parsed_messages

        except ClientError as e:
            LOGGER.error(f"Failed to receive messages from queue: {e.response['Error']['Message']}")
            return []
        except Exception as e:
            LOGGER.error(f"Unexpected error receiving messages: {str(e)}", exc_info=True)
            return []

    def delete_message(self, receipt_handle: str) -> bool:
        try:
            self.sqs_client.delete_message(QueueUrl=self.queue_url, ReceiptHandle=receipt_handle)
            LOGGER.debug("Deleted message from queue")
            return True

        except ClientError as e:
            LOGGER.error(f"Failed to delete message: {e.response['Error']['Message']}")
            return False
        except Exception as e:
            LOGGER.error(f"Unexpected error deleting message: {str(e)}", exc_info=True)
            return False

    def has_interrupt_message(self) -> tuple[bool, str | None]:
        messages = self.receive_messages(max_messages=10)

        for msg in messages:
            body = msg["body"]
            if body.get("type") == "INTERRUPT":
                LOGGER.info("Found INTERRUPT message in queue")
                return True, msg["receipt_handle"]
            else:
                self._cached_messages.append(msg)

        return False, None

    def get_resume_messages(self) -> list[dict[str, Any]]:
        resume_messages = []

        for msg in self._cached_messages:
            body = msg["body"]
            if body.get("type") == "RESUME":
                resume_messages.append({"body": body, "receipt_handle": msg["receipt_handle"]})

        messages = self.receive_messages(max_messages=10)
        for msg in messages:
            body = msg["body"]
            if body.get("type") == "RESUME":
                resume_messages.append({"body": body, "receipt_handle": msg["receipt_handle"]})

        if resume_messages:
            num_resume = len(resume_messages)
            num_cached = len([m for m in self._cached_messages if m["body"].get("type") == "RESUME"])
            num_new = len([m for m in messages if m["body"].get("type") == "RESUME"])
            LOGGER.info(f"Found {num_resume} RESUME messages ({num_cached} cached, {num_new} new)")

        self._cached_messages.clear()

        return resume_messages
