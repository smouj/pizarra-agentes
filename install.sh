#!/bin/bash

# OpenClaw MGS Codec Dashboard - One-Command Installation Script
# Integrates PicoClaw AI Agent Framework

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🦞 OpenClaw MGS Codec Dashboard                    ║
║   with PicoClaw AI Agent Framework                   ║
║                                                       ║
║   FREQUENCY 187.89 MHz - CODEC ACTIVE                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}⚠️  Please do not run this script as root${NC}"
    exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${CYAN}📍 Installation Directory: ${PROJECT_DIR}${NC}"
echo ""

# Step 1: Check Prerequisites
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[1/7] Checking Prerequisites...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} $1 is installed"
        return 0
    else
        echo -e "  ${RED}✗${NC} $1 is NOT installed"
        return 1
    fi
}

MISSING_DEPS=0

check_command python3 || MISSING_DEPS=1
check_command node || MISSING_DEPS=1
check_command npm || MISSING_DEPS=1
check_command mongod || MISSING_DEPS=1

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo -e "${RED}❌ Missing dependencies. Please install the following:${NC}"
    echo -e "   - Python 3.11+"
    echo -e "   - Node.js 16+"
    echo -e "   - npm"
    echo -e "   - MongoDB"
    exit 1
fi

echo ""

# Step 2: Install Backend Dependencies
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[2/7] Installing Backend Dependencies...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$PROJECT_DIR/backend"

if [ ! -d "venv" ]; then
    echo -e "  ${CYAN}Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

echo -e "  ${CYAN}Activating virtual environment...${NC}"
source venv/bin/activate

echo -e "  ${CYAN}Installing Python packages...${NC}"
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo -e "  ${GREEN}✓${NC} Backend dependencies installed"
echo ""

# Step 3: Install Frontend Dependencies
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[3/7] Installing Frontend Dependencies...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$PROJECT_DIR/frontend"

echo -e "  ${CYAN}Installing npm packages...${NC}"
npm install --silent

echo -e "  ${GREEN}✓${NC} Frontend dependencies installed"
echo ""

# Step 4: MongoDB Setup
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[4/7] Setting up MongoDB...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if MongoDB is running
if pgrep -x "mongod" > /dev/null; then
    echo -e "  ${GREEN}✓${NC} MongoDB is already running"
else
    echo -e "  ${YELLOW}⚠${NC}  MongoDB is not running"
    echo -e "  ${CYAN}Attempting to start MongoDB...${NC}"

    # Try to start MongoDB (different methods for different systems)
    if command -v systemctl &> /dev/null; then
        sudo systemctl start mongod 2>/dev/null || true
    elif command -v service &> /dev/null; then
        sudo service mongod start 2>/dev/null || true
    fi

    sleep 2

    if pgrep -x "mongod" > /dev/null; then
        echo -e "  ${GREEN}✓${NC} MongoDB started successfully"
    else
        echo -e "  ${YELLOW}⚠${NC}  Could not auto-start MongoDB"
        echo -e "  ${CYAN}Please start MongoDB manually:${NC}"
        echo -e "    sudo systemctl start mongod"
    fi
fi

echo ""

# Step 5: Configuration Wizard
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[5/7] Configuration Setup...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$PROJECT_DIR"

# Run configuration wizard
python3 scripts/setup_wizard.py

echo ""

# Step 6: Initialize Database
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[6/7] Initializing Database...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$PROJECT_DIR/backend"
source venv/bin/activate

echo -e "  ${CYAN}Setting up database schema and default agents...${NC}"
python3 -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def init_db():
    MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017/openclaw_db')
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.openclaw_db

    # Check if agents already exist
    count = await db.agents.count_documents({})
    if count > 0:
        print('  ✓ Database already initialized')
        return

    # Create default agents
    from server import DEFAULT_AGENTS
    for agent_data in DEFAULT_AGENTS:
        await db.agents.insert_one(agent_data)

    print('  ✓ Database initialized with default agents')

asyncio.run(init_db())
" 2>/dev/null || echo -e "  ${YELLOW}⚠${NC}  Database initialization skipped (will init on first run)"

echo ""

# Step 7: Build Frontend
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[7/7] Building Frontend...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$PROJECT_DIR/frontend"

echo -e "  ${CYAN}Building React application...${NC}"
npm run build --silent 2>/dev/null || echo -e "  ${YELLOW}⚠${NC}  Build will happen on first run"

echo ""

# Installation Complete
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Installation Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}📋 Next Steps:${NC}"
echo ""
echo -e "  ${YELLOW}1.${NC} Start the application:"
echo -e "     ${GREEN}./start.sh${NC}"
echo ""
echo -e "  ${YELLOW}2.${NC} Open your browser:"
echo -e "     ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "  ${YELLOW}3.${NC} Configure your API token:"
echo -e "     Click the 🔒 TOKEN button and enter:"
echo -e "     ${GREEN}anthropic:sk-ant-api03-xxxxx${NC}  (for Claude)"
echo -e "     ${GREEN}openai:sk-xxxxx${NC}              (for GPT-4)"
echo ""
echo -e "${CYAN}📚 Documentation:${NC}"
echo -e "     ${GREEN}README.md${NC}                    - Main documentation"
echo -e "     ${GREEN}PICOCLAW_INTEGRATION.md${NC}      - PicoClaw integration guide"
echo ""
echo -e "${CYAN}🔧 Useful Commands:${NC}"
echo -e "     ${GREEN}./start.sh${NC}                   - Start all services"
echo -e "     ${GREEN}./stop.sh${NC}                    - Stop all services"
echo -e "     ${GREEN}./logs.sh${NC}                    - View logs"
echo ""
echo -e "${GREEN}FREQUENCY 187.89 MHz - CODEC READY${NC} 🦞"
echo ""
