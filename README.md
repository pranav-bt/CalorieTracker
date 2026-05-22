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
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API creates `calorie_tracker.db` automatically on startup.

Run backend tests:

```powershell
cd backend
python -m pip install -r requirements.txt
pytest
```

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

Run frontend tests:

```powershell
cd frontend
npm test
```

## API

- `POST /log-meal`
- `GET /foods`
- `POST /foods`
- `GET /daily-summary`
- `GET /history`
- `PATCH /meal/{id}`
- `DELETE /meal/{id}`

Food references are stored locally in SQLite. A reference like `10 g almond = 58`
lets the calorie engine calculate `20 g almond = 116` later without any network
lookup or LLM call.

Meal logging is structured. The app does not infer missing quantities or units:

```json
{
  "items": [
    { "name": "almond", "quantity": 20, "unit": "g" }
  ]
}
```

Goals can be saved as either a daily goal or weekly goal. The backend calculates
today's target from the weekly budget and redistributes over/under amounts from
previous logged days in the same week.
