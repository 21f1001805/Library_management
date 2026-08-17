import subprocess
import os
import sys

try:
    # Start PostgreSQL
    subprocess.run(
        ["docker", "compose", "up", "-d", "--wait", "db"],
        check=True,
    )

    # Move to the backend directory
    os.chdir("backend")

    # Apply pending database migrations
    subprocess.run(["uv", "run", "prisma", "migrate", "deploy"], check=True)

    # Start the FastAPI server
    subprocess.run(
        [
            "uv",
            "run",
            "uvicorn",
            "app.main:app",
            "--app-dir",
            "src",
            "--reload",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ],
        check=True,
    )

except FileNotFoundError as e:
    print(f"\n❌ Required command not found: {e.filename}")
    print("Make sure Docker and uv are installed and available in your PATH.")
    sys.exit(1)

except subprocess.CalledProcessError as e:
    print(f"\n❌ Command failed with exit code {e.returncode}.")
    sys.exit(e.returncode)

except KeyboardInterrupt:
    print("\n🛑 Backend stopped.")