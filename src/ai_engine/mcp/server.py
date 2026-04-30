"""
src.ai_engine.mcp.server
~~~~~~~~~~~~~~~~~~~~~~~~

MCP server entry point. Runs as a separate process sharing Django ORM.

Usage:
    python -m src.ai_engine.mcp.server
    python -m src.ai_engine.mcp.server --transport sse --port 8002
"""
import argparse
import asyncio
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "src.settings")

import django

django.setup()

from mcp.server import Server
from mcp.server.stdio import stdio_server

from src.ai_engine.mcp.prompts import register_prompts
from src.ai_engine.mcp.resources import register_resources
from src.ai_engine.mcp.tools import register_tools

app = Server("rwanga-progress")

register_resources(app)
register_tools(app)
register_prompts(app)


async def run_stdio():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


async def run_sse(port: int):
    from mcp.server.sse import SseServerTransport
    from starlette.applications import Starlette
    from starlette.routing import Route
    import uvicorn

    sse = SseServerTransport("/messages/")

    async def handle_sse(request):
        async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
            await app.run(streams[0], streams[1], app.create_initialization_options())

    starlette_app = Starlette(
        routes=[
            Route("/sse", endpoint=handle_sse),
            Route("/messages/", endpoint=sse.handle_post_message, methods=["POST"]),
        ]
    )
    config = uvicorn.Config(starlette_app, host="0.0.0.0", port=port)
    server = uvicorn.Server(config)
    await server.serve()


def main():
    parser = argparse.ArgumentParser(description="Rwanga Progress MCP Server")
    parser.add_argument("--transport", choices=["stdio", "sse"], default="stdio")
    parser.add_argument("--port", type=int, default=8002)
    args = parser.parse_args()

    if args.transport == "sse":
        asyncio.run(run_sse(args.port))
    else:
        asyncio.run(run_stdio())


if __name__ == "__main__":
    main()

