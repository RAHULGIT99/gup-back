# Event Management Backend (Express + MongoDB)

Files added under this folder implement the Event Management API used by the React frontend.

Environment
- Copy `.env.example` to `.env` and set `MONGODB_URI`.

Install & Run
- npm install (in the `express codes` folder)
- node server.js (this will load `server-modular/server.js`)
- To seed sample data: `node server-modular/seed.js`

API Endpoints
- POST /api/profiles
- GET /api/profiles
- PATCH /api/profiles/:id
- POST /api/events
- GET /api/events
- GET /api/events/:id
- PATCH /api/events/:id
- GET /api/events/:id/logs

Notes
- Dates are stored in UTC in MongoDB. Use timezone-aware clients.
