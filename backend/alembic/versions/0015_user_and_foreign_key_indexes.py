"""Indexes for deleting an account, and for two foreign keys.

DELETE /me removes a user's reviews and claims by user_id. The existing
indexes on those tables start with provider_id, so without these the
database would read every row. (follows and hire_checks already have an
index starting with user_id.)

Supabase's Performance Advisor also lists two foreign keys without an index
("Unindexed foreign keys"). Deleting a category would then scan the child
table for every row it touches.

The tables are small today, so plain CREATE INDEX (a short lock) is fine.

Revision ID: 0015
Revises: 0014
"""

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

INDEXES = {
    "reviews_user_idx": "reviews (user_id)",
    "claims_user_idx": "claims (user_id)",
    "categories_parent_idx": "categories (parent_id)",
    "provider_suggestions_category_idx": "provider_suggestions (category_id)",
}


def upgrade() -> None:
    for name, target in INDEXES.items():
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {target}")


def downgrade() -> None:
    for name in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
