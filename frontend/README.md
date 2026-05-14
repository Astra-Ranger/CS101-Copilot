# CS101 Static Learning Workspace

This frontend is now a traditional HTML/CSS/JS prototype served by the Flask shell in `backend/`. It no longer uses Next.js, React, Zustand, Tailwind, Vercel AI SDK, or `npm run dev`.

## Current Architecture

- `frontend/index.html`: three-column workspace markup.
- `frontend/styles.css`: all layout and visual styling.
- `frontend/app.js`: local state, course selection, slide rendering, mock chat, citation jumping, note autosave.
- `frontend/slides-manifest.js`: temporary static course manifest while the Flask API is a shell.
- `frontend/API.md`: full API contract expected by the frontend.
- `backend/main.py`: Flask shell that serves the static frontend, exposes `/health`, and reserves future API paths.

The backend is intentionally a shell. Business APIs currently return `501 NOT_IMPLEMENTED`; the frontend falls back to local manifest/mock behavior.

## Run

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Open:

```txt
http://127.0.0.1:5001/
http://127.0.0.1:5001/course/demo-course
```

Do not run the old Next.js command:

```bash
cd frontend
npm run dev
```

## Environment

Copy the root `.env.example` to `.env` if you need to change defaults:

```bash
cp .env.example .env
```

Current variables:

```env
FLASK_HOST=127.0.0.1
FLASK_PORT=5001
FLASK_DEBUG=1
COURSE_SLIDE_ROOT=course_slide
```

`COURSE_SLIDE_ROOT` is reserved for the future slide APIs. The current Flask shell does not scan it yet.

## Current Frontend Behavior

- The page is a 100vh three-column workspace: Slide, Chat, Notes.
- `CS101 Copliot` is shown above the three columns.
- The slide panel has a course selector. It tries `GET /api/courses`, then falls back to `slides-manifest.js`.
- `demo-course` maps to `week16--计科导-16-期末复习` in the fallback manifest.
- The slide column tries `GET /api/slides/<course_id>`, then falls back to static manifest slide paths.
- Chat messages are mocked in the browser with `setTimeout`.
- Citation text like `[引用第5页]` and `[第5页]` is converted into a button that scrolls the slide column to that page.
- Notes are saved immediately to `localStorage`, then a mock autosave runs after 2 seconds and logs `笔记已保存`.

## API Contract

See `frontend/API.md` for the complete frontend API contract:

- `GET /health`
- `GET /api/courses`
- `GET /api/slides/<course_id>`
- `GET /api/slides/<course_id>/pages/<page_number>`
- `POST /api/notes/<course_id>`
- `POST /api/chat`

## Later Backend Additions

- User login/session handling.
- Note loading endpoint.
- Streaming AI responses.
- Database persistence.
- Production-safe static/media serving.

## Manual Test Checklist

- `/` opens the three-column workspace.
- `/course/demo-course` opens the same workspace.
- `/health` returns `{ "status": "ok" }`.
- The top of the page shows `CS101 Copliot` above the three columns.
- The left column has a selectable course list.
- Choosing a course reloads the slide column from the API or fallback manifest.
- Clicking `[引用第5页]` scrolls the slide column to page 5.
- Sending a chat message creates a mock assistant reply.
- Editing notes writes to `localStorage`.
- Stopping note input for 2 seconds logs `笔记已保存`.
