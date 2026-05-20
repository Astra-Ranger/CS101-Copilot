# CS101 Static Learning Workspace

This frontend is now a traditional HTML/CSS/JS prototype served by the Flask app in `backend/`. It no longer uses Next.js, React, Zustand, Tailwind, Vercel AI SDK, or `npm run dev`.

## Current Architecture

- `frontend/index.html`: two-column workspace markup. The left column is split into Slide and Notes, and the right column is Chat.
- `frontend/styles.css`: all layout and visual styling.
- `frontend/app.js`: local state, course selection, slide rendering, mock chat, citation jumping, note autosave.
- `frontend/slides-manifest.js`: tiny fallback manifest used only if the slide APIs are unavailable.
- `backend/main.py`: Flask app that serves the static frontend, exposes `/health`, and provides slide catalog APIs.
- `docker_1.py`: scans `course_slide/<week>/<deck>/page_###.webp` and builds course/slide metadata.
- `backend/user_notes.json`: local single-user note store created on first note save.

The slide APIs now read from the real `course_slide` directory. Notes are saved by the Flask backend. Chat still uses local/mock behavior.

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
COURSE_NOTES_PATH=backend/user_notes.json
```

`COURSE_SLIDE_ROOT` controls which slide directory the Flask APIs scan.
`COURSE_NOTES_PATH` controls where the local notes JSON file is stored.

## Current Frontend Behavior

- The page is a 100vh two-column workspace: Slide and Notes are stacked on the left, Chat is on the right.
- `CS101 Copliot` is shown above the workspace.
- The top-right course selector tries `GET /api/courses`, then falls back to `slides-manifest.js`.
- `demo-course` maps to the detected `week16` review deck from the Flask API.
- The slide column tries `GET /api/slides/<course_id>`, then falls back to static manifest slide paths.
- Chat messages are mocked in the browser with `setTimeout`.
- Citation text like `[引用第5页]` and `[第5页]` is converted into a button that scrolls the slide column to that page.
- Notes are saved immediately to `localStorage`. In auto mode they are saved to `POST /api/notes/<course_id>` after 2 seconds; in manual mode the user clicks `保存`.

## API Contract

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

- `/` opens the two-column workspace.
- `/course/demo-course` opens the same workspace.
- `/health` returns `{ "status": "ok" }`.
- The top of the page shows `CS101 Copliot` above the workspace.
- The top-right header has a selectable course list.
- Choosing a course reloads the slide column from the API or fallback manifest.
- Clicking `[引用第5页]` scrolls the slide column to page 5.
- Sending a chat message creates a mock assistant reply.
- Editing notes writes to `localStorage`.
- Stopping note input for 2 seconds logs `笔记已保存`.
