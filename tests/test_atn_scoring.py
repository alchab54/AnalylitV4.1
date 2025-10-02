# test_atn_scoring.py (Rewritten)
import pytest
import json
import uuid
from sqlalchemy import text
from backend.tasks_v4_complete import run_atn_score_task

def test_run_atn_score_task_no_extractions(db_session):
    """Test that the task handles projects with no extractions."""
    project_id = str(uuid.uuid4())
    db_session.execute(text("INSERT INTO projects (id, name) VALUES (:id, :name)"), {'id': project_id, 'name': 'Test Project'})
    db_session.flush()
    
    run_atn_score_task.__wrapped__(db_session, project_id)
    
    project = db_session.execute(text("SELECT analysis_result, status FROM projects WHERE id = :id"), {'id': project_id}).mappings().fetchone()
    assert project['analysis_result'] is None
    assert project['status'] == 'failed'

def test_run_atn_score_task_scoring_logic(db_session):
    """Test the keyword-based scoring logic of run_atn_score_task."""
    project_id = str(uuid.uuid4())
    db_session.execute(text("INSERT INTO projects (id, name) VALUES (:id, :name)"), {'id': project_id, 'name': 'Test Project'})
    
    # Create mock extractions with different keywords
    extractions_data = [
        {'pmid': 'PMID1', 'title': 'Article 1', 'extracted_data': json.dumps({'description': 'alliance numerique patient'})}, # Score: 3 + 3 + 2 = 8
        {'pmid': 'PMID2', 'title': 'Article 2', 'extracted_data': json.dumps({'description': 'empathie et confiance'})}, # Score: 2 + 2 = 4
        {'pmid': 'PMID3', 'title': 'Article 3', 'extracted_data': json.dumps({'description': 'just some random text'})}, # Score: 0
        {'pmid': 'PMID4', 'title': 'Article 4', 'extracted_data': json.dumps({'description': 'therapeutic digital app developer empathy adherence trust'})}, # Score: 3 + 3 + 2 + 2 = 10
    ]

    for ext in extractions_data:
        db_session.execute(
            text("INSERT INTO extractions (id, project_id, pmid, title, extracted_data) VALUES (:id, :pid, :pmid, :title, :data)"),
            {'id': str(uuid.uuid4()), 'pid': project_id, 'pmid': ext['pmid'], 'title': ext['title'], 'data': ext['extracted_data']}
        )
    db_session.flush()

    # Run the task
    run_atn_score_task.__wrapped__(db_session, project_id)

    # Check the results stored in the project
    project = db_session.execute(text("SELECT analysis_result FROM projects WHERE id = :id"), {'id': project_id}).mappings().fetchone()
    analysis_result = json.loads(project['analysis_result'])
    
    assert analysis_result['total_articles_scored'] == 4
    scores = {s['pmid']: s['atn_score'] for s in analysis_result['atn_scores']}
    
    assert scores['PMID1'] == 8 # 3+3+2
    assert scores['PMID2'] == 4 # 2+2
    assert scores['PMID3'] == 0
    assert scores['PMID4'] == 10 # 3+3+2+2
    assert analysis_result['mean_atn'] == (8 + 4 + 0 + 10) / 4
