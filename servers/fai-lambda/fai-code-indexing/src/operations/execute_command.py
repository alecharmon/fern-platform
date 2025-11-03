import asyncio
import shlex
from typing import Any


async def call_shell_command(command: str, working_dir: str) -> dict[str, Any]:
    """Execute a shell command asynchronously."""
    try:
        args = shlex.split(command)
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=working_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()
        return {
            "stdout": stdout.decode() if stdout else "",
            "stderr": stderr.decode() if stderr else "",
            "returncode": proc.returncode,
        }
    except Exception as e:
        raise RuntimeError(f"Failed to execute command: {e}")
