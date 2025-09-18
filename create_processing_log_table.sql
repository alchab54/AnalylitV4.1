CREATE TABLE analylit_schema.processing_log (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR NOT NULL REFERENCES analylit_schema.projects(id),
    article_id VARCHAR,
    task_name VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    message TEXT,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    details TEXT
);
