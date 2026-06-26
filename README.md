# Insights Platform

A robust, AI-powered system designed to scrape, extract, and synthesize product and competitor insights from multiple data sources (Company Websites, Play Store, App Store, Reddit, YouTube, etc.).

## 📁 Project Structure

The codebase is organized as follows:

```
insights_platform/
├── README.md               # This file
├── setup_run.md            # Detailed guide to setting up and running the application
├── agents/                 # The core AI pipeline (Agent 1-5) and LLM connectors
├── backend/                # The FastAPI backend service
├── core/                   # Shared services (Database, Vector store, Google Drive integration)
├── data/                   # Git-ignored local data storage (Projects, DBs, Transcripts)
├── docs/                   # Full documentation, architecture diagrams, and design tokens
├── frontend/               # The React + Vite frontend application
├── scrapers/               # Connectors for various data sources (Reddit, YouTube, Play Store, etc.)
└── scripts/                # Utility and maintenance scripts
```

## 🚀 Quick Start

If you are just looking to run the application, please refer to the comprehensive **[setup_run.md](setup_run.md)** guide. It includes step-by-step instructions for:
- Setting up the backend and frontend environments.
- Running both services locally.
- Verifying the application's health.

## 🛠 Features

- **Multi-Agent Pipeline**: 
  - **Agent 1 (Orchestrator)**: Scrapes all required information into `raw/` files.
  - **Agent 2 (Insights)**: Parses raw data to find key pain points and requests.
  - **Agent 3 (Synthesis)**: Synthesizes findings across multiple platforms.
  - **Agent 4 (Briefs)**: Generates complete product briefs based on research.
- **Agent 5 (Copilot)**: A persistent chat module that allows you to directly interrogate project data using Local RAG.
- **Configurable Settings**: A unified Configurations UI to manage multiple API keys locally and change active models on-the-fly.

## 🔒 Important Security Notice

The `.env.example` file outlines the keys required for the platform. You may insert API keys through the frontend UI Configuration panel, which safely saves them to a git-ignored `data/state/config.json`. **Never commit active API keys to the repository.**

---
*For technical architecture and roadmap details, see the `docs/` folder.*
