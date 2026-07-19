# Setup & Run Guide

This guide provides step-by-step instructions to get the Insights Platform up and running on your local machine. The system consists of two parts: the **FastAPI Backend** and the **React + Vite Frontend**.

---

## 1. Initial Setup

### Backend (Python)
1. Open a terminal in the root directory of the project (`insights_platform`).
2. Make sure you have Python 3.10+ installed.
3. If you haven't already, create and activate a virtual environment (optional but recommended).
4. Install the backend dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
5. Duplicate the `.env.example` file and rename it to `.env`. (You can leave it blank initially as you can add API keys via the frontend UI later).

### Frontend (Node.js)
1. Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).
2. Open a *new* terminal and navigate to the `frontend` directory:
   ```powershell
   cd frontend
   ```
3. Install the frontend dependencies using `npm`:
   ```powershell
   npm install
   ```

---

## 2. Running the Application

You will need **two separate terminals** running simultaneously to use the application.

### Terminal 1: Start the Backend Server
From the root `insights_platform` dcdirectory, run:
```powershell
python -m uvicorn backend.app:app --reload --port 8000
```
*You should see output indicating that the database, drive config, and local RAG services have initialized, followed by `Application startup complete`.*

### Terminal 2: Start the Frontend Server
From the `frontend` directory, run:
```powershell
npm run dev
```
*This will start the Vite development server. It will provide a local URL, typically `http://localhost:5173`.*

---

## 3. How to Check Everything is Working

### Check 1: The UI Loads
1. Open your browser and navigate to the local URL provided by the frontend terminal (e.g., `http://localhost:5173`).
2. You should see the Dashboard page with dark mode (or light mode) fully applied.

### Check 2: Backend Connectivity
1. On the Dashboard, look for the **Backend** metric card in the top row. It should read `ok` with a green indicator.
2. Alternatively, navigate to the **Configurations** page via the sidebar. Click the **"Check Backend"** button at the top right. A green banner should confirm the backend is reachable.

### Check 3: Configuring API Keys
Before running any research:
1. Go to the **Configurations** page.
2. Add your desired API keys (e.g., Google Gemini, OpenAI).
3. Click **Save All Settings**. This ensures the backend `model_connect.py` script has authorization to execute Agent tasks.

### Check 4: Run a Test Pipeline
1. Go to the **Deep Research** page.
2. Enter a test project name (e.g., "Test Project").
3. Uncheck all sources except for one easy one (like `company` or `reddit`) to keep the test quick.
4. Click **Launch Pipeline**. 
5. Go back to the **Dashboard** or **History** page and wait for the job to show as `complete`. The project should now appear in your Recent Projects list!
