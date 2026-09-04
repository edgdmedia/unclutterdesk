import json
import os
import signal
import subprocess
import time
import urllib.request


def request(path, host="localhost"):
    req = urllib.request.Request(f"http://localhost:3001{path}", headers={"Host": host})
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, response.read().decode()
    except Exception as error:
        if hasattr(error, "read"):
            return error.code, error.read().decode()
        return None, str(error)


process = subprocess.Popen(
    ["stdbuf", "-oL", "-eL", "pnpm", "--filter", "@unclutterdesk/api", "dev"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    start_new_session=True,
)

try:
    for _ in range(60):
        status, _ = request("/health")
        if status is not None:
            break
        time.sleep(0.5)

    for path, host in [
        ("/health", "localhost"),
        ("/v1/auth/status", "localhost"),
        ("/v1/tenant/public/info/demo", "demo.localhost"),
        ("/v1/consult/public/therapists", "demo.localhost"),
    ]:
        status, body = request(path, host)
        print(json.dumps({"path": path, "host": host, "status": status, "body": body}))
finally:
    os.killpg(process.pid, signal.SIGTERM)
    output, _ = process.communicate(timeout=10)
    print("--- API LOG ---")
    print(output)
