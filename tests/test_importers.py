import pytest
from unittest.mock import MagicMock, patch, call
import json
from pathlib import Path
import hashlib

from utils.importers import ZoteroAbstractExtractor

@pytest.fixture
def mock_json_file(tmp_path):
    """Fixture to create a temporary JSON file for testing."""
    def _create_json(data, filename="test_zotero.json"):
        file_path = tmp_path / filename
        file_path.write_text(json.dumps(data))
        return file_path
    return _create_json

def test_clean_html():
    extractor = ZoteroAbstractExtractor("dummy_path.json")
    assert extractor.clean_html("<p>Hello <b>World</b>!</p>") == "Hello World !"
    assert extractor.clean_html("Text with &nbsp; spaces.") == "Text with &nbsp; spaces."
    assert extractor.clean_html("  Leading and trailing spaces  ") == "Leading and trailing spaces"
    assert extractor.clean_html("") == ""
    assert extractor.clean_html(None) == ""
    assert extractor.clean_html("No HTML here.") == "No HTML here."

@patch('pathlib.Path.exists', return_value=False)
def test_load_items_file_not_found(mock_exists):
    extractor = ZoteroAbstractExtractor("non_existent.json")
    with pytest.raises(FileNotFoundError, match="Le fichier non_existent.json est introuvable."):
        extractor.load_items()

@patch('pathlib.Path.exists', return_value=True)
@patch('pathlib.Path.read_text', return_value='{}')
def test_load_items_empty_json(mock_read_text, mock_exists):
    extractor = ZoteroAbstractExtractor("empty.json")
    items = extractor.load_items()
    assert items == []
    assert extractor.stats["total"] == 0

@patch('pathlib.Path.exists', return_value=True)
@patch('pathlib.Path.read_text', return_value='{"items": [{"title": "Item 1"}, {"title": "Item 2"}]}')
def test_load_items_valid_json(mock_read_text, mock_exists):
    extractor = ZoteroAbstractExtractor("valid.json")
    items = extractor.load_items()
    assert len(items) == 2
    assert items[0]["title"] == "Item 1"
    assert extractor.stats["total"] == 2

@patch('pathlib.Path.exists', return_value=True)
@patch('pathlib.Path.read_text', return_value='invalid json')
def test_load_items_malformed_json(mock_read_text, mock_exists):
    extractor = ZoteroAbstractExtractor("malformed.json")
    with pytest.raises(json.JSONDecodeError):
        extractor.load_items()

def test_get_best_identifier_pmid_extra():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {"extra": "PMID: 123456789 some other text"}
    assert extractor._get_best_identifier(item) == "123456789"
    assert extractor.stats["with_pmid"] == 1

def test_get_best_identifier_pmid_field():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {"PMID": "9876543"}
    assert extractor._get_best_identifier(item) == "9876543"
    assert extractor.stats["with_pmid"] == 1

def test_get_best_identifier_doi():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {"DOI": "10.1000/test.123"}
    assert extractor._get_best_identifier(item) == "10.1000/test.123"
    assert extractor.stats["with_pmid"] == 0 # Should not increment PMID if DOI is used

def test_get_best_identifier_zotero_key():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {"key": "ABCDEF"}
    assert extractor._get_best_identifier(item) == "zotero:ABCDEF"

def test_get_best_identifier_hash_generated():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {"title": "A very unique title for hashing"}
    identifier = extractor._get_best_identifier(item)
    assert len(identifier) == 16 # MD5 hash is 32 chars, sliced to 16
    assert isinstance(identifier, str)

def test_get_best_identifier_precedence():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {"extra": "PMID: 1234567", "DOI": "10.1000/test", "key": "ABC"}
    assert extractor._get_best_identifier(item) == "1234567" # PMID should take precedence

def test_get_publication_year_from_date():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {"date": "2023-01-15"}
    assert extractor._get_publication_year(item) == "2023"

def test_get_publication_year_from_year():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {"year": "1999"}
    assert extractor._get_publication_year(item) == "1999"

def test_get_publication_year_no_year():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {"date": "Invalid Date"}
    assert extractor._get_publication_year(item) is None

def test_extract_reference_data_full_item():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {
        "key": "ZOTERO_KEY_1",
        "extra": "PMID: 123456789",
        "title": "Test Article Title",
        "abstractNote": "<p>This is an <b>abstract</b>.</p>",
        "creators": [
            {"lastName": "Doe", "firstName": "John"},
            {"lastName": "Smith", "firstName": "Jane"}
        ],
        "publicationTitle": "Test Journal",
        "date": "2023-01-01",
        "DOI": "10.1234/test.doi",
        "url": "http://example.com/article"
    }
    result = extractor.extract_reference_data(item)
    assert result["zotero_key"] == "ZOTERO_KEY_1"
    assert result["article_id"] == "123456789"
    assert result["title"] == "Test Article Title"
    assert result["authors"] == "Doe, John; Smith, Jane"
    assert result["publication_date"] == "2023"
    assert result["journal"] == "Test Journal"
    assert result["abstract"] == "This is an abstract ."
    assert result["doi"] == "10.1234/test.doi"
    assert result["url"] == "http://example.com/article"
    assert result["database_source"] == "zotero_import"
    assert "__hash" in result
    assert extractor.stats["with_abstract"] == 1
    assert extractor.stats["with_pmid"] == 1

def test_extract_reference_data_missing_fields():
    extractor = ZoteroAbstractExtractor("dummy.json")
    item = {"key": "ZOTERO_KEY_2", "title": "Minimal Title"}
    result = extractor.extract_reference_data(item)
    assert result["title"] == "Minimal Title"
    assert result["authors"] == ""
    assert result["publication_date"] == ""
    assert result["journal"] == ""
    assert result["abstract"] == ""
    assert result["doi"] == ""
    assert result["url"] == ""
    assert "__hash" in result
    assert extractor.stats["with_abstract"] == 0

def test_extract_reference_data_error_handling():
    extractor = ZoteroAbstractExtractor("dummy.json")
    # Simulate an invalid item structure that does NOT raise an exception
    item = {"creators": "not a list", "title": "Test Title"}
    result = extractor.extract_reference_data(item)
    assert isinstance(result, dict)
    assert result["authors"] == ""
    assert extractor.stats["errors"] == 0

def test_process_no_duplicates(mock_json_file):
    data = {"items": [
        {"key": "A", "title": "Title 1", "date": "2020"},
        {"key": "B", "title": "Title 2", "date": "2021"}
    ]}
    file_path = mock_json_file(data)
    extractor = ZoteroAbstractExtractor(str(file_path))
    records = extractor.process()
    assert len(records) == 2
    assert extractor.stats["total"] == 2
    assert extractor.stats["duplicates"] == 0

def test_process_with_duplicates(mock_json_file):
    data = {"items": [
        {"key": "A", "title": "Title 1", "date": "2020"},
        {"key": "B", "title": "Title 1", "date": "2020"}, # Duplicate based on hash
        {"key": "C", "title": "Title 3", "date": "2022"}
    ]}
    file_path = mock_json_file(data)
    extractor = ZoteroAbstractExtractor(str(file_path))
    records = extractor.process()
    assert len(records) == 2 # One duplicate removed
    assert extractor.stats["total"] == 3
    assert extractor.stats["duplicates"] == 1

def test_process_empty_input(mock_json_file):
    data = {"items": []}
    file_path = mock_json_file(data)
    extractor = ZoteroAbstractExtractor(str(file_path))
    records = extractor.process()
    assert records == []
    assert extractor.stats["total"] == 0
    assert extractor.stats["duplicates"] == 0

@patch('utils.importers.hashlib.md5')
def test_process_items_returning_none(mock_md5, mock_json_file, mocker):
    # Configure mock_md5 to raise an exception for the "bad" item
    def side_effect_md5(value):
        # Check for a unique part of the bad item's hash_base
        # The bad item's title is "Bad Item", so its hash_base will contain "Bad Item"
        if b"Bad Item" in value:
            raise Exception("Simulated hashlib.md5 error")
        # For valid items, return a mock hexdigest
        return MagicMock(hexdigest=MagicMock(return_value="validhash"))

    mock_md5.side_effect = side_effect_md5

    data = {"items": [
        {"key": "A", "title": "Valid Item"},
        {"key": "B", "creators": "not a list", "title": "Bad Item"} # Add title for hash_base
    ]}
    file_path = mock_json_file(data)
    extractor = ZoteroAbstractExtractor(str(file_path))

    records = extractor.process()
    assert len(records) == 1 # Only the valid item should remain
    assert extractor.stats["total"] == 2
    assert extractor.stats["errors"] == 1 # One error from the simulated hashlib.md5 error
    assert extractor.stats["duplicates"] == 0
