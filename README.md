# ReachInbox – Email Scheduling System

A full-stack email scheduling application developed for the **Outbox Labs Software Development Intern Assignment**.

The application allows users to log in using Google, upload recipient email addresses, schedule emails, process them asynchronously using BullMQ and Redis, apply configurable rate limits and delays, search emails using Elasticsearch, and view Scheduled and Sent emails through a React dashboard.

---

## 🔗 Project Links

### GitHub Repository

https://github.com/Swetha-Varma-K/reachinbox-assignment

### Live Demo

> To be added after deployment.

**Live Demo:** `PASTE_LIVE_DEMO_URL_HERE`

### Demo Video

> Short demonstration video covering the assignment requirements.

**Demo Video:** `PASTE_DEMO_VIDEO_URL_HERE`

---

# 1. Tech Stack

## Backend

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis / Memurai
- BullMQ
- Nodemailer
- Ethereal Email
- Elasticsearch
- Passport.js
- Google OAuth 2.0
- Slack Webhooks / OAuth
- Bull Board

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Axios

---

# 2. Project Structure

```text
reachinbox-assignment/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── auth/
│   │   │   └── googleAuth.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   ├── redis.ts
│   │   │   ├── slack.ts
│   │   │   └── elasticsearch.ts
│   │   │
│   │   ├── queue/
│   │   │   └── emailQueue.ts
│   │   │
│   │   ├── workers/
│   │   │   └── emailWorker.ts
│   │   │
│   │   └── server.ts
│   │
│   ├── .env
│   ├── package.json
│   ├── prisma.config.ts
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.tsx
│   │
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── .gitignore
└── README.md
