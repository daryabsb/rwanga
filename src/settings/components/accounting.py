from decouple import config

# ── Payroll Finance Audit Gate ────────────────────────────────────────────────
# When True (default): Finance must manually audit each PayrollBatch before
# PAYROLL_RUN_POST is dispatched and the JournalEntry is created.
# When False: PayrollAuditRecord is auto-approved immediately on creation;
# posting proceeds automatically. Record is still created with auto_approved=True
# and note "Audit skipped by company setting".
# Future: per-company override will live in a CompanyConfiguration model.
ACCOUNTING_REQUIRE_PAYROLL_AUDIT = config(
    'ACCOUNTING_REQUIRE_PAYROLL_AUDIT', default=True, cast=bool
)

# ── Integration Envelope Feature Flags ───────────────────────────────────────
# Set to True to enable live dispatch for each intent's envelope handler.
# Keep False in dev until the handler is fully tested in the target environment.

# PAYROLL_APPROVED_NOTIFY_FINANCE — notifies Finance when a batch is approved.
# Creates InboxReceipt; triggers auto-approve path if ACCOUNTING_REQUIRE_PAYROLL_AUDIT=False.
INTEGRATION_ENABLE_PAYROLL_APPROVED_NOTIFY_DISPATCH = config(
    'INTEGRATION_ENABLE_PAYROLL_APPROVED_NOTIFY_DISPATCH', default=False, cast=bool
)
