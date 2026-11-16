"""Structured prices on providers, so search can filter and sort by price.

- price_amount:   a number > 0, e.g. 15.00 (NULL = no structured price)
- price_unit:     what the amount is for: hour, visit, job, item or month
- price_currency: USD (default) or LBP
price_text stays as the free-text description shown on the profile.
Amount and unit are set together or not at all.
The SQL matches docs/SCHEMA.md.

Revision ID: 0005
Revises: 0004
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE providers
            ADD COLUMN price_amount NUMERIC(12, 2)
                CONSTRAINT providers_price_amount_check CHECK (price_amount > 0),
            ADD COLUMN price_unit TEXT
                CONSTRAINT providers_price_unit_check
                CHECK (price_unit IN ('hour', 'visit', 'job', 'item', 'month')),
            ADD COLUMN price_currency TEXT NOT NULL DEFAULT 'USD'
                CONSTRAINT providers_price_currency_check
                CHECK (price_currency IN ('USD', 'LBP')),
            ADD CONSTRAINT providers_price_amount_unit_together
                CHECK ((price_amount IS NULL) = (price_unit IS NULL))
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE providers
            DROP CONSTRAINT providers_price_amount_unit_together,
            DROP COLUMN price_currency,
            DROP COLUMN price_unit,
            DROP COLUMN price_amount
        """
    )
