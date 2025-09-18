from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text,
    ForeignKey, DateTime, UniqueConstraint
)
from sqlalchemy.orm import declarative_base
from datetime import datetime
import uuid
import json

Base = declarative_base()
SCHEMA = 'analylit_schema'

def _uuid():
    return str(uuid.uuid4())

class Project(Base):
    __tablename__ = 'projects'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, default='pending')
    profile_used = Column(String)
    job_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    synthesis_result = Column(Text)
    discussion_draft = Column(Text)
    knowledge_graph = Column(Text)
    prisma_flow_path = Column(String)
    analysis_mode = Column(String, default='screening')
    analysis_result = Column(Text)
    analysis_plot_path = Column(String)
    pmids_count = Column(Integer, default=0)
    processed_count = Column(Integer, default=0)
    total_processing_time = Column(Float, default=0)
    indexed_at = Column(DateTime)
    search_query = Column(Text)
    databases_used = Column(Text)
    inter_rater_reliability = Column(Text)
    prisma_checklist = Column(Text)

    def to_dict(self):
        data = {}
        for c in self.__table__.columns:
            v = getattr(self, c.name)
            data[c.name] = v.isoformat() if isinstance(v, datetime) else v
        return data

class Article(Base):
    __tablename__ = 'articles'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey(f'{SCHEMA}.projects.id'), nullable=False)
    title = Column(Text)

    def to_dict(self):
        data = {}
        for c in self.__table__.columns:
            v = getattr(self, c.name)
            data[c.name] = v.isoformat() if isinstance(v, datetime) else v
        return data

class SearchResult(Base):
    __tablename__ = 'search_results'
    __table_args__ = (
        UniqueConstraint('project_id', 'article_id', name='uq_project_article'),
        {'schema': SCHEMA}
    )

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey(f'{SCHEMA}.projects.id'), nullable=False)
    article_id = Column(String, nullable=False)
    title = Column(Text)
    abstract = Column(Text)
    authors = Column(Text)
    publication_date = Column(String)
    journal = Column(String)
    doi = Column(String)
    url = Column(String)
    database_source = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Extraction(Base):
    __tablename__ = 'extractions'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey(f'{SCHEMA}.projects.id'))
    pmid = Column(String)
    title = Column(Text)
    validation_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    extracted_data = Column(Text)
    relevance_score = Column(Float, default=0)
    relevance_justification = Column(Text)
    user_validation_status = Column(String)
    analysis_source = Column(String)
    validations = Column(Text)
    user_notes = Column(Text, nullable=True)
    stakeholder_perspective = Column(String)
    ai_type = Column(String)
    platform_used = Column(String)

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "pmid": self.pmid,
            "title": self.title,
            "relevance_score": self.relevance_score,
            "user_validation_status": self.user_validation_status,
            "validations": json.loads(self.validations) if self.validations else {},
            "extracted_data": json.loads(self.extracted_data) if self.extracted_data else {}
        }


class Grid(Base):
    __tablename__ = 'extraction_grids'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey(f'{SCHEMA}.projects.id'), nullable=False)
    name = Column(String, nullable=False)
    fields = Column(Text) 
    created_at = Column(DateTime, default=datetime.utcnow)    
    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "name": self.name,
            "fields": json.loads(self.fields) if self.fields else []
        }

class GridField(Base):
    __tablename__ = 'grid_fields'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    grid_id = Column(String, ForeignKey(f'{SCHEMA}.extraction_grids.id'), nullable=False)
    name = Column(String, nullable=False)
    field_type = Column(String, default='text')
    description = Column(Text)

class Validation(Base):
    __tablename__ = 'validations'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    extraction_id = Column(String, ForeignKey(f'{SCHEMA}.extractions.id'), nullable=False)
    user_id = Column(String, nullable=False)
    decision = Column(String) 

    def to_dict(self):
        return {
            "id": self.id,
            "extraction_id": self.extraction_id,
            "user_id": self.user_id,
            "decision": self.decision,
        }

class Analysis(Base):
    __tablename__ = 'analyses'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey(f'{SCHEMA}.projects.id'), nullable=False)
    analysis_type = Column(String)
    results = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "analysis_type": self.analysis_type,
            "results": self.results,
            "created_at": self.created_at.isoformat(),
        }

class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey(f'{SCHEMA}.projects.id'), nullable=False)
    role = Column(String, nullable=False) 
    content = Column(Text, nullable=False)
    sources = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "role": self.role,
            "content": self.content,
            "sources": self.sources,
            "timestamp": self.timestamp.isoformat(),
        }

class AnalysisProfile(Base):
    __tablename__ = 'analysis_profiles'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False, unique=True)
    is_custom = Column(Boolean, default=True)
    preprocess_model = Column(String)
    extract_model = Column(String)
    synthesis_model = Column(String)
    description = Column(Text)
    temperature = Column(Float, default=0.7)
    context_length = Column(Integer, default=4096)

    def to_dict(self):
        data = {}
        for c in self.__table__.columns:
            v = getattr(self, c.name)
            data[c.name] = v.isoformat() if isinstance(v, datetime) else v
        return data

class PRISMARecord(Base):
    __tablename__ = 'prisma_records'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey(f'{SCHEMA}.projects.id'), nullable=False)
    stage = Column(String)
    count = Column(Integer, default=0)
    details = Column(Text)

class ScreeningDecision(Base):
    __tablename__ = 'screening_decisions'
    __table_args__ = (
        UniqueConstraint('project_id', 'pmid', name='uq_project_pmid'),
        {'schema': SCHEMA}
    )

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey(f'{SCHEMA}.projects.id'), nullable=False)
    pmid = Column(String, nullable=False)
    title = Column(Text)
    abstract = Column(Text)
    decision = Column(String)
    reason = Column(Text)
    decided_at = Column(DateTime, default=datetime.utcnow)

class RiskOfBias(Base):
    __tablename__ = 'risk_of_bias'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey(f'{SCHEMA}.projects.id'), nullable=False)
    pmid = Column(String, nullable=False)
    domain = Column(String)
    judgement = Column(String)
    support_for_judgement = Column(Text)
    assessed_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "pmid": self.pmid,
            "domain": self.domain,
            "judgement": self.judgement,
            "assessed_at": self.assessed_at.isoformat(),
        }

class Prompt(Base):
    __tablename__ = 'prompts'
    __table_args__ = {'schema': SCHEMA}
    
    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False, unique=True)
    template = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False)
    analysis_type = Column(String)
    
    def to_dict(self):
        return {c.name: getattr(self, c.name, None) for c in self.__table__.columns}

class ProcessingLog(Base):
    __tablename__ = 'processing_log'
    __table_args__ = {'schema': SCHEMA}

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey(f'{SCHEMA}.projects.id'), nullable=False)
    article_id = Column(String, nullable=True) 
    task_name = Column(String, nullable=False)
    status = Column(String, nullable=False)
    message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(Text)

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "article_id": self.article_id,
            "task_name": self.task_name,
            "status": self.status,
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
        }