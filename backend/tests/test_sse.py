"""Tests for SSE manager."""
import asyncio
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sse import SSEManager


class TestSSEManager:
    def test_subscribe_returns_id_and_queue(self):
        mgr = SSEManager()
        sub_id, q = mgr.subscribe()
        assert isinstance(sub_id, int)
        assert isinstance(q, asyncio.Queue)
        assert mgr.subscriber_count == 1

    def test_unsubscribe_removes_subscriber(self):
        mgr = SSEManager()
        sub_id, _ = mgr.subscribe()
        mgr.unsubscribe(sub_id)
        assert mgr.subscriber_count == 0

    def test_unsubscribe_nonexistent_is_noop(self):
        mgr = SSEManager()
        mgr.unsubscribe(999)
        assert mgr.subscriber_count == 0

    async def test_broadcast_delivers_to_all(self):
        mgr = SSEManager()
        _, q1 = mgr.subscribe()
        _, q2 = mgr.subscribe()
        await mgr.broadcast("update", {"test": 1})
        msg1 = q1.get_nowait()
        msg2 = q2.get_nowait()
        assert "event: update" in msg1
        assert '"test"' in msg1
        assert msg1 == msg2

    async def test_broadcast_drops_full_queues(self):
        mgr = SSEManager()
        sub_id, q = mgr.subscribe()
        # Fill the queue
        for i in range(64):
            q.put_nowait(f"msg-{i}")
        assert mgr.subscriber_count == 1
        await mgr.broadcast("x", {"msg": "overflow"})
        # Subscriber should have been removed
        assert mgr.subscriber_count == 0

    async def test_event_stream_yields_keepalive(self):
        mgr = SSEManager()
        sub_id, q = mgr.subscribe()

        gen = mgr.event_stream(sub_id, q)
        # Should yield keepalive after 30s timeout, but let's put a message first
        await q.put("event: test\ndata: hello\n\n")
        msg = await gen.__anext__()
        assert "hello" in msg

    def test_multiple_subscribes_get_unique_ids(self):
        mgr = SSEManager()
        id1, _ = mgr.subscribe()
        id2, _ = mgr.subscribe()
        assert id1 != id2
        assert mgr.subscriber_count == 2
