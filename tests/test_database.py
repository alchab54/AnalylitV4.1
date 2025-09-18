import pytest
from unittest.mock import MagicMock, patch, call
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, scoped_session
from config_v4 import Settings # Import Settings for type hinting

# CORRECTION : Import dupliqué supprimé
# from config_v4 import Settings # Import Settings for type hinting 

# Import after patching config
from utils.database import init_database, seed_default_data

@patch('utils.database.create_engine')
@patch('utils.database.sessionmaker')
@patch('utils.database.scoped_session')
@patch('utils.models.Base.metadata.create_all')
@patch('utils.database.inspect')
def test_init_db_basic_initialization(
    mock_inspect, mock_create_all, mock_scoped_session, mock_sessionmaker, mock_create_engine
):
    """Test basic initialization of the database."""
    mock_engine_instance = MagicMock()
    mock_create_engine.return_value = mock_engine_instance

    mock_session_factory_instance = MagicMock()
    mock_sessionmaker.return_value = mock_session_factory_instance

    mock_db_session_instance = MagicMock()
    mock_scoped_session.return_value = mock_db_session_instance

    # Create a mock config object to pass to init_db
    mock_config_obj = MagicMock(spec=Settings, DATABASE_URL="sqlite:///:memory:")

    init_database()

    mock_create_engine.assert_called_once_with("sqlite:///:memory:", pool_pre_ping=True)
    mock_sessionmaker.assert_called_once_with(bind=mock_engine_instance, autoflush=False, autocommit=False)
    mock_scoped_session.assert_called_once_with(mock_session_factory_instance)
    mock_create_all.assert_called_once_with(bind=mock_engine_instance)

    # Ensure migrations are attempted even if no columns are missing
    mock_inspect.assert_called_once_with(mock_engine_instance)
    mock_inspect.return_value.get_columns.assert_called_once_with('analysis_profiles')

@patch('utils.database.create_engine')
@patch('utils.database.sessionmaker')
@patch('utils.database.scoped_session')
@patch('utils.models.Base.metadata.create_all')
@patch('utils.database.inspect')
def test_init_db_migrations_column_missing(
    mock_inspect, mock_create_all, mock_scoped_session, mock_sessionmaker, mock_create_engine
):
    """Test init_db when a column is missing, triggering a migration."""
    mock_engine_instance = MagicMock()
    mock_create_engine.return_value = mock_engine_instance

    mock_connection = MagicMock()
    mock_engine_instance.connect.return_value.__enter__.return_value = mock_connection

    # Simulate 'description' column missing
    mock_inspect.return_value.get_columns.return_value = [
        {'name': 'id'},
        {'name': 'name'},
        {'name': 'temperature'},
        {'name': 'context_length'},
        {'name': 'preprocess_model'},
        {'name': 'extract_model'},
        {'name': 'synthesis_model'},
    ]

    init_database()

    mock_inspect.assert_called_once_with(mock_engine_instance)
    mock_inspect.return_value.get_columns.assert_called_once_with('analysis_profiles')

    # Check if the ALTER TABLE command for 'description' was called
    # We need to check the string content of the text() object
    executed_calls = [str(c.args[0]) for c in mock_connection.execute.call_args_list]
    assert 'ALTER TABLE analysis_profiles ADD COLUMN description TEXT' in executed_calls
    mock_connection.commit.assert_called_once()

@patch('utils.database.create_engine')
@patch('utils.database.sessionmaker')
@patch('utils.database.scoped_session')
@patch('utils.models.Base.metadata.create_all')
@patch('utils.database.inspect')
def test_init_db_migrations_all_columns_present(
    mock_inspect, mock_create_all, mock_scoped_session, mock_sessionmaker, mock_create_engine
):
    """Test init_db when all columns are present, so no migrations are run."""
    mock_engine_instance = MagicMock()
    mock_create_engine.return_value = mock_engine_instance

    mock_connection = MagicMock()
    mock_engine_instance.connect.return_value.__enter__.return_value = mock_connection

    # Simulate all columns present
    mock_inspect.return_value.get_columns.return_value = [
        {'name': 'id'},
        {'name': 'name'},
        {'name': 'description'},
        {'name': 'temperature'},
        {'name': 'context_length'},
        {'name': 'preprocess_model'},
        {'name': 'extract_model'},
        {'name': 'synthesis_model'},
    ]

    init_database()

    mock_inspect.assert_called_once_with(mock_engine_instance)
    mock_inspect.return_value.get_columns.assert_called_once_with('analysis_profiles')
    # Assert that ALTER TABLE is NOT called
    mock_connection.execute.assert_not_called()
    mock_connection.commit.assert_called_once()

@patch('utils.models.AnalysisProfile') # Patch utils.models.AnalysisProfile
@patch('utils.models.Project') # Patch utils.models.Project
@patch('sqlalchemy.orm.Session') # Patch sqlalchemy.orm.Session directly
def test_seed_default_data_no_data_exists(
    mock_orm_session, mock_project_class, mock_analysis_profile_class
):
    """Test seed_default_data when no default profile or project exists."""
    mock_conn = MagicMock()
    mock_session_instance = MagicMock()
    mock_orm_session.return_value = mock_session_instance # Mock the instance returned by Session(bind=conn)

    # Simulate no existing profile or project
    mock_session_instance.query.return_value.filter_by.return_value.first.return_value = None

    seed_default_data(mock_conn)

    # Assert that Session was called with the connection
    mock_orm_session.assert_called_once_with(bind=mock_conn)

    # Assert that query was called for both AnalysisProfile and Project
    assert mock_session_instance.query.call_count == 2
    mock_session_instance.query.assert_any_call(mock_analysis_profile_class)
    mock_session_instance.query.assert_any_call(mock_project_class)

    # Assert that add was called for both new profile and project
    assert mock_session_instance.add.call_count == 2
    mock_session_instance.commit.assert_called_once()

@patch('utils.models.AnalysisProfile') # Patch utils.models.AnalysisProfile
@patch('utils.models.Project') # Patch utils.models.Project
@patch('sqlalchemy.orm.Session') # Patch sqlalchemy.orm.Session directly
def test_seed_default_data_data_already_exists(
    mock_orm_session, mock_project_class, mock_analysis_profile_class
):
    """Test seed_default_data when default profile and project already exist."""
    mock_conn = MagicMock()
    mock_session_instance = MagicMock()
    mock_orm_session.return_value = mock_session_instance # Mock the instance returned by Session(bind=conn)

    # Simulate existing profile and project
    mock_existing_profile = MagicMock()
    mock_existing_project = MagicMock()
    
    # Configure the mock to return existing objects for both queries
    mock_session_instance.query.return_value.filter_by.return_value.first.side_effect = [
        mock_existing_profile, mock_existing_project
    ]

    seed_default_data(mock_conn)

    # Assert that Session was called with the connection
    mock_orm_session.assert_called_once_with(bind=mock_conn)

    # Assert that query was called for both AnalysisProfile and Project
    assert mock_session_instance.query.call_count == 2
    mock_session_instance.query.assert_any_call(mock_analysis_profile_class)
    mock_session_instance.query.assert_any_call(mock_project_class)

    # Assert that add was NOT called
    mock_session_instance.add.assert_not_called()
    mock_session_instance.commit.assert_called_once()