# 🚀 Quick Start Guide

## One-Command Installation

```bash
git clone https://github.com/smouj/pizarra-agentes.git
cd pizarra-agentes
chmod +x install.sh && ./install.sh
```

That's it! The installation script will:
- ✅ Check prerequisites (Python 3.11+, Node.js 16+, MongoDB)
- ✅ Install all dependencies (backend & frontend)
- ✅ Run interactive configuration wizard
- ✅ Initialize database with default agents
- ✅ Build the frontend application

---

## Starting the Dashboard

```bash
./start.sh
```

Then open your browser: **http://localhost:3000**

---

## Configure Your API Token

### Supported Providers

**Format**: `provider:api_key`

| Provider | Token Format | Model |
|----------|--------------|-------|
| **Anthropic Claude** | `anthropic:sk-ant-api03-xxxxx` | claude-3-5-sonnet-20241022 |
| **OpenAI** | `openai:sk-xxxxx` | gpt-4o |
| **OpenRouter** | `openrouter:sk-or-v1-xxxxx` | Multi-model support |

**Default**: If no provider prefix, defaults to Anthropic.

### How to Configure

1. Click the 🔒 **TOKEN** button in the dashboard
2. Enter your token (e.g., `anthropic:sk-ant-api03-xxxxx`)
3. Click **SAVE TOKEN**
4. Token is encrypted and stored securely

---

## Example Usage

### 1. Shell Executor Agent

**User**: "List all Python files in this directory"

**Agent**:
- Executes: `find . -name "*.py" -type f`
- Returns: List of .py files

### 2. File Manager Agent

**User**: "Create a README file with project information"

**Agent**:
- Creates: `README.md` with content
- Confirms: File created successfully

### 3. Browser Agent

**User**: "Search for the latest Python features"

**Agent**:
- Searches: Web using Brave Search API
- Returns: Top 5 results with URLs

---

## Management Commands

```bash
# Start all services
./start.sh

# Stop all services
./stop.sh

# View logs
./logs.sh

# Reinstall/reconfigure
./install.sh
```

---

## System Requirements

### Minimum
- **OS**: Linux, macOS, Windows (WSL)
- **CPU**: 2 cores
- **RAM**: 2GB
- **Disk**: 1GB free space

### Software
- Python 3.11+
- Node.js 16+
- npm or yarn
- MongoDB 4.4+

---

## Troubleshooting

### MongoDB Not Running

```bash
# Start MongoDB
sudo systemctl start mongod

# Or on macOS
brew services start mongodb-community
```

### Port Already in Use

```bash
# Check what's using port 8001
lsof -i :8001

# Check what's using port 3000
lsof -i :3000
```

### Clear and Reinstall

```bash
./stop.sh
rm -rf backend/venv frontend/node_modules
./install.sh
```

---

## What's Next?

- 📖 Read the full [README.md](./README.md)
- 🦞 Learn about [PicoClaw Integration](./PICOCLAW_INTEGRATION.md)
- 🎮 Explore the 6 specialized agents
- 🛠️ Customize agent workspaces
- 📝 Create bootstrap files (IDENTITY.md, SOUL.md)

---

**FREQUENCY 187.89 MHz - CODEC READY** 🦞
