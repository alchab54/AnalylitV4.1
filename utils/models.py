# models.py
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import uuid

print("Models loaded, schema set to analylit_schema")

Base = declarative_base()

class Project(Base):
    __tablename__ = 'projects'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
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
            value = getattr(self, c.name)
            if isinstance(value, datetime):
                data[c.name] = value.isoformat()
            else:
                data[c.name] = value
        return data


class Article(Base):
    __tablename__ = 'articles'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
    title = Column(Text)
    # Add other fields as necessary based on your project needs

    def to_dict(self):
        data = {}
        for c in self.__table__.columns:
            value = getattr(self, c.name)
            if isinstance(value, datetime):
                data[c.name] = value.isoformat()
            else:
                data[c.name] = value
        return data

from sqlalchemy import UniqueConstraint

class SearchResult(Base):
    __tablename__ = 'search_results'
    __table_args__ = ({'schema': 'analylit_schema'},
        UniqueConstraint('project_id', 'article_id', name='uq_project_article'),
    )
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
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
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('projects.id'))
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

class Grid(Base):
    __tablename__ = 'extraction_grids'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
    name = Column(String, nullable=False)
    fields = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        data = {}
        for c in self.__table__.columns:
            value = getattr(self, c.name)
            if isinstance(value, datetime):
                data[c.name] = value.isoformat()
            else:
                data[c.name] = value
        return data

class GridField(Base):
    __tablename__ = 'grid_fields'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    grid_id = Column(String, ForeignKey('extraction_grids.id'), nullable=False)
    name = Column(String, nullable=False)
    field_type = Column(String, default='text')
    description = Column(Text)

    def to_dict(self):
        data = {}
        for c in self.__table__.columns:
            value = getattr(self, c.name)
            if isinstance(value, datetime):
                data[c.name] = value.isoformat()
            else:
                data[c.name] = value
        return data

class Validation(Base):
    __tablename__ = 'validations'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    extraction_id = Column(String, ForeignKey('extractions.id'), nullable=False)
    user_id = Column(String, nullable=False)
    decision = Column(String) # 'include' or 'exclude'

class Analysis(Base):
    __tablename__ = 'analyses'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
    analysis_type = Column(String)
    results = Column(Text) # Storing as JSON string
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
    role = Column(String, nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    sources = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)

class AnalysisProfile(Base):
    __tablename__ = 'analysis_profiles'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
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
            value = getattr(self, c.name)
            if isinstance(value, datetime):
                data[c.name] = value.isoformat()
            else:
                data[c.name] = value
        return data

class Prompt(Base):
    __tablename__ = 'prompts'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text)
    template = Column(Text)
    is_default = Column(Boolean, default=False)
    analysis_type = Column(String)

    def to_dict(self):
        data = {}
        for c in self.__table__.columns:
            value = getattr(self, c.name)
            if isinstance(value, datetime):
                data[c.name] = value.isoformat()
            else:
                data[c.name] = value
        return data


class Stakeholder(Base):
    __tablename__ = 'stakeholders'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    extraction_id = Column(String, ForeignKey('extractions.id'), nullable=False)
    group_id = Column(String, ForeignKey('stakeholder_groups.id'), nullable=False)

class StakeholderGroup(Base):
    __tablename__ = 'stakeholder_groups'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String)
    description = Column(Text)

    def to_dict(self):
        data = {}
        for c in self.__table__.columns:
            value = getattr(self, c.name)
            if isinstance(value, datetime):
                data[c.name] = value.isoformat()
            else:
                data[c.name] = value
        return data

class RiskOfBias(Base):
    __tablename__ = 'risk_of_bias'
    __table_args__ = ({'schema': 'analylit_schema'},
        UniqueConstraint('project_id', 'article_id', name='uq_project_article_rob'),
    )
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
    article_id = Column(String, ForeignKey('articles.id'), nullable=False)
    rob_tool = Column(String) # 'RoB 2', 'ROBINS-I'
    domain = Column(String)
    assessment = Column(String) # 'low', 'some concerns', 'high'
    justification = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class ProcessingLog(Base):
    __tablename__ = 'processing_log'
    __table_args__ = {'schema': 'analylit_schema'}
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
    pmid = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, nullable=False) # 'success', 'failed', 'skipped', 'écarté'
    details = Column(Text)