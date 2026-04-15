"""
ConsentContract — PyTeal smart contract for DataDAO India.

ON-CHAIN DATA DESIGN
====================
Algorand global state has a cost per key-value pair (0.1 ALGO minimum balance
per entry). Storing all nine consent fields on-chain is wasteful and
unnecessary for a compliance proof.

We store only the five fields needed to independently verify a consent event:

  Key                    Value           Why on-chain
  ─────────────────────  ──────────────  ─────────────────────────────────────
  request_id             string          Links this proof to the off-chain record
  consent_status         "approved"      The decision that triggered payment
  price                  string (ALGO)   The agreed compensation amount
  usage_conditions_hash  64-char hex     SHA-256 of canonical consent terms —
                                         anyone can recompute and verify
  timestamp              ISO-8601        When consent was granted

The remaining four fields (user_wallet, company_wallet, data_type, purpose)
are persisted in Supabase (consent_records table) and are referenced via
request_id. They are also embedded in the payment transaction note field for
additional auditability.

Global state schema: 5 byte-slice keys, 0 uint keys.

METHOD
======
recordConsent — NoOp application call

application_args layout (6 total):
  [0]  "recordConsent"        method selector
  [1]  request_id             e.g. "req_1234567890_abc"
  [2]  consent_status         "approved" | "rejected"
  [3]  price                  e.g. "25.5"
  [4]  usage_conditions_hash  64-char SHA-256 hex
  [5]  timestamp              ISO-8601 string

SECURITY
========
- Only the creator account (deployer) may call recordConsent.
- UpdateApplication and DeleteApplication are permanently rejected.
- consent_status is validated to be exactly "approved" or "rejected".
"""

from pyteal import *


def approval_program():
    # Shorthand for reading application arguments
    arg = lambda i: Txn.application_args[i]

    # ── recordConsent ─────────────────────────────────────────────────────────
    record_consent = Seq([
        # Require exactly 6 arguments: selector + 5 proof fields
        Assert(Txn.application_args.length() == Int(6)),

        # Only the deployer account may write consent proofs.
        # This prevents replay attacks or unauthorised overwrites.
        Assert(Txn.sender() == Global.creator_address()),

        # Validate consent_status is a known value
        Assert(
            Or(
                arg(2) == Bytes("approved"),
                arg(2) == Bytes("rejected"),
            )
        ),

        # Write the five proof fields to global state
        App.globalPut(Bytes("request_id"),            arg(1)),
        App.globalPut(Bytes("consent_status"),        arg(2)),
        App.globalPut(Bytes("price"),                 arg(3)),
        App.globalPut(Bytes("usage_conditions_hash"), arg(4)),
        App.globalPut(Bytes("timestamp"),             arg(5)),

        Approve(),
    ])

    # ── Creation ──────────────────────────────────────────────────────────────
    # No initialisation needed; state is written by recordConsent.
    on_create = Approve()

    # ── Router ────────────────────────────────────────────────────────────────
    return Cond(
        [Txn.application_id() == Int(0),                      on_create],
        [Txn.on_completion() == OnComplete.UpdateApplication,  Reject()],
        [Txn.on_completion() == OnComplete.DeleteApplication,  Reject()],
        [Txn.on_completion() == OnComplete.OptIn,              Reject()],
        [Txn.on_completion() == OnComplete.CloseOut,           Reject()],
        [
            And(
                Txn.on_completion() == OnComplete.NoOp,
                arg(0) == Bytes("recordConsent"),
            ),
            record_consent,
        ],
    )


def clear_state_program():
    # No local state — always approve clear
    return Approve()


# ── Compile ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os

    out_dir = os.path.dirname(os.path.abspath(__file__))

    approval_teal = compileTeal(
        approval_program(),
        mode=Mode.Application,
        version=8,   # AVM 8 is live on Algorand Testnet
    )
    clear_teal = compileTeal(
        clear_state_program(),
        mode=Mode.Application,
        version=8,
    )

    approval_path = os.path.join(out_dir, "consent_contract_approval.teal")
    clear_path    = os.path.join(out_dir, "consent_contract_clear.teal")

    with open(approval_path, "w") as f:
        f.write(approval_teal)
    with open(clear_path, "w") as f:
        f.write(clear_teal)

    print(f"[OK] Compiled -> {approval_path}")
    print(f"[OK] Compiled -> {clear_path}")
