"""
tv/consumers.py

WebSocket consumer do painel TV.
ADR-003: Django Channels + Redis Channel Layer.
ws://{host}/ws/tv/

Protocolo de mensagens (spec seção 5.3.3):
  Recebe: { type: "tv.call", payload: { code, event_type, priority, tts_text, timestamp } }
  Envia:  { type: "tv.confirm", payload: { code } }
"""
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

from tv.services import TV_GROUP

logger = logging.getLogger(__name__)


class TVPanelConsumer(AsyncWebsocketConsumer):
    """
    Consumer do painel de TV (rota pública — sem autenticação obrigatória).
    Recebe broadcasts do grupo 'tv_panel' e os repassa para o cliente WebSocket.
    """

    async def connect(self):
        await self.channel_layer.group_add(TV_GROUP, self.channel_name)
        await self.accept()
        logger.info("TV WebSocket conectado: %s", self.channel_name)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(TV_GROUP, self.channel_name)
        logger.info("TV WebSocket desconectado: %s (código %s)", self.channel_name, close_code)

    async def receive(self, text_data=None, bytes_data=None):
        """
        Mensagens enviadas pelo painel TV (ex: confirmação de chamada).
        { "type": "tv.confirm", "payload": { "code": "A-045" } }
        """
        try:
            data = json.loads(text_data)
            msg_type = data.get("type")

            if msg_type == "tv.confirm":
                code = data.get("payload", {}).get("code")
                if code:
                    from asgiref.sync import sync_to_async
                    from tv.services import TVService
                    await sync_to_async(TVService.confirm_call)(code)
        except json.JSONDecodeError:
            logger.warning("TV consumer: payload JSON inválido recebido")
        except Exception as exc:
            logger.error("TV consumer receive error: %s", exc, exc_info=True)

    # ------------------------------------------------------------------
    # Handlers de mensagens do Channel Layer
    # ------------------------------------------------------------------
    async def tv_call(self, event):
        """Recebe 'tv.call' do channel layer e repassa ao WebSocket."""
        await self.send(text_data=json.dumps(event))

    async def tv_confirm(self, event):
        """Repassa confirmação para todos os painéis conectados."""
        await self.send(text_data=json.dumps(event))


class UserNotificationConsumer(AsyncWebsocketConsumer):
    """
    Consumer de notificações pessoais (ex: alerta de follow-up pendente).
    ws://{host}/ws/notifications/
    Requer autenticação JWT via query param: ?token=<access_token>
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f"user_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info("Notifications WS conectado: user=%s", user.email)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass  # Canal somente leitura para o cliente

    async def followup_pending(self, event):
        """Notificação de follow-up pendente enviada pela task Celery."""
        await self.send(text_data=json.dumps(event))
