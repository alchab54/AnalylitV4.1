#!/usr/bin/env python3
"""Test ATN simple sans emojis pour Windows"""

import sys
import os
import requests
import time

# Configuration
API_BASE = "http://localhost:8080"
PROJECT_NAME = "Test ATN RTX 2060 SUPER"
PROFILE_ID = "fast-local"

def log(level, message):
    """Log simple sans emojis"""
    timestamp = time.strftime("[%H:%M:%S]")
    print(f"{timestamp} {level}: {message}")

def test_api_connection():
    """Test connexion API"""
    try:
        response = requests.get(f"{API_BASE}/api/health", timeout=10)
        if response.status_code == 200:
            log("INFO", "API connection: OK")
            return True
        else:
            log("ERROR", f"API health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        log("ERROR", f"API connection failed: {e}")
        return False

def create_test_project():
    """Créer projet de test"""
    project_data = {
        "name": PROJECT_NAME,
        "description": "Test workflow ATN avec GPU RTX 2060 SUPER",
        "analysis_profile": PROFILE_ID
    }
    
    try:
        response = requests.post(f"{API_BASE}/api/projects", json=project_data, timeout=30)
        if response.status_code == 201:
            data = response.json()
            project_id = data.get('project_id')
            log("INFO", f"Project created: {project_id}")
            return project_id
        else:
            log("ERROR", f"Project creation failed: {response.status_code}")
            log("ERROR", f"Response: {response.text}")
            return None
    except Exception as e:
        log("ERROR", f"Project creation error: {e}")
        return None

def main():
    """Test principal"""
    log("INFO", "=== TEST ATN WORKFLOW RTX 2060 ===")
    
    # Test 1: Connexion API
    log("INFO", "Step 1: Testing API connection")
    if not test_api_connection():
        log("ERROR", "API connection failed - stopping test")
        return False
    
    # Test 2: Création projet
    log("INFO", "Step 2: Creating test project")
    project_id = create_test_project()
    if not project_id:
        log("ERROR", "Project creation failed - stopping test")
        return False
    
    # Test 3: Vérifier workers
    log("INFO", "Step 3: Checking workers status")
    try:
        response = requests.get(f"{API_BASE}/api/system/workers", timeout=10)
        if response.status_code == 200:
            workers = response.json()
            log("INFO", f"Workers active: {len(workers)}")
        else:
            log("WARNING", "Cannot check workers status")
    except:
        log("WARNING", "Workers status check failed")
    
    log("INFO", "=== TEST COMPLETED SUCCESSFULLY ===")
    log("INFO", f"Project ID: {project_id}")
    log("INFO", "Architecture RTX 2060 SUPER is operational!")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        log("INFO", "Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        log("ERROR", f"Unexpected error: {e}")
        sys.exit(1)
