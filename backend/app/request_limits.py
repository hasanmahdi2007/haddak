"""Refuse request bodies that are too big, before they fill the server's memory.

The server reads a whole JSON body into memory before checking it, and has no
size limit of its own, so one request of a few hundred megabytes could take
down a small server. Haddak's bodies are small (photos go straight to
Supabase Storage, never through this API), so anything over MAX_BODY_BYTES
gets 413.

This is "ASGI middleware": a wrapper around the whole app that sees each
request before FastAPI does. A body's size is known up front when the client
sends Content-Length; otherwise ("chunked") it is counted while it arrives.
"""

import json

# The largest real body is a full business profile: a few kilobytes.
MAX_BODY_BYTES = 64 * 1024

TOO_LARGE_BODY = json.dumps({"detail": "Request body is too large."}).encode()


class BodySizeLimit:
    def __init__(self, app, max_bytes: int = MAX_BODY_BYTES):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = dict(scope["headers"]).get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_bytes:
            await self.reject(send)
            return

        received = 0
        response_started = False
        rejected = False

        async def counting_receive():
            nonlocal received, rejected
            if rejected:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes and not response_started:
                    # Answer 413 now, then tell the app the client has gone,
                    # so it stops reading. (Raising an error here would not
                    # work: FastAPI turns any error while reading the body
                    # into its own 400.)
                    rejected = True
                    await self.reject(send)
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message):
            nonlocal response_started
            if rejected:
                return  # our 413 already went out; the app's own reply is dropped
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        await self.app(scope, counting_receive, guarded_send)

    @staticmethod
    async def reject(send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(TOO_LARGE_BODY)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": TOO_LARGE_BODY})
