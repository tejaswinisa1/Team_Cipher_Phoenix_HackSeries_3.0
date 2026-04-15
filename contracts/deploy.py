"""
deploy.py -- Deploy ConsentContract to Algorand Testnet.

Steps:
  1. Compile consent_contract.py -> approval.teal + clear.teal
  2. Assemble TEAL via algod
  3. Create the application on-chain
  4. Wait for confirmation
  5. Print the App ID and exact env line to copy

Usage:
  cd contracts
  pip install -r requirements.txt
  $env:DEPLOYER_MNEMONIC="word1 word2 ... word25"   (PowerShell)
  python deploy.py

Optional env vars (defaults shown):
  ALGORAND_SERVER   https://testnet-api.algonode.cloud
  ALGORAND_TOKEN    (64 a's -- correct for algonode public endpoint)
  ALGORAND_PORT     (empty -- algonode uses HTTPS default port)
"""

import os
import sys
import subprocess
import base64

# -- Dependency check ----------------------------------------------------------

try:
    import algosdk
    from algosdk.v2client import algod as algod_client
    from algosdk import transaction, mnemonic as mnemonic_mod, account as account_mod
except ImportError:
    print("ERROR: py-algorand-sdk not installed.")
    print("  Run:  pip install py-algorand-sdk")
    sys.exit(1)

try:
    import pyteal  # noqa: F401
except ImportError:
    print("ERROR: pyteal not installed.")
    print("  Run:  pip install pyteal")
    sys.exit(1)

# -- Config --------------------------------------------------------------------

ALGORAND_SERVER   = os.getenv("ALGORAND_SERVER",   "https://testnet-api.algonode.cloud")
ALGORAND_TOKEN    = os.getenv("ALGORAND_TOKEN",    "a" * 64)
ALGORAND_PORT     = os.getenv("ALGORAND_PORT",     "")
DEPLOYER_MNEMONIC = os.getenv("DEPLOYER_MNEMONIC", "")

CONTRACTS_DIR = os.path.dirname(os.path.abspath(__file__))
APPROVAL_TEAL = os.path.join(CONTRACTS_DIR, "consent_contract_approval.teal")
CLEAR_TEAL    = os.path.join(CONTRACTS_DIR, "consent_contract_clear.teal")

# 5 byte-slice global state keys, 0 uints, no local state
GLOBAL_SCHEMA = transaction.StateSchema(num_uints=0, num_byte_slices=5)
LOCAL_SCHEMA  = transaction.StateSchema(num_uints=0, num_byte_slices=0)

# -- Helpers -------------------------------------------------------------------

def build_client():
    server = ALGORAND_SERVER.rstrip("/")
    port   = f":{ALGORAND_PORT}" if ALGORAND_PORT else ""
    return algod_client.AlgodClient(ALGORAND_TOKEN, f"{server}{port}")


def compile_pyteal():
    """Run consent_contract.py to emit TEAL source files."""
    print("Compiling PyTeal -> TEAL...")
    result = subprocess.run(
        [sys.executable, os.path.join(CONTRACTS_DIR, "consent_contract.py")],
        capture_output=True, text=True, env={**os.environ, "PYTHONIOENCODING": "utf-8"}
    )
    if result.returncode != 0:
        print(f"ERROR: PyTeal compilation failed:\n{result.stderr}")
        sys.exit(1)
    print(result.stdout.strip())


def assemble_teal(client, teal_path):
    """Assemble a TEAL source file via algod; return binary bytecode."""
    with open(teal_path) as f:
        source = f.read()
    response = client.compile(source)
    return base64.b64decode(response["result"])


def wait_for_confirmation(client, tx_id, max_rounds=10):
    """Poll until the transaction is confirmed."""
    if hasattr(transaction, "wait_for_confirmation"):
        return transaction.wait_for_confirmation(client, tx_id, max_rounds)

    # Fallback: manual polling
    last_round = client.status()["last-round"]
    while True:
        info = client.pending_transaction_info(tx_id)
        if info.get("confirmed-round", 0) > 0:
            return info
        if info.get("pool-error"):
            raise Exception(f"Transaction rejected: {info['pool-error']}")
        client.status_after_block(last_round + 1)
        last_round += 1


def deploy(client, deployer_sk, deployer_addr):
    """Create the ConsentContract application on-chain."""
    print(f"Deploying from: {deployer_addr}")

    approval_binary = assemble_teal(client, APPROVAL_TEAL)
    clear_binary    = assemble_teal(client, CLEAR_TEAL)

    sp = client.suggested_params()

    txn = transaction.ApplicationCreateTxn(
        sender=deployer_addr,
        sp=sp,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_binary,
        clear_program=clear_binary,
        global_schema=GLOBAL_SCHEMA,
        local_schema=LOCAL_SCHEMA,
    )

    signed = txn.sign(deployer_sk)
    tx_id  = client.send_raw_transaction(algosdk.encoding.msgpack_encode(signed))
    print(f"Transaction submitted: {tx_id}")

    confirmed = wait_for_confirmation(client, tx_id)
    app_id    = confirmed["application-index"]

    explorer_app = f"https://testnet.explorer.perawallet.app/application/{app_id}"
    explorer_tx  = f"https://testnet.explorer.perawallet.app/tx/{tx_id}"

    print()
    print("=" * 60)
    print("ConsentContract deployed successfully!")
    print("=" * 60)
    print(f"  App ID      : {app_id}")
    print(f"  Deploy TX   : {tx_id}")
    print(f"  App Explorer: {explorer_app}")
    print(f"  TX Explorer : {explorer_tx}")
    print()
    print("Next step -- add this line to backend/.env:")
    print()
    print(f"  ALGORAND_APP_ID={app_id}")
    print()
    print("Then restart the backend server.")
    print("=" * 60)

    return app_id


# -- Entry point ---------------------------------------------------------------

def main():
    if not DEPLOYER_MNEMONIC:
        print()
        print("ERROR: DEPLOYER_MNEMONIC is not set.")
        print()
        print("  Steps:")
        print("  1. Go to https://bank.testnet.algorand.network/")
        print("  2. Create a Testnet wallet and fund it")
        print("  3. Export the 25-word mnemonic")
        print()
        print("  Then run (PowerShell):")
        print('  $env:DEPLOYER_MNEMONIC="word1 word2 ... word25"')
        print("  python deploy.py")
        print()
        sys.exit(1)

    deployer_sk   = mnemonic_mod.to_private_key(DEPLOYER_MNEMONIC)
    deployer_addr = account_mod.address_from_private_key(deployer_sk)

    client = build_client()

    try:
        status = client.status()
        print(f"Connected to Algorand Testnet (round {status['last-round']})")
    except Exception as e:
        print(f"ERROR: Cannot connect to Algorand node: {e}")
        sys.exit(1)

    compile_pyteal()
    deploy(client, deployer_sk, deployer_addr)


if __name__ == "__main__":
    main()
