"""Ajoute une contrainte unique sur (project_id, pmid) dans extractions

Revision ID: <your_revision_id>
Revises: <previous_revision_id>
Create Date: <date_and_time>

"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_unique_constraint(
        "uq_extractions_project_pmid",
        "extractions",
        ["project_id", "pmid"],
        schema="analylit_schema"  # Specify the schema
    )


def downgrade():
    op.drop_constraint("uq_extractions_project_pmid", "extractions", schema="analylit_schema")
