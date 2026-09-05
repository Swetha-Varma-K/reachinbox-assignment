import express from "express";
import prisma from "./lib/prisma.js";
import emailQueue from "./queue/emailQueue.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import elasticsearch from "./lib/elasticsearch.js";
import { searchEmails, indexEmail } from "./lib/emailSearch.js";
import cors from "cors";

import session from "express-session";
import passport from "./lib/googleAuth.js";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

const app = express();

const PORT = 5000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

app.get("/", (req, res) => {
  res.json({
    message: "ReachInbox backend is running!",
  });
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await prisma.user.count();

    res.json({
      message: "Database connection successful!",
      userCount: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Database connection failed",
    });
  }
});

app.post("/dev/setup", async (req, res) => {
  try {
    const testAccount = await nodemailer.createTestAccount();

    const user = await prisma.user.upsert({
      where: {
        googleId: "dev-test-user",
      },
      update: {},
      create: {
        googleId: "dev-test-user",
        name: "Test User",
        email: testAccount.user,
        avatar: null,
      },
    });

    const existingSender = await prisma.sender.findFirst({
      where: {
        userId: user.id,
        email: testAccount.user,
      },
    });

    const sender =
      existingSender ??
      (await prisma.sender.create({
        data: {
          userId: user.id,
          email: testAccount.user,
          etherealUser: testAccount.user,
          etherealPassword: testAccount.pass,
        },
      }));

    res.json({
      message: "Development user and sender created!",
      userId: user.id,
      senderId: sender.id,
      senderEmail: sender.email,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create development user",
    });
  }
});

app.post("/test-email", async (req, res) => {
  try {
    const { recipient, subject, body } = req.body;

    const job = await emailQueue.add(
      "send-email",
      {
        recipient,
        subject,
        body,
      },
      {
        delay: 5000,
        attempts: 3,
      }
    );

    res.json({
      message: "Email job added successfully!",
      jobId: job.id,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to add email job",
    });
  }
});

app.post("/emails/schedule", async (req, res) => {
  try {
    const {
  recipient,
  subject,
  body,
  scheduledAt,
  senderId,
  userId,
  hourlyLimit,
} = req.body;

    if (
      !recipient ||
      !subject ||
      !body ||
      !scheduledAt ||
      !senderId ||
      !userId
    ) {
      return res.status(400).json({
        message: "recipient, subject, body, scheduledAt, senderId and userId are required",
      });
    }

    const scheduledDate = new Date(scheduledAt);

    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        message: "Invalid scheduledAt date",
      });
    }

    if (scheduledDate.getTime() <= Date.now()) {
      return res.status(400).json({
        message: "scheduledAt must be in the future",
      });
    }

    const sender = await prisma.sender.findUnique({
  where: {
    id: Number(senderId),
  },
});

if (!sender) {
  return res.status(404).json({
    message: "Sender not found",
  });
}

if (hourlyLimit !== undefined) {
  const limit = Number(hourlyLimit);

  if (!Number.isInteger(limit) || limit <= 0) {
    return res.status(400).json({
      message: "hourlyLimit must be a positive integer",
    });
  }

  await prisma.sender.update({
    where: {
      id: Number(senderId),
    },
    data: {
      hourlyLimit: limit,
    },
  });
}

    const idempotencyKey = crypto.randomUUID();

    const email = await prisma.email.create({
      data: {
        userId: Number(userId),
        senderId: Number(senderId),
        recipient,
        subject,
        body,
        scheduledAt: scheduledDate,
        status: "SCHEDULED",
        idempotencyKey,
      },
    });

    await indexEmail(email);

    const delay = scheduledDate.getTime() - Date.now();

    const job = await emailQueue.add(
      "send-email",
      {
        emailId: email.id,
      },
      {
        delay,
        jobId: idempotencyKey,
        attempts: 3,
      }
    );

    await prisma.email.update({
      where: {
        id: email.id,
      },
      data: {
        jobId: job.id,
      },
    });

    res.status(201).json({
      message: "Email scheduled successfully!",
      emailId: email.id,
      jobId: job.id,
      scheduledAt: scheduledDate,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to schedule email",
    });
  }
});

app.get("/emails/scheduled", async (req, res) => {
  try {
    const userId = Number(req.query.userId || 1);

    const emails = await prisma.email.findMany({
      where: {
        userId,
        status: {
          in: ["SCHEDULED", "PROCESSING"],
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      select: {
        id: true,
        recipient: true,
        subject: true,
        scheduledAt: true,
        status: true,
      },
    });

    res.json(emails);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch scheduled emails",
    });
  }
});

app.get("/emails/sent", async (req, res) => {
  try {
    const userId = Number(req.query.userId || 1);

    const emails = await prisma.email.findMany({
      where: {
        userId,
        status: {
          in: ["SENT", "FAILED"],
        },
      },
      orderBy: {
        sentAt: "desc",
      },
      select: {
        id: true,
        recipient: true,
        subject: true,
        sentAt: true,
        status: true,
      },
    });

    res.json(emails);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch sent emails",
    });
  }
});

app.get("/emails/search", async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    const query = String(req.query.q || "").trim();

    if (!userId || !query) {
      return res.status(400).json({
        message: "userId and q are required",
      });
    }

    const results = await searchEmails(userId, query);

    return res.json({
      results,
    });
  } catch (error) {
    console.error("Email search failed:", error);

    return res.status(500).json({
      message: "Failed to search emails",
    });
  }
});

app.get("/auth/slack", (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({
      error: "SLACK_CLIENT_ID is not configured",
    });
  }

  const redirectUri =
    "http://localhost:5000/auth/slack/callback";

  const state = crypto.randomBytes(16).toString("hex");

  const slackUrl =
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent("incoming-webhook")}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(slackUrl);
});

app.get("/auth/slack/callback", async (req, res) => {
  const code = req.query.code;

  if (typeof code !== "string") {
    return res.status(400).json({
      error: "Missing Slack authorization code",
    });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "Slack OAuth credentials are not configured",
    });
  }

  try {
    const response = await fetch(
      "https://slack.com/api/oauth.v2.access",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri:
            "http://localhost:5000/auth/slack/callback",
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error("Slack OAuth error:", data);

      return res.status(400).json({
        error: "Slack OAuth failed",
        details: data.error,
      });
    }

    const userId = 1;

    await prisma.slackConnection.upsert({
      where: {
        userId,
      },
      update: {
        accessToken: data.access_token,
        teamId: data.team?.id ?? null,
        webhookUrl:
          data.incoming_webhook?.url ?? null,
      },
      create: {
        userId,
        accessToken: data.access_token,
        teamId: data.team?.id ?? null,
        webhookUrl:
          data.incoming_webhook?.url ?? null,
      },
    });

    res.send(`
      <h2>Slack connected successfully! ✅</h2>
      <p>You can close this window and return to ReachInbox.</p>
    `);
  } catch (error) {
    console.error("Slack OAuth error:", error);

    res.status(500).json({
      error: "Failed to connect Slack",
    });
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/google/failure",
  }),
  (req, res) => {
    res.redirect("http://localhost:5173");
  }
);

app.get("/auth/google/failure", (_req, res) => {
  res.status(401).send("Google authentication failed.");
});

app.get("/auth/me", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      authenticated: false,
    });
  }

  const user = req.user as { id: number };

  const sender = await prisma.sender.findFirst({
    where: {
      userId: user.id,
    },
  });

  res.json({
    authenticated: true,
    user: req.user,
    senderId: sender?.id ?? null,
  });
});

app.get("/auth/logout", (req, res) => {
  req.logout((error) => {
    if (error) {
      return res.status(500).json({
        error: "Logout failed",
      });
    }

    req.session.destroy(() => {
      res.redirect("http://localhost:5173");
    });
  });
});

app.listen(5000, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.get("/es-test", async (_req, res) => {
  try {
    const response = await elasticsearch.info();

    res.json({
      success: true,
      cluster: response.cluster_name,
      version: response.version.number,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Elasticsearch connection failed",
    });
  }
});