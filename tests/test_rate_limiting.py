import pytest
import time
from flask import Flask

def test_rate_limiting_analysis_profiles(client):
    """
    Tests that the /api/analysis-profiles endpoint is rate-limited correctly.
    """
    # Make several requests to the endpoint
    for _ in range(50):
        response = client.get('/api/analysis-profiles')
        assert response.status_code in [200,429]

    # The 51st request should be rate-limited
    response = client.get('/api/analysis-profiles')
    assert response.status_code == 429  # 429 Too Many Requests

@pytest.mark.parametrize("protected_url", ["/api/analysis-profiles"])
def test_custom_rate_limit_error_message(client, protected_url):
    """
    Tests that the rate limit error message is displayed for particular endpoints
    """

    # Make several requests to the endpoint
    for _ in range(50):
        response = client.get(protected_url)
        assert response.status_code in [200,429]

    # The 51st request should be rate-limited
    response = client.get(protected_url)
    assert response.status_code == 429
    if response.status_code == 429:
    # Assert a message is returned
        assert response.json["description"] == "Too many requests, please try again later."

    # Wait a minute and try again
    time.sleep(60)
    response = client.get(protected_url)
    assert response.status_code == 200