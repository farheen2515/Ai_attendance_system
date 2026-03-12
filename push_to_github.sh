#!/bin/bash

# Initialize git repository
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit - AI Face Attendance System"

# Set main branch
git branch -M main

# Add remote origin (Replace YOUR_USERNAME with actual username)
echo "Please enter your GitHub username:"
read username
git remote add origin "https://github.com/$username/face-attendance-ai.git"

# Push to GitHub
echo "Attempting to push to GitHub..."
git push -u origin main
