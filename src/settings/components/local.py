import os


# LOCAL OVERRIDES - DO NOT COMMIT TO PRODUCTION
# This file is imported last by split-settings so local-only flags can override
# shared defaults without changing common.py.
TICQC_COMPANY_ID = int(os.getenv("TICQC_COMPANY_ID", "0") or "0")

POLICY_20_ENABLED_KEYS = []  # Keep global Policy 2.0 routing OFF.

# Policy 2.3 — company-level enable list.
# Add company slugs to enable v23 workspace access for those companies.
# Empty list = v23 accessible to all companies (no gate).
# Example: POLICY_V23_ENABLED_COMPANIES = ["tic"]
POLICY_V23_ENABLED_COMPANIES = []
POLICY_20_COMPANY_OVERRIDES = (
    {TICQC_COMPANY_ID: ["HR_ONBOARDING"]}
    if TICQC_COMPANY_ID
    else {}
)
