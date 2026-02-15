"""
PicoClaw Agent - Python Implementation
Inspired by github.com/sipeed/picoclaw

A lightweight AI agent framework with multi-provider support and executable tools.
"""

from .agent import PicoClawAgent, ContextBuilder
from .providers import LLMProviderRegistry, AnthropicProvider, OpenAIProvider
from .tools import ToolRegistry, ShellTool, FileSystemTool, WebSearchTool

__version__ = "1.0.0"
__all__ = [
    "PicoClawAgent",
    "ContextBuilder",
    "LLMProviderRegistry",
    "AnthropicProvider",
    "OpenAIProvider",
    "ToolRegistry",
    "ShellTool",
    "FileSystemTool",
    "WebSearchTool",
]
