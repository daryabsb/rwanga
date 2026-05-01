from channels.generic.websocket import AsyncJsonWebsocketConsumer


class AIJobConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.job_id = self.scope["url_route"]["kwargs"].get("job_id")
        if not self.job_id:
            await self.close(code=4400)
            return
        self.group_name = f"ai_job_{self.job_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connection.ready", "job_id": self.job_id})

    async def disconnect(self, close_code):
        group_name = getattr(self, "group_name", None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # Client is currently read-mostly; accept pings without side effects.
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def job_progress(self, event):
        await self.send_json(event["payload"])

