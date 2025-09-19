CREATE TABLE search_results (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    query VARCHAR(500) NOT NULL,
    database_name VARCHAR(50) NOT NULL,
    total_results INTEGER DEFAULT 0,
    results_data TEXT, -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);