"""add_unique_constraint_extractions

Revision ID: ce7d65aa0ff9
Revises: d3577afd6bd0
Create Date: 2025-10-05 03:06:45.960587

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ce7d65aa0ff9'
down_revision = 'd3577afd6bd0'
branch_labels = None
depends_on = None


def upgrade():
    # Ajouter la contrainte unique pour supporter ON CONFLICT
    op.create_unique_constraint(
        'uq_extractions_project_pmid',
        'extractions',
        ['project_id', 'pmid'], schema='analylit_schema'
    )


def downgrade():
    # Supprimer la contrainte unique
    op.drop_constraint(
        'uq_extractions_project_pmid', 'extractions', type_='unique', schema='analylit_schema'
    )
