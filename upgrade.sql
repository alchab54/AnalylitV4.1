BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> d3577afd6bd0

CREATE TABLE analylit_schema.analysis_profiles (
    id VARCHAR NOT NULL, 
    name VARCHAR NOT NULL, 
    is_custom BOOLEAN, 
    preprocess_model VARCHAR, 
    extract_model VARCHAR, 
    synthesis_model VARCHAR, 
    description TEXT, 
    temperature FLOAT, 
    context_length INTEGER, 
    PRIMARY KEY (id), 
    UNIQUE (name)
);

CREATE TABLE analylit_schema.projects (
    id VARCHAR NOT NULL, 
    name VARCHAR NOT NULL, 
    description TEXT, 
    status VARCHAR, 
    profile_used VARCHAR, 
    job_id VARCHAR, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    synthesis_result TEXT, 
    discussion_draft TEXT, 
    knowledge_graph TEXT, 
    prisma_flow_path VARCHAR, 
    analysis_mode VARCHAR, 
    analysis_result TEXT, 
    analysis_plot_path VARCHAR, 
    pmids_count INTEGER, 
    processed_count INTEGER, 
    total_processing_time FLOAT, 
    indexed_at TIMESTAMP WITHOUT TIME ZONE, 
    search_query TEXT, 
    databases_used TEXT, 
    inter_rater_reliability TEXT, 
    prisma_checklist TEXT, 
    PRIMARY KEY (id)
);

CREATE TABLE analylit_schema.prompts (
    id VARCHAR NOT NULL, 
    name VARCHAR NOT NULL, 
    content TEXT NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (name)
);

CREATE TABLE analylit_schema.analyses (
    id VARCHAR NOT NULL, 
    project_id VARCHAR NOT NULL, 
    analysis_type VARCHAR, 
    results TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id)
);

CREATE TABLE analylit_schema.articles (
    id VARCHAR NOT NULL, 
    project_id VARCHAR NOT NULL, 
    title TEXT, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id)
);

CREATE TABLE analylit_schema.chat_messages (
    id VARCHAR NOT NULL, 
    project_id VARCHAR NOT NULL, 
    role VARCHAR NOT NULL, 
    content TEXT NOT NULL, 
    sources TEXT, 
    timestamp TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id)
);

CREATE TABLE analylit_schema.extraction_grids (
    id VARCHAR NOT NULL, 
    project_id VARCHAR NOT NULL, 
    name VARCHAR NOT NULL, 
    fields TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id)
);

CREATE TABLE analylit_schema.extractions (
    id VARCHAR NOT NULL, 
    project_id VARCHAR, 
    pmid VARCHAR, 
    title TEXT, 
    validation_score FLOAT, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    extracted_data TEXT, 
    relevance_score FLOAT, 
    relevance_justification TEXT, 
    user_validation_status VARCHAR, 
    analysis_source VARCHAR, 
    validations TEXT, 
    user_notes TEXT, 
    stakeholder_perspective VARCHAR, 
    ai_type VARCHAR, 
    platform_used VARCHAR, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id)
);

CREATE TABLE analylit_schema.grey_literature (
    id VARCHAR NOT NULL, 
    project_id VARCHAR NOT NULL, 
    title TEXT NOT NULL, 
    institution VARCHAR, 
    publication_date VARCHAR, 
    url VARCHAR, 
    abstract TEXT, 
    authors TEXT, 
    keywords TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id)
);

CREATE TABLE analylit_schema.prisma_records (
    id VARCHAR NOT NULL, 
    project_id VARCHAR NOT NULL, 
    stage VARCHAR, 
    count INTEGER, 
    details TEXT, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id)
);

CREATE TABLE analylit_schema.processing_log (
    id VARCHAR NOT NULL, 
    pmid VARCHAR, 
    project_id VARCHAR NOT NULL, 
    article_id VARCHAR, 
    task_name VARCHAR NOT NULL, 
    status VARCHAR NOT NULL, 
    message TEXT, 
    timestamp TIMESTAMP WITHOUT TIME ZONE, 
    details TEXT, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id)
);

CREATE TABLE analylit_schema.risk_of_bias (
    id VARCHAR NOT NULL, 
    article_id VARCHAR, 
    project_id VARCHAR NOT NULL, 
    pmid VARCHAR NOT NULL, 
    domain VARCHAR, 
    domain_1_bias VARCHAR, 
    domain_1_justification TEXT, 
    domain_2_bias VARCHAR, 
    domain_2_justification TEXT, 
    judgement VARCHAR, 
    overall_bias VARCHAR, 
    overall_justification TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    assessed_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id), 
    CONSTRAINT uq_rob_project_article UNIQUE (project_id, article_id)
);

CREATE TABLE analylit_schema.screening_decisions (
    id VARCHAR NOT NULL, 
    project_id VARCHAR NOT NULL, 
    pmid VARCHAR NOT NULL, 
    title TEXT, 
    abstract TEXT, 
    decision VARCHAR, 
    reason TEXT, 
    decided_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id), 
    CONSTRAINT uq_project_pmid UNIQUE (project_id, pmid)
);

CREATE TABLE analylit_schema.search_results (
    id VARCHAR NOT NULL, 
    project_id VARCHAR NOT NULL, 
    article_id VARCHAR NOT NULL, 
    title TEXT, 
    abstract TEXT, 
    authors TEXT, 
    publication_date VARCHAR, 
    journal VARCHAR, 
    doi VARCHAR, 
    url VARCHAR, 
    database_source VARCHAR, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    query VARCHAR, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id), 
    CONSTRAINT uq_project_article UNIQUE (project_id, article_id)
);

CREATE TABLE analylit_schema.stakeholders (
    id VARCHAR NOT NULL, 
    project_id VARCHAR NOT NULL, 
    name VARCHAR NOT NULL, 
    role VARCHAR, 
    contact_info TEXT, 
    notes TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(project_id) REFERENCES analylit_schema.projects (id)
);

CREATE TABLE analylit_schema.grid_fields (
    id VARCHAR NOT NULL, 
    grid_id VARCHAR NOT NULL, 
    name VARCHAR NOT NULL, 
    field_type VARCHAR, 
    description TEXT, 
    PRIMARY KEY (id), 
    FOREIGN KEY(grid_id) REFERENCES analylit_schema.extraction_grids (id)
);

CREATE TABLE analylit_schema.validations (
    id VARCHAR NOT NULL, 
    extraction_id VARCHAR NOT NULL, 
    user_id VARCHAR NOT NULL, 
    decision VARCHAR, 
    PRIMARY KEY (id), 
    FOREIGN KEY(extraction_id) REFERENCES analylit_schema.extractions (id)
);

INSERT INTO alembic_version (version_num) VALUES ('d3577afd6bd0') RETURNING alembic_version.version_num;

COMMIT;
