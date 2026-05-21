# Calorie Tracker

Single-user calorie tracker with deterministic natural language meal logging.

## Structure

- `backend/` - FastAPI API, parser, calorie engine, SQLite persistence
- `frontend/` - Next.js app for logging meals and viewing summaries

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API creates `calorie_tracker.db` automatically on startup.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:8000`. Override with:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
```

## API

- `POST /log-meal`
- `GET /daily-summary`
- `GET /history`
- `PATCH /meal/{id}`
- `DELETE /meal/{id}`

