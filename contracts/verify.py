"""
verify.py — Verify a deployed ConsentContract on Algorand Testnet.

Reads the app's global state and prints all stored consent fields.
Use this after deploy.py to confirm the contract is live, and after
a consent recording to confirm the fields were written correctly.

Usage:
  python verify.py <APP_ID>

  # or read from env:
  export ALGORAND_APP_ID=12345678
  python verify.py
"""

import os
import sys
import base64

try:
    from algosdk.v2client import algod as algod_client
except ImportError:
    print("❌  py-algorand-sdk not installed.  Run:  pip install py-algorand-sdk")
    sys.exit(1)

ALGORAND_SERVER = os.getenv("ALGORAND_SERVER", "https://testnet-api.algonode.cloud")
ALGORAND_TOKEN  = os.getenv("ALGORAND_TOKEN",  "a" * 64)
ALGORAND_PORT   = os.getenv("ALGORAND_PORT",   "")


def build_client():
    server = ALGORAND_SERVER.rstrip("/")
    port   = f":{ALGORAND_PORT}" if ALGORAND_PORT else ""
    return algod_client.AlgodClient(ALGORAND_TOKEN, f"{server}{port}")


def decode_value(state_val):
    """Decode a global state value (bytes or uint)."""
    if state_val["type"] == 1:  # bytes
        raw = base64.b64decode(state_val["bytes"])
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.hex()
    return state_val["uint"]  # uint


def main():
    app_id_str = sys.argv[1] if len(sys.argv) > 1 else os.getenv("ALGORAND_APP_ID", "")
    if not app_id_str:
        print("Usage:  python verify.py <APP_ID>")
        print("   or:  export ALGORAND_APP_ID=<id> && python verify.py")
        sys.exit(1)

    try:
        app_id = int(app_id_str)
    except ValueError:
        print(f"❌  Invalid App ID: {app_id_str}")
        sys.exit(1)

    client = build_client()

    try:
        info = client.application_info(app_id)
    except Exception as e:
        print(f"❌  Could not fetch app {app_id}: {e}")
        print("    Is the App ID correct and deployed to Testnet?")
        sys.exit(1)

    params = info.get("params", {})
    creator = params.get("creator", "unknown")
    global_state = params.get("global-state", [])

    print()
    print("=" * 60)
    print(f"✅  ConsentContract — App ID: {app_id}")
    print("=" * 60)
    print(f"   Creator : {creator}")
    print(f"   Explorer: https://testnet.explorer.perawallet.app/application/{app_id}")
    print()

    if not global_state:
        print("   Global state is empty (no consent recorded yet).")
    else:
        print("   Global state:")
        for entry in global_state:
            key   = base64.b64decode(entry["key"]).decode("utf-8", errors="replace")
            value = decode_value(entry["value"])
            print(f"     {key:<26} = {value}")

    print()


if __name__ == "__main__":
    main()
