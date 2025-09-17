# tests/test_utils.py
import pytest
import requests
from unittest.mock import Mock
from utils.file_handlers import sanitize_filename
from utils.fetchers import _fetch_pubmed_details

# Sample valid PubMed XML for testing
VALID_PUBMED_XML = """<?xml version="1.0" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2023//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_230101.dtd">
<PubmedArticleSet>
<PubmedArticle>
    <MedlineCitation Status="MEDLINE" Owner="NLM">
        <PMID Version="1">12345678</PMID>
        <Article Id="pubmed">
            <Journal>
                <ISOAbbreviation>J Exp Med</ISOAbbreviation>
                <Title>The Journal of experimental medicine</Title>
            </Journal>
            <ArticleTitle>Test Article Title for PubMed.</ArticleTitle>
            <Pagination>
                <MedlinePgn>100-105</MedlinePgn>
            </Pagination>
            <Abstract>
                <AbstractText>This is a test abstract content.</AbstractText>
            </Abstract>
            <AuthorList CompleteYN="Y">
                <Author ValidYN="Y">
                    <LastName>Doe</LastName>
                    <ForeName>John</ForeName>
                    <Initials>J</Initials>
                </Author>
                <Author ValidYN="Y">
                    <LastName>Smith</LastName>
                    <ForeName>Jane</ForeName>
                    <Initials>J</Initials>
                </Author>
            </AuthorList>
            <Language>eng</Language>
            <ArticleDate DateType="Electronic">
                <Year>2023</Year>
                <Month>01</Month>
                <Day>15</Day>
            </ArticleDate>
        </Article>
        <ArticleIdList>
            <ArticleId IdType="doi">10.1000/test.12345678</ArticleId>
        </ArticleIdList>
    </MedlineCitation>
</PubmedArticle>
</PubmedArticleSet>"""

# Sample PubMed XML with missing ArticleTitle
XML_MISSING_TITLE = """<?xml version="1.0" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2023//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_230101.dtd">
<PubmedArticleSet>
<PubmedArticle>
    <MedlineCitation Status="MEDLINE" Owner="NLM">
        <PMID Version="1">12345678</PMID>
        <Article Id="pubmed">
            <Journal>
                <ISOAbbreviation>J Exp Med</ISOAbbreviation>
                <Title>The Journal of experimental medicine</Title>
            </Journal>
            <!-- ArticleTitle is missing here -->
            <Pagination>
                <MedlinePgn>100-105</MedlinePgn>
            </Pagination>
            <Abstract>
                <AbstractText>This is a test abstract content.</AbstractText>
            </Abstract>
            <AuthorList CompleteYN="Y">
                <Author ValidYN="Y">
                    <LastName>Doe</LastName>
                    <ForeName>John</ForeName>
                    <Initials>J</Initials>
                </Author>
            </AuthorList>
            <Language>eng</Language>
            <ArticleDate DateType="Electronic">
                <Year>2023</Year>
                <Month>01</Month>
                <Day>15</Day>
            </ArticleDate>
        </Article>
        <ArticleIdList>
            <ArticleId IdType="doi">10.1000/test.12345678</ArticleId>
        </ArticleIdList>
    </MedlineCitation>
</PubmedArticle>
</PubmedArticleSet>"""

@pytest.mark.parametrize("input_string, expected_output", [
    ("Titre: avec/des caractères\ninvalides?", "Titre_avec_des_caractères_invalides"),
    ("Un nom de fichier simple", "Un_nom_de_fichier_simple"),
    ("  espaces   au début et à la fin  ", "espaces_au_début_et_à_la_fin"),
    ("NomAvecAccentséàç", "NomAvecAccentséàç"), # Vérifie que les accents sont conservés
])
def test_sanitize_filename(input_string, expected_output):
    """Teste la fonction de nettoyage des noms de fichiers avec plusieurs cas."""
    assert sanitize_filename(input_string) == expected_output

def test__fetch_pubmed_details_success(mocker):
    """
    Teste le cas de succès pour _fetch_pubmed_details avec un XML valide.
    """
    pmid = "12345678"
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.text = VALID_PUBMED_XML
    mock_response.raise_for_status.return_value = None # Ensure no exception is raised

    mocker.patch('requests.get', return_value=mock_response)

    result = _fetch_pubmed_details(pmid)

    expected_result = {
        "id": pmid,
        "title": "Test Article Title for PubMed.",
        "abstract": "This is a test abstract content.",
        "authors": "Doe J, Smith J",
        "publication_date": "2023",
        "journal": "J Exp Med",
        "doi": "10.1000/test.12345678",
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "database_source": "pubmed"
    }
    assert result == expected_result
    requests.get.assert_called_once_with(
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
        params={"db": "pubmed", "id": pmid, "retmode": "xml"},
        timeout=30
    )

def test__fetch_pubmed_details_request_exception(mocker):
    """
    Teste le cas où requests.get lève une RequestException.
    """
    pmid = "12345678"
    mocker.patch('requests.get', side_effect=requests.exceptions.RequestException("Test Exception"))

    result = _fetch_pubmed_details(pmid)

    expected_fallback = {
        "id": pmid,
        "title": f"Article PubMed {pmid} (erreur récupération)",
        "abstract": "Erreur lors de la récupération du résumé depuis PubMed",
        "authors": "Auteurs à récupérer",
        "publication_date": "2024",
        "journal": "Journal à récupérer",
        "doi": "",
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "database_source": "pubmed"
    }
    assert result == expected_fallback
    requests.get.assert_called_once()

def test__fetch_pubmed_details_http_error(mocker):
    """
    Teste le cas où l'API Entrez retourne un statut HTTP autre que 200.
    """
    pmid = "12345678"
    mock_response = Mock()
    mock_response.status_code = 404
    mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("Not Found")

    mocker.patch('requests.get', return_value=mock_response)

    result = _fetch_pubmed_details(pmid)

    expected_fallback = {
        "id": pmid,
        "title": f"Article PubMed {pmid} (erreur récupération)",
        "abstract": "Erreur lors de la récupération du résumé depuis PubMed",
        "authors": "Auteurs à récupérer",
        "publication_date": "2024",
        "journal": "Journal à récupérer",
        "doi": "",
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "database_source": "pubmed"
    }
    assert result == expected_fallback
    requests.get.assert_called_once()
    mock_response.raise_for_status.assert_called_once()

def test__fetch_pubmed_details_malformed_xml(mocker):
    """
    Teste le cas où le XML retourné est malformé.
    """
    pmid = "12345678"
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.text = "<invalid_xml>" # Malformed XML
    mock_response.raise_for_status.return_value = None

    mocker.patch('requests.get', return_value=mock_response)

    result = _fetch_pubmed_details(pmid)

    expected_fallback = {
        "id": pmid,
        "title": f"Article PubMed {pmid} (erreur récupération)",
        "abstract": "Erreur lors de la récupération du résumé depuis PubMed",
        "authors": "Auteurs à récupérer",
        "publication_date": "2024",
        "journal": "Journal à récupérer",
        "doi": "",
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "database_source": "pubmed"
    }
    assert result == expected_fallback
    requests.get.assert_called_once()

def test__fetch_pubmed_details_missing_article_title(mocker):
    """
    Teste le cas où le XML est valide mais ne contient pas la balise ArticleTitle.
    """
    pmid = "12345678"
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.text = XML_MISSING_TITLE
    mock_response.raise_for_status.return_value = None

    mocker.patch('requests.get', return_value=mock_response)

    result = _fetch_pubmed_details(pmid)

    expected_result = {
        "id": pmid,
        "title": f"Article PubMed {pmid}", # Default title when missing
        "abstract": "This is a test abstract content.",
        "authors": "Doe J",
        "publication_date": "2023",
        "journal": "J Exp Med",
        "doi": "10.1000/test.12345678",
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "database_source": "pubmed"
    }
    assert result == expected_result
    requests.get.assert_called_once()
