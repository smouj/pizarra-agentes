"""
LLM Provider implementations for PicoClaw Agent
Supports: Anthropic Claude, OpenAI, OpenRouter, and more
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import httpx
import json
from dataclasses import dataclass


@dataclass
class Message:
    role: str
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: Dict[str, Any]
    type: str = "function"


@dataclass
class UsageInfo:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class LLMResponse:
    content: str
    tool_calls: Optional[List[ToolCall]] = None
    finish_reason: str = "stop"
    usage: Optional[UsageInfo] = None


class LLMProvider(ABC):
    """Base class for LLM providers"""

    @abstractmethod
    async def chat(
        self,
        messages: List[Message],
        tools: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        **options
    ) -> LLMResponse:
        """Send chat request to LLM"""
        pass

    @abstractmethod
    def get_default_model(self) -> str:
        """Get the default model name"""
        pass


class AnthropicProvider(LLMProvider):
    """Anthropic Claude API Provider"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.anthropic.com/v1"
        self.default_model = "claude-3-5-sonnet-20241022"

    def get_default_model(self) -> str:
        return self.default_model

    async def chat(
        self,
        messages: List[Message],
        tools: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        **options
    ) -> LLMResponse:
        """Chat with Claude API"""

        # Extract system message
        system_content = ""
        chat_messages = []

        for msg in messages:
            if msg.role == "system":
                system_content = msg.content
            elif msg.role == "tool":
                chat_messages.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": msg.tool_call_id,
                            "content": msg.content
                        }
                    ]
                })
            else:
                content = msg.content
                message_data = {"role": msg.role, "content": content}

                # Add tool calls if present
                if msg.tool_calls:
                    tool_uses = []
                    for tc in msg.tool_calls:
                        tool_uses.append({
                            "type": "tool_use",
                            "id": tc.get("id"),
                            "name": tc.get("name"),
                            "input": tc.get("arguments", {})
                        })
                    message_data["content"] = [{"type": "text", "text": content}] + tool_uses if content else tool_uses

                chat_messages.append(message_data)

        # Build request
        payload = {
            "model": model or self.default_model,
            "max_tokens": options.get("max_tokens", 4096),
            "messages": chat_messages,
        }

        if system_content:
            payload["system"] = system_content

        if tools:
            # Convert to Anthropic tool format
            anthropic_tools = []
            for tool in tools:
                anthropic_tools.append({
                    "name": tool["function"]["name"],
                    "description": tool["function"]["description"],
                    "input_schema": tool["function"]["parameters"]
                })
            payload["tools"] = anthropic_tools

        # Make request
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json=payload,
                timeout=60.0
            )

            if response.status_code != 200:
                raise Exception(f"Anthropic API error: {response.status_code} - {response.text}")

            data = response.json()

            # Parse response
            content_text = ""
            tool_calls = []

            for block in data.get("content", []):
                if block["type"] == "text":
                    content_text = block["text"]
                elif block["type"] == "tool_use":
                    tool_calls.append(ToolCall(
                        id=block["id"],
                        name=block["name"],
                        arguments=block["input"]
                    ))

            usage = UsageInfo(
                prompt_tokens=data.get("usage", {}).get("input_tokens", 0),
                completion_tokens=data.get("usage", {}).get("output_tokens", 0),
                total_tokens=data.get("usage", {}).get("input_tokens", 0) + data.get("usage", {}).get("output_tokens", 0)
            )

            return LLMResponse(
                content=content_text,
                tool_calls=tool_calls if tool_calls else None,
                finish_reason=data.get("stop_reason", "stop"),
                usage=usage
            )


class OpenAIProvider(LLMProvider):
    """OpenAI API Provider"""

    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or "https://api.openai.com/v1"
        self.default_model = "gpt-4o"

    def get_default_model(self) -> str:
        return self.default_model

    async def chat(
        self,
        messages: List[Message],
        tools: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        **options
    ) -> LLMResponse:
        """Chat with OpenAI API"""

        # Convert messages to OpenAI format
        openai_messages = []
        for msg in messages:
            message_data = {
                "role": msg.role,
                "content": msg.content
            }

            if msg.tool_calls:
                message_data["tool_calls"] = [
                    {
                        "id": tc.get("id"),
                        "type": "function",
                        "function": {
                            "name": tc.get("name"),
                            "arguments": json.dumps(tc.get("arguments", {}))
                        }
                    }
                    for tc in msg.tool_calls
                ]

            if msg.tool_call_id:
                message_data["tool_call_id"] = msg.tool_call_id

            openai_messages.append(message_data)

        # Build request
        payload = {
            "model": model or self.default_model,
            "messages": openai_messages,
            "max_tokens": options.get("max_tokens", 4096),
        }

        if tools:
            payload["tools"] = tools

        # Make request
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=60.0
            )

            if response.status_code != 200:
                raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")

            data = response.json()
            choice = data["choices"][0]
            message = choice["message"]

            # Parse tool calls
            tool_calls = None
            if "tool_calls" in message:
                tool_calls = [
                    ToolCall(
                        id=tc["id"],
                        name=tc["function"]["name"],
                        arguments=json.loads(tc["function"]["arguments"])
                    )
                    for tc in message["tool_calls"]
                ]

            usage_data = data.get("usage", {})
            usage = UsageInfo(
                prompt_tokens=usage_data.get("prompt_tokens", 0),
                completion_tokens=usage_data.get("completion_tokens", 0),
                total_tokens=usage_data.get("total_tokens", 0)
            )

            return LLMResponse(
                content=message.get("content", ""),
                tool_calls=tool_calls,
                finish_reason=choice.get("finish_reason", "stop"),
                usage=usage
            )


class OpenRouterProvider(OpenAIProvider):
    """OpenRouter API Provider (OpenAI-compatible)"""

    def __init__(self, api_key: str):
        super().__init__(api_key, base_url="https://openrouter.ai/api/v1")
        self.default_model = "anthropic/claude-3.5-sonnet"


class LLMProviderRegistry:
    """Registry to manage multiple LLM providers"""

    def __init__(self):
        self.providers: Dict[str, LLMProvider] = {}
        self.default_provider: Optional[str] = None

    def register(self, name: str, provider: LLMProvider, set_default: bool = False):
        """Register a new provider"""
        self.providers[name] = provider
        if set_default or not self.default_provider:
            self.default_provider = name

    def get(self, name: Optional[str] = None) -> LLMProvider:
        """Get a provider by name, or default provider"""
        provider_name = name or self.default_provider
        if not provider_name:
            raise ValueError("No provider specified and no default provider set")

        if provider_name not in self.providers:
            raise ValueError(f"Provider '{provider_name}' not found")

        return self.providers[provider_name]

    def list_providers(self) -> List[str]:
        """List all registered provider names"""
        return list(self.providers.keys())
