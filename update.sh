#!/bin/bash

# OpenClaw MGS Codec - Auto Update Script
# Checks for updates from GitHub and applies them automatically

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Banner
echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🦞 OpenClaw MGS Codec - AUTO UPDATE                ║
║   FREQUENCY 187.89 MHz - CODEC SYNC ACTIVE           ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${CYAN}📍 Project Directory: ${PROJECT_DIR}${NC}"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed. Please install git first.${NC}"
    exit 1
fi

# Check if this is a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Not a git repository. Cannot update.${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[1/5] Checking Current Status...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "  ${CYAN}Current branch:${NC} ${GREEN}$CURRENT_BRANCH${NC}"

# Get current commit
CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo -e "  ${CYAN}Current commit:${NC} ${GREEN}$CURRENT_COMMIT${NC}"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "  ${YELLOW}⚠${NC}  You have uncommitted changes"
    echo ""
    echo -e "${YELLOW}Would you like to stash your changes before updating? [y/N]${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        git stash push -m "Auto-stashed by update.sh at $(date)"
        echo -e "  ${GREEN}✓${NC} Changes stashed"
        STASHED=true
    else
        echo -e "  ${CYAN}Continuing with uncommitted changes...${NC}"
        STASHED=false
    fi
else
    echo -e "  ${GREEN}✓${NC} Working tree is clean"
    STASHED=false
fi

echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[2/5] Fetching Updates from GitHub...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Fetch with retry logic
MAX_RETRIES=4
RETRY_DELAY=2

for i in $(seq 1 $MAX_RETRIES); do
    if git fetch origin 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Successfully fetched from origin"
        break
    else
        if [ $i -lt $MAX_RETRIES ]; then
            echo -e "  ${YELLOW}⚠${NC}  Fetch failed, retrying in ${RETRY_DELAY}s... (attempt $i/$MAX_RETRIES)"
            sleep $RETRY_DELAY
            RETRY_DELAY=$((RETRY_DELAY * 2))
        else
            echo -e "  ${RED}❌ Failed to fetch after $MAX_RETRIES attempts${NC}"
            exit 1
        fi
    fi
done

echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[3/5] Checking for Updates...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if remote branch exists
if ! git rev-parse --verify origin/$CURRENT_BRANCH &>/dev/null; then
    echo -e "  ${YELLOW}⚠${NC}  Remote branch 'origin/$CURRENT_BRANCH' does not exist"
    echo -e "  ${CYAN}This might be a new local branch${NC}"
    exit 0
fi

# Compare local and remote
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/$CURRENT_BRANCH)

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    echo -e "  ${GREEN}✓${NC} Already up to date!"
    echo -e "  ${CYAN}No updates available${NC}"

    if [ "$STASHED" = true ]; then
        echo ""
        echo -e "${CYAN}Restoring stashed changes...${NC}"
        git stash pop
        echo -e "  ${GREEN}✓${NC} Changes restored"
    fi

    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ No Updates Required${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    exit 0
fi

# Show what will be updated
COMMITS_BEHIND=$(git rev-list --count HEAD..origin/$CURRENT_BRANCH)
echo -e "  ${CYAN}Updates available:${NC} ${YELLOW}$COMMITS_BEHIND new commit(s)${NC}"
echo ""
echo -e "  ${CYAN}Recent changes:${NC}"
git log --oneline --decorate --color=always HEAD..origin/$CURRENT_BRANCH | head -n 10 | sed 's/^/    /'
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[4/5] Applying Updates...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if services are running
SERVICES_RUNNING=false
if pgrep -f "uvicorn.*server:app" > /dev/null || pgrep -f "npm.*start" > /dev/null; then
    SERVICES_RUNNING=true
    echo -e "  ${YELLOW}⚠${NC}  Services are running. They will be restarted after update."
    echo ""
    echo -e "  ${CYAN}Stopping services...${NC}"
    ./stop.sh > /dev/null 2>&1 || true
    echo -e "  ${GREEN}✓${NC} Services stopped"
fi

# Pull changes with retry logic
RETRY_DELAY=2
for i in $(seq 1 $MAX_RETRIES); do
    if git pull origin $CURRENT_BRANCH 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Successfully pulled updates"
        PULL_SUCCESS=true
        break
    else
        if [ $i -lt $MAX_RETRIES ]; then
            echo -e "  ${YELLOW}⚠${NC}  Pull failed, retrying in ${RETRY_DELAY}s... (attempt $i/$MAX_RETRIES)"
            sleep $RETRY_DELAY
            RETRY_DELAY=$((RETRY_DELAY * 2))
        else
            echo -e "  ${RED}❌ Failed to pull after $MAX_RETRIES attempts${NC}"
            PULL_SUCCESS=false
        fi
    fi
done

if [ "$PULL_SUCCESS" = false ]; then
    echo -e "${RED}Update failed. Please check your connection and try again.${NC}"
    exit 1
fi

# Get new commit
NEW_COMMIT=$(git rev-parse --short HEAD)
echo -e "  ${CYAN}Updated to commit:${NC} ${GREEN}$NEW_COMMIT${NC}"

# Check if package files changed
if git diff --name-only $CURRENT_COMMIT HEAD | grep -qE "package.json|requirements.txt"; then
    echo ""
    echo -e "  ${YELLOW}⚠${NC}  Dependencies may have changed"
    echo -e "  ${CYAN}Consider running:${NC} ${GREEN}./install.sh${NC}"
fi

echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[5/5] Post-Update Tasks...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Restore stashed changes
if [ "$STASHED" = true ]; then
    echo -e "  ${CYAN}Restoring stashed changes...${NC}"
    if git stash pop; then
        echo -e "  ${GREEN}✓${NC} Changes restored"
    else
        echo -e "  ${YELLOW}⚠${NC}  Conflicts detected. Please resolve manually:"
        echo -e "      ${CYAN}git status${NC}"
    fi
fi

# Restart services if they were running
if [ "$SERVICES_RUNNING" = true ]; then
    echo -e "  ${CYAN}Restarting services...${NC}"
    ./start.sh > /dev/null 2>&1 &
    echo -e "  ${GREEN}✓${NC} Services restarting in background"
fi

echo ""

# Summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Update Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}📊 Update Summary:${NC}"
echo -e "  ${CYAN}Previous commit:${NC} ${YELLOW}$CURRENT_COMMIT${NC}"
echo -e "  ${CYAN}Current commit:${NC}  ${GREEN}$NEW_COMMIT${NC}"
echo -e "  ${CYAN}Commits pulled:${NC}  ${GREEN}$COMMITS_BEHIND${NC}"
echo ""

echo -e "${CYAN}📝 Changes applied:${NC}"
git diff --stat $CURRENT_COMMIT HEAD | sed 's/^/  /'
echo ""

echo -e "${CYAN}💡 What to do next:${NC}"
if git diff --name-only $CURRENT_COMMIT HEAD | grep -qE "package.json|requirements.txt"; then
    echo -e "  ${YELLOW}1.${NC} Run ${GREEN}./install.sh${NC} to update dependencies"
    echo -e "  ${YELLOW}2.${NC} Check the changelog for breaking changes"
else
    echo -e "  ${GREEN}✓${NC} No action required - system is ready!"
fi

if [ "$SERVICES_RUNNING" = true ]; then
    echo -e "  ${CYAN}Services are restarting...${NC}"
fi

echo ""
echo -e "${GREEN}FREQUENCY 187.89 MHz - CODEC SYNCHRONIZED${NC} 🦞"
echo ""
