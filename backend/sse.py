"""Server-Sent Events manager for broadcasting real-time updates."""

import asyncio
from typing import AsyncGenerator


class SSEManager:
    """Fan-out SSE broadcaster with subscriber management."""

    def __init__(self) -> None:
        self._subscribers: dict[int, asyncio.Queue[str]] = {}
        self._counter = 0

    def subscribe(self) -> tuple[int, "asyncio.Queue[str]"]:
        self._counter += 1
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=64)
        self._subscribers[self._counter] = q
        return self._counter, q

    def unsubscribe(self, sub_id: int) -> None:
        self._subscribers.pop(sub_id, None)

    async def broadcast(self, event_type: str, data: str) -> None:
        msg = f"event: {event_type}\ndata: {data}\n\n"
        dead: list[int] = []
        for sid, q in self._subscribers.items():
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                dead.append(sid)
        for sid in dead:
            self._subscribers.pop(sid, None)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    async def event_stream(self, sub_id: int, q: "asyncio.Queue[str]") -> AsyncGenerator[str, None]:
        """Yields SSE-formatted strings. Sends keepalive every 30s."""
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=30.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            self.unsubscribe(sub_id)


sse_manager = SSEManager()
