"""
Cron Job Scheduler for OpenClaw MGS Codec Dashboard
Handles scheduled tasks with APScheduler
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import asyncio
import logging
from typing import Dict, List, Any, Optional
import subprocess

logger = logging.getLogger(__name__)

class JobScheduler:
    """Manages scheduled jobs for the MGS Codec Dashboard"""

    def __init__(self, db):
        self.scheduler = AsyncIOScheduler()
        self.db = db
        self.jobs_collection = db.scheduled_jobs

    def start(self):
        """Start the scheduler"""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Job scheduler started")

    def shutdown(self):
        """Shutdown the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Job scheduler stopped")

    async def load_jobs_from_db(self):
        """Load all scheduled jobs from database and schedule them"""
        jobs = await self.jobs_collection.find({"enabled": True}).to_list(length=None)
        for job_data in jobs:
            await self._schedule_job_from_data(job_data)
        logger.info(f"Loaded {len(jobs)} scheduled jobs from database")

    async def _schedule_job_from_data(self, job_data: Dict):
        """Schedule a job based on database data"""
        job_id = str(job_data["_id"])
        job_type = job_data["job_type"]
        trigger_type = job_data["trigger_type"]

        # Create trigger
        trigger = self._create_trigger(trigger_type, job_data.get("trigger_config", {}))

        # Schedule job based on type
        if job_type == "agent_task":
            self.scheduler.add_job(
                self._execute_agent_task,
                trigger=trigger,
                args=[job_data],
                id=job_id,
                name=job_data.get("name", "Unnamed Job"),
                replace_existing=True
            )
        elif job_type == "shell_command":
            self.scheduler.add_job(
                self._execute_shell_command,
                trigger=trigger,
                args=[job_data],
                id=job_id,
                name=job_data.get("name", "Unnamed Job"),
                replace_existing=True
            )
        elif job_type == "webhook":
            self.scheduler.add_job(
                self._execute_webhook,
                trigger=trigger,
                args=[job_data],
                id=job_id,
                name=job_data.get("name", "Unnamed Job"),
                replace_existing=True
            )

    def _create_trigger(self, trigger_type: str, config: Dict):
        """Create scheduler trigger from configuration"""
        if trigger_type == "cron":
            return CronTrigger(
                minute=config.get("minute", "*"),
                hour=config.get("hour", "*"),
                day=config.get("day", "*"),
                month=config.get("month", "*"),
                day_of_week=config.get("day_of_week", "*")
            )
        elif trigger_type == "interval":
            return IntervalTrigger(
                seconds=config.get("seconds", 0),
                minutes=config.get("minutes", 0),
                hours=config.get("hours", 0),
                days=config.get("days", 0)
            )
        elif trigger_type == "date":
            run_date = datetime.fromisoformat(config.get("run_date"))
            return DateTrigger(run_date=run_date)
        else:
            raise ValueError(f"Unknown trigger type: {trigger_type}")

    async def _execute_agent_task(self, job_data: Dict):
        """Execute an agent task"""
        try:
            logger.info(f"Executing agent task: {job_data.get('name')}")

            # Update last run time
            await self._update_job_execution(
                str(job_data["_id"]),
                status="running",
                last_run=datetime.utcnow()
            )

            # TODO: Implement actual agent task execution
            # This would create a conversation and send a message to the agent
            agent_id = job_data.get("config", {}).get("agent_id")
            message = job_data.get("config", {}).get("message")

            # Placeholder for actual implementation
            logger.info(f"Agent task would execute: agent={agent_id}, message={message}")

            # Update job status
            await self._update_job_execution(
                str(job_data["_id"]),
                status="completed",
                last_result="Success"
            )

        except Exception as e:
            logger.error(f"Failed to execute agent task: {str(e)}")
            await self._update_job_execution(
                str(job_data["_id"]),
                status="failed",
                last_result=str(e)
            )

    async def _execute_shell_command(self, job_data: Dict):
        """Execute a shell command"""
        try:
            logger.info(f"Executing shell command: {job_data.get('name')}")

            # Update last run time
            await self._update_job_execution(
                str(job_data["_id"]),
                status="running",
                last_run=datetime.utcnow()
            )

            command = job_data.get("config", {}).get("command")

            # Execute command (with safety checks)
            if self._is_safe_command(command):
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=60
                )

                output = result.stdout if result.returncode == 0 else result.stderr

                await self._update_job_execution(
                    str(job_data["_id"]),
                    status="completed" if result.returncode == 0 else "failed",
                    last_result=output[:500]  # Limit to 500 chars
                )
            else:
                raise ValueError("Command contains potentially dangerous operations")

        except Exception as e:
            logger.error(f"Failed to execute shell command: {str(e)}")
            await self._update_job_execution(
                str(job_data["_id"]),
                status="failed",
                last_result=str(e)
            )

    async def _execute_webhook(self, job_data: Dict):
        """Execute a webhook call"""
        try:
            logger.info(f"Executing webhook: {job_data.get('name')}")

            # Update last run time
            await self._update_job_execution(
                str(job_data["_id"]),
                status="running",
                last_run=datetime.utcnow()
            )

            import aiohttp

            url = job_data.get("config", {}).get("url")
            method = job_data.get("config", {}).get("method", "GET")
            headers = job_data.get("config", {}).get("headers", {})
            data = job_data.get("config", {}).get("data", {})

            async with aiohttp.ClientSession() as session:
                async with session.request(method, url, headers=headers, json=data) as response:
                    result_text = await response.text()

                    await self._update_job_execution(
                        str(job_data["_id"]),
                        status="completed" if response.status < 400 else "failed",
                        last_result=f"Status: {response.status}, Response: {result_text[:500]}"
                    )

        except Exception as e:
            logger.error(f"Failed to execute webhook: {str(e)}")
            await self._update_job_execution(
                str(job_data["_id"]),
                status="failed",
                last_result=str(e)
            )

    def _is_safe_command(self, command: str) -> bool:
        """Check if command is safe to execute"""
        # Block dangerous commands
        dangerous_patterns = [
            "rm -rf /",
            "mkfs",
            "dd if=",
            ":(){ :|:& };:",  # Fork bomb
            "chmod -R 777 /",
            "shutdown",
            "reboot",
            "init 0",
            "init 6"
        ]

        command_lower = command.lower()
        for pattern in dangerous_patterns:
            if pattern.lower() in command_lower:
                return False

        return True

    async def _update_job_execution(self, job_id: str, **updates):
        """Update job execution status in database"""
        from bson.objectid import ObjectId
        await self.jobs_collection.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": updates}
        )

    async def create_job(self, job_data: Dict) -> str:
        """Create a new scheduled job"""
        # Add metadata
        job_data["created_at"] = datetime.utcnow()
        job_data["enabled"] = job_data.get("enabled", True)
        job_data["status"] = "pending"

        # Insert into database
        result = await self.jobs_collection.insert_one(job_data)
        job_id = str(result.inserted_id)

        # Schedule the job
        if job_data["enabled"]:
            job_data["_id"] = result.inserted_id
            await self._schedule_job_from_data(job_data)

        return job_id

    async def delete_job(self, job_id: str):
        """Delete a scheduled job"""
        from bson.objectid import ObjectId

        # Remove from scheduler
        try:
            self.scheduler.remove_job(job_id)
        except:
            pass  # Job might not be scheduled

        # Remove from database
        await self.jobs_collection.delete_one({"_id": ObjectId(job_id)})

    async def toggle_job(self, job_id: str, enabled: bool):
        """Enable or disable a job"""
        from bson.objectid import ObjectId

        await self.jobs_collection.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"enabled": enabled}}
        )

        if enabled:
            # Schedule the job
            job_data = await self.jobs_collection.find_one({"_id": ObjectId(job_id)})
            if job_data:
                await self._schedule_job_from_data(job_data)
        else:
            # Remove from scheduler
            try:
                self.scheduler.remove_job(job_id)
            except:
                pass

    async def list_jobs(self) -> List[Dict]:
        """List all scheduled jobs"""
        jobs = await self.jobs_collection.find().to_list(length=None)

        # Add next run time from scheduler
        for job in jobs:
            job["_id"] = str(job["_id"])
            try:
                scheduled_job = self.scheduler.get_job(job["_id"])
                if scheduled_job:
                    job["next_run"] = scheduled_job.next_run_time.isoformat() if scheduled_job.next_run_time else None
                else:
                    job["next_run"] = None
            except:
                job["next_run"] = None

        return jobs

    async def get_job(self, job_id: str) -> Optional[Dict]:
        """Get a specific job"""
        from bson.objectid import ObjectId
        job = await self.jobs_collection.find_one({"_id": ObjectId(job_id)})
        if job:
            job["_id"] = str(job["_id"])

            # Add next run time
            try:
                scheduled_job = self.scheduler.get_job(job_id)
                if scheduled_job:
                    job["next_run"] = scheduled_job.next_run_time.isoformat() if scheduled_job.next_run_time else None
            except:
                job["next_run"] = None

        return job


# Global scheduler instance
job_scheduler: Optional[JobScheduler] = None

def get_scheduler() -> JobScheduler:
    """Get the global scheduler instance"""
    return job_scheduler
