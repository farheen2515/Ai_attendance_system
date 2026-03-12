import os
import requests
import base64
import json

# Configuration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO_NAME = "face-attendance-ai"
USERNAME = "YOUR_USERNAME"

def upload_to_github():
    if not GITHUB_TOKEN:
        print("Error: GITHUB_TOKEN environment variable not set.")
        return

    # 1. Create Repository
    url = "https://api.github.com/user/repos"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    data = {
        "name": REPO_NAME,
        "description": "AI Face Recognition Attendance System",
        "private": False
    }
    
    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 201:
        print(f"Repository '{REPO_NAME}' created successfully.")
    else:
        print(f"Repository creation failed or already exists: {response.json().get('message')}")

    # 2. Upload Files (Simplified - in practice you'd use git, but this uses API for single files)
    # This is a placeholder for API-based upload logic if needed.
    # For a full project, git is the standard way.
    print("For full project upload, please use the provided push_to_github.sh script.")

if __name__ == "__main__":
    upload_to_github()
