"""add_unique_constraint_extractions

Revision ID: your_revision_id
Revises: <previous_revision_id>
Create Date: <date_and_time>

"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    """Ajouter la contrainte unique pour supporter ON CONFLICT"""
    op.create_unique_constraint(
        'uq_extractions_project_pmid', 'extractions', ['project_id', 'pmid'], schema='analylit_schema'
    )

def downgrade():
    """Supprimer la contrainte unique"""
    op.drop_constraint(
        'uq_extractions_project_pmid', 'extractions', type_='unique', schema='analylit_schema'
    )
