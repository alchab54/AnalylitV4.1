# test_atn_scoring.py (Rewritten)
import pytest
import json
import uuid
from sqlalchemy import text
from tasks_v4_complete import run_atn_score_task

def test_run_atn_score_task_no_extractions(session):
    """Test that the task handles projects with no extractions."""
    project_id = str(uuid.uuid4())
    session.execute(text("INSERT INTO projects (id, name) VALUES (:id, :name)"), {'id': project_id, 'name': 'Test Project'})
    session.commit()
    
    run_atn_score_task.__wrapped__(session, project_id)
    
    project = session.execute(text("SELECT analysis_result, status FROM projects WHERE id = :id"), {'id': project_id}).mappings().fetchone()
    assert project['analysis_result'] is None
    assert project['status'] == 'failed'

def test_run_atn_score_task_scoring_logic(session):
    """Test the keyword-based scoring logic of run_atn_score_task."""
    project_id = str(uuid.uuid4())
    session.execute(text("INSERT INTO projects (id, name) VALUES (:id, :name)"), {'id': project_id, 'name': 'Test Project'})
    
    # Create mock extractions with different keywords
    extractions_data = [
        {'pmid': 'PMID1', 'title': 'Article 1', 'extracted_data': json.dumps({'content': 'alliance numérique patient'})}, # Score: 3 + 3 + 2 = 8
        {'pmid': 'PMID2', 'title': 'Article 2', 'extracted_data': json.dumps({'content': 'empathie et confiance'})}, # Score: 2
        {'pmid': 'PMID3', 'title': 'Article 3', 'extracted_data': json.dumps({'content': 'just some random text'})}, # Score: 0
        {'pmid': 'PMID4', 'title': 'Article 4', 'extracted_data': json.dumps({'content': 'therapeutic digital app developer empathy adherence trust'})}, # Score: 3 + 3 + 2 + 2 = 10
    ]

    for ext in extractions_data:
        session.execute(
            text("INSERT INTO extractions (id, project_id, pmid, title, extracted_data) VALUES (:id, :pid, :pmid, :title, :data)"),
            {'id': str(uuid.uuid4()), 'pid': project_id, 'pmid': ext['pmid'], 'title': ext['title'], 'data': ext['extracted_data']}
        )
    session.commit()

    # Run the task
    run_atn_score_task.__wrapped__(session, project_id)

    # Check the results stored in the project
    project = session.execute(text("SELECT analysis_result FROM projects WHERE id = :id"), {'id': project_id}).mappings().fetchone()
    analysis_result = json.loads(project['analysis_result'])
    
    assert analysis_result['total_articles_scored'] == 4
    scores = {s['pmid']: s['atn_score'] for s in analysis_result['atn_scores']}
    
    assert scores['PMID1'] == 8
    assert scores['PMID2'] == 2
    assert scores['PMID3'] == 0
    assert scores['PMID4'] == 10
    assert analysis_result['mean_atn'] == (8 + 2 + 0 + 10) / 4
