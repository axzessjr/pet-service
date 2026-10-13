"""Consume review events from RabbitMQ and keep service ratings current."""

import json
import os
import threading
import time

import pika

from store import RecommendationStore

EXCHANGE = "pawpal.events"
QUEUE = "recommendation.review-events"
ROUTING_KEY = "review.*"


def _integer(event: dict, name: str, minimum: int) -> int:
    value = event.get(name)
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{name} must be an integer of at least {minimum}")
    return value


def handle_review_event(store: RecommendationStore, body: bytes) -> bool:
    """Apply one review event; return False when it was older than stored data.

    Raises ValueError when the message is not a valid review event.
    """
    event = json.loads(body)
    if not isinstance(event, dict):
        raise ValueError("event must be a JSON object")
    service_id = _integer(event, "serviceId", 1)
    review_count = _integer(event, "reviewCount", 0)
    version = _integer(event, "version", 1)
    average = event.get("averageRating")
    if isinstance(average, bool) or not isinstance(average, (int, float)) or not 0 <= average <= 5:
        raise ValueError("averageRating must be a number from 0 to 5")

    applied = store.save_rating(service_id, float(average), review_count, version)
    if applied:
        print(
            f"Service {service_id} rating is now {average} from {review_count} review(s)",
            flush=True,
        )
    return applied


def consume_forever(store: RecommendationStore, url: str, retry_seconds: float = 5) -> None:
    while True:
        connection = None
        try:
            connection = pika.BlockingConnection(pika.URLParameters(url))
            channel = connection.channel()
            channel.exchange_declare(EXCHANGE, exchange_type="topic", durable=True)
            channel.queue_declare(QUEUE, durable=True)
            channel.queue_bind(QUEUE, EXCHANGE, routing_key=ROUTING_KEY)
            channel.basic_qos(prefetch_count=20)
            print(f"Listening for {ROUTING_KEY} events on queue {QUEUE}", flush=True)

            for method, _properties, body in channel.consume(QUEUE):
                try:
                    handle_review_event(store, body)
                except ValueError as error:
                    # A bad message would fail on every retry, so drop it.
                    print(f"Dropping invalid review event: {error}", flush=True)
                    channel.basic_nack(method.delivery_tag, requeue=False)
                    continue
                channel.basic_ack(method.delivery_tag)
        except Exception as error:  # noqa: BLE001 - keep the consumer alive
            # Unacknowledged messages are redelivered after reconnecting.
            print(f"Review consumer stopped ({error!r}); retrying in {retry_seconds}s", flush=True)
        finally:
            if connection is not None and connection.is_open:
                try:
                    connection.close()
                except Exception:  # noqa: BLE001
                    pass
        time.sleep(retry_seconds)


def start_consumer(store: RecommendationStore) -> threading.Thread | None:
    url = os.getenv("RABBITMQ_URL")
    if not url:
        print("RABBITMQ_URL is not set; service ratings will not update", flush=True)
        return None
    thread = threading.Thread(
        target=consume_forever, args=(store, url), name="review-events", daemon=True
    )
    thread.start()
    return thread
