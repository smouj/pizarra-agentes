# 🦞 PicoClaw Integration Guide

## Overview

This OpenClaw MGS Codec Dashboard now includes a **fully functional PicoClaw agent** implementation in Python, inspired by [github.com/sipeed/picoclaw](https://github.com/sipeed/picoclaw).

PicoClaw is an ultra-lightweight AI assistant with executable tools, multi-provider support, and memory management.

---

## ✨ What's New

### Real Agent Capabilities

The placeholder OpenClaw API has been replaced with **picoclaw_agent**, a Python module that provides:

- ✅ **Multi-LLM Support**: Anthropic Claude, OpenAI GPT, OpenRouter
- ✅ **Executable Tools**: Shell commands, file operations, web search, memory
- ✅ **Agentic Loop**: Autonomous tool execution with multi-step reasoning
- ✅ **Sandboxed Execution**: Security-first design with dangerous command blocking
- ✅ **Memory System**: Long-term memory persistence across sessions
- ✅ **Usage Tracking**: Token counting and cost estimation

---

## 🚀 How to Use

### 1. Configure Your API Token

The token format now supports multiple providers:

**Format**: `provider:api_key`

**Examples**:
```
anthropic:sk-ant-api03-xxxxx
openai:sk-xxxxx
openrouter:sk-or-v1-xxxxx
```

**Default**: If you don't include a provider prefix, it defaults to Anthropic Claude.

### 2. Set Your Token

1. Open the dashboard in your browser
2. Click the **🔒 TOKEN** button
3. Enter your token in the format above
4. Click **SAVE TOKEN**

Example tokens:
- `anthropic:sk-ant-api03-your-key-here`
- `openai:sk-your-openai-key-here`
- `sk-ant-api03-your-key-here` (defaults to Anthropic)

### 3. Start Chatting

Select any agent and start a conversation. The agent will:
- Execute commands using the `shell` tool
- Read/write files using `read_file`, `write_file`, `list_files` tools
- Search the web using `web_search` tool (if Brave API key configured)
- Remember important information using the `memory` tool

---

## 🛠️ Architecture

### Backend Structure

```
backend/
├── server.py                      # FastAPI server (updated)
├── picoclaw_agent/               # PicoClaw module
│   ├── __init__.py               # Module exports
│   ├── agent.py                  # Main agent + context builder
│   ├── providers.py              # LLM provider implementations
│   ├── tools.py                  # Executable tools
│   └── config.example.json       # Configuration example
```

### Agent Types → Tool Capabilities Mapping

Each of the 6 agents in the dashboard has specialized tool access:

| Agent | Type | Primary Tools |
|-------|------|---------------|
| **Orchestrator** | orchestrator | All tools (coordination) |
| **Shell Executor** | shell | shell, list_files |
| **Browser Agent** | browser | web_search |
| **File Manager** | file | read_file, write_file, list_files |
| **Communications** | messaging | memory (for message history) |
| **Custom Skill** | custom | Customizable toolset |

Each agent gets its own workspace: `~/.picoclaw/workspaces/{agent_type}/`

---

## 🔧 Available Tools

### 1. Shell Tool
Execute shell commands in a sandboxed environment.

**Parameters**:
- `command` (string): The shell command to execute

**Example**:
```json
{
  "command": "ls -la"
}
```

**Security**: Blocks dangerous commands like `rm -rf`, `format`, `shutdown`, etc.

### 2. File System Tools

#### read_file
Read contents of a file in the workspace.

**Parameters**:
- `path` (string): Relative path from workspace root

#### write_file
Write or overwrite a file.

**Parameters**:
- `path` (string): Relative path from workspace root
- `content` (string): File content

#### list_files
List files in a directory.

**Parameters**:
- `path` (string, optional): Relative path (default: root)

### 3. Web Search Tool
Search the web using Brave Search API.

**Parameters**:
- `query` (string): Search query
- `count` (integer, optional): Number of results (default: 5)

**Note**: Requires `BRAVE_API_KEY` environment variable.

### 4. Memory Tool
Read or append to long-term memory.

**Parameters**:
- `action` (enum): "read" or "append"
- `content` (string): Content to append (for append action)

**Memory Location**: `~/.picoclaw/workspaces/{agent_type}/memory/MEMORY.md`

---

## 🎯 Agent Workflow

When you send a message:

1. **Context Building**: System prompt is built with:
   - Agent identity
   - Current time and runtime info
   - Available tools
   - Memory context
   - Bootstrap files (IDENTITY.md, SOUL.md, etc.)

2. **LLM Call**: Message sent to configured provider (Claude/GPT/etc.)

3. **Tool Execution Loop**: If agent requests tools:
   - Tools are executed sequentially
   - Results are fed back to the agent
   - Process repeats (max 10 iterations)

4. **Response**: Final text response is returned to user

5. **Metrics**: Token usage and cost tracked in MongoDB

---

## 📊 Response Metadata

Each agent response includes metadata:

```json
{
  "content": "Agent response text...",
  "metadata": {
    "usage": {
      "prompt_tokens": 1523,
      "completion_tokens": 342,
      "total_tokens": 1865
    },
    "tool_results": [
      {
        "tool": "shell",
        "args": {"command": "ls -la"},
        "result": "total 48\ndrwxr-xr-x..."
      }
    ],
    "iterations": 2
  }
}
```

---

## 🔐 Security Features

### Sandboxing
- All file operations restricted to workspace directory
- Path traversal attacks prevented
- Dangerous commands blocked

### Blocked Commands
- `rm -rf` (recursive delete)
- `format` (disk formatting)
- `shutdown` / `reboot`
- `dd if=` (disk operations)
- `mkfs` (filesystem creation)
- Fork bombs: `:(){ :|:& };:`

### Token Encryption
API tokens are encrypted using Fernet before storage in MongoDB.

---

## ⚙️ Configuration

### Environment Variables

Add to `/app/backend/.env`:

```env
# MongoDB
MONGO_URL=mongodb://localhost:27017/openclaw_db

# Security
SECRET_KEY=your-44-char-fernet-key-here

# Optional: Web Search
BRAVE_API_KEY=BSA...

# Optional: Default workspace
PICOCLAW_WORKSPACE=~/.picoclaw/workspace
```

### Bootstrap Files

You can customize agent behavior by creating files in the workspace:

- **IDENTITY.md**: Override agent identity
- **SOUL.md**: Define agent personality
- **USER.md**: User preferences
- **AGENTS.md**: Multi-agent coordination rules

Example workspace structure:
```
~/.picoclaw/workspaces/orchestrator/
├── IDENTITY.md
├── SOUL.md
├── USER.md
├── AGENTS.md
├── memory/
│   └── MEMORY.md
└── sessions/
```

---

## 📈 Advanced Usage

### Custom Model Selection

You can specify a custom model per agent in the database:

```javascript
// Update agent in MongoDB
db.agents.updateOne(
  { "type": "orchestrator" },
  { $set: { "model": "claude-3-opus-20240229" } }
)
```

### Multi-Agent Collaboration

Agents can reference each other's memory by reading workspace files:

```python
# Agent A writes to memory
await agent.execute_tool("memory", action="append", content="Task completed")

# Agent B reads from Agent A's workspace
await agent.execute_tool(
    "read_file",
    path="../orchestrator/memory/MEMORY.md"
)
```

---

## 🧪 Testing

### Test Individual Tools

```python
from picoclaw_agent import create_default_agent

agent = create_default_agent(
    api_key="your-api-key",
    provider_type="anthropic",
    workspace="/tmp/test_workspace"
)

# Test shell tool
result = await agent.execute_tool("shell", command="echo 'Hello PicoClaw'")
print(result)  # Hello PicoClaw

# Test file operations
await agent.execute_tool("write_file", path="test.txt", content="Hello World")
content = await agent.execute_tool("read_file", path="test.txt")
print(content)  # Hello World
```

### Test Full Agent

```python
response = await agent.chat(
    user_message="Create a file called hello.txt with the content 'Hello from PicoClaw!'"
)

print(response["content"])
print(response["tool_results"])
print(response["usage"])
```

---

## 🐛 Troubleshooting

### Error: "Provider 'xxx' not found"

**Solution**: Check your token format. Use `provider:api_key` format.

### Error: "Access denied: path outside workspace"

**Solution**: File paths must be relative to workspace root. Don't use `../` to escape workspace.

### Error: "Dangerous command blocked"

**Solution**: Command contains blocked patterns. Review security section for blocked commands.

### Tools not executing

**Solution**: Ensure agent has proper tool access. Check tool registry in agent initialization.

---

## 🔄 Migration from Old OpenClaw Placeholder

### Before (Placeholder)
```python
await call_openclaw_agent(
    token="openclaw_token_here",
    agent_id="agent-123",
    message="Hello"
)
# Returns: "Agent response received" (placeholder)
```

### After (Real PicoClaw)
```python
await call_openclaw_agent(
    token="anthropic:sk-ant-api03-xxxxx",
    agent_id="agent-123",
    message="List all files in the current directory",
    conversation_history=history
)
# Returns: {
#   "content": "I'll list the files for you...",
#   "usage": {"total_tokens": 523},
#   "tool_results": [{"tool": "shell", "result": "..."}]
# }
```

---

## 📚 Resources

### PicoClaw Original (Go)
- Repository: https://github.com/sipeed/picoclaw
- Documentation: See README.md in picoclaw repo

### OpenClaw MGS Codec Dashboard
- Main README: /app/README.md
- Integration Guide (old): /app/INTEGRATION.md

### LLM Provider Documentation
- Anthropic Claude: https://docs.anthropic.com/
- OpenAI: https://platform.openai.com/docs
- OpenRouter: https://openrouter.ai/docs

---

## 🎮 Example Agent Interactions

### Shell Executor Agent

**User**: "Show me all Python files in the current directory"

**Agent**: "I'll use the shell tool to list all Python files."

**Tool Call**: `shell(command="find . -name '*.py' -type f")`

**Result**: Lists all .py files

---

### File Manager Agent

**User**: "Create a TODO list file"

**Agent**: "I'll create a TODO.md file for you."

**Tool Calls**:
1. `write_file(path="TODO.md", content="# TODO List\n\n- [ ] Task 1\n- [ ] Task 2")`
2. `read_file(path="TODO.md")` (to confirm)

**Result**: File created successfully

---

### Browser Agent

**User**: "Search for the latest Python 3.12 features"

**Agent**: "I'll search the web for Python 3.12 features."

**Tool Call**: `web_search(query="Python 3.12 new features", count=5)`

**Result**: Returns top 5 search results with URLs and descriptions

---

**FREQUENCY 187.89 MHz - PICOCLAW INTEGRATED** 🦞
