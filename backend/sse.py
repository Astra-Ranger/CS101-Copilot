import asyncio
import json
import queue
import threading


def sse_chunk(event: dict) -> str:
    event_type = event.get("type", "message")
    payload = {key: value for key, value in event.items() if key != "type"}

    return (
        f"event: {event_type}\n"
        f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    )


def run_async_event_stream(async_iter_factory, output_queue, on_error):
    async def consume():
        async for event in async_iter_factory():
            output_queue.put(sse_chunk(event))

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(consume())
    except Exception as exc:
        output_queue.put(sse_chunk(on_error(exc)))
    finally:
        loop.close()
        output_queue.put(None)


def stream_from_worker(target, args):
    output_queue = queue.Queue(maxsize=100)
    worker = threading.Thread(target=target, args=(*args, output_queue), daemon=True)
    worker.start()

    while True:
        chunk = output_queue.get()
        if chunk is None:
            break
        yield chunk
