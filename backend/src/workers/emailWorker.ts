import "dotenv/config";
import { DelayedError, Worker } from "bullmq";
import redis from "../lib/redis.js";
import nodemailer from "nodemailer";
import prisma from "../lib/prisma.js";
import { checkHourlyLimit } from "../lib/rateLimiter.js";
import { acquireSendSlot } from "../lib/sendThrottle.js";
import { notifySlack } from "../lib/slack.js";

const worker = new Worker(
  "email-queue",
  async (job) => {
    console.log("Processing email job:", job.id);

const emailId = Number(job.data.emailId);

const existingEmail = await prisma.email.findUnique({
  where: {
    id: emailId,
  },
});

if (!existingEmail) {
  throw new Error(`Email ${emailId} not found`);
}

// If this email was already sent, never send it again.
if (existingEmail.status === "SENT") {
  console.log(`Email ${emailId} was already sent. Skipping duplicate job.`);
  return {
    alreadySent: true,
  };
}

// Atomically claim the email for processing.
const claimed = await prisma.email.updateMany({
  where: {
    id: emailId,
    status: "SCHEDULED",
  },
  data: {
    status: "PROCESSING",
  },
});

if (claimed.count === 0) {
  const currentEmail = await prisma.email.findUnique({
    where: {
      id: emailId,
    },
  });

  if (currentEmail?.status === "SENT") {
    console.log(`Email ${emailId} was already sent. Skipping duplicate.`);
    return {
      alreadySent: true,
    };
  }

  throw new Error(`Email ${emailId} is already being processed.`);
}

    const email = await prisma.email.findUnique({
  where: {
    id: Number(job.data.emailId),
  },
});

if (!email) {
  throw new Error(`Email ${job.data.emailId} not found`);
}

const { recipient, subject, body } = email;

const sender = await prisma.sender.findUnique({
  where: {
    id: email.senderId,
  },
});

if (!sender) {
  throw new Error(`Sender ${email.senderId} not found`);
}

const limitResult = await checkHourlyLimit(
  email.senderId,
  sender.hourlyLimit
);

if (!limitResult.allowed) {
  console.log(
    `Hourly limit reached for sender ${email.senderId}. Rescheduling job for next hour.`
  );

  await notifySlack(
  email.userId,
  `Hourly email limit reached for sender ${email.senderId}. Emails will resume next hour.`
);

  await prisma.email.update({
    where: {
      id: email.id,
    },
    data: {
      status: "SCHEDULED",
    },
  });

  await job.moveToDelayed(
    limitResult.retryAt,
    job.token
  );

  throw new DelayedError();
}

const minDelay = Number(process.env.MIN_EMAIL_DELAY_MS || 2000);

const throttleResult = await acquireSendSlot(
  email.senderId,
  minDelay
);

if (!throttleResult.allowed) {
  console.log(
    `Minimum delay not reached for sender ${email.senderId}. Rescheduling job.`
  );

  await prisma.email.update({
    where: {
      id: email.id,
    },
    data: {
      status: "SCHEDULED",
    },
  });

  await job.moveToDelayed(
    throttleResult.retryAt,
    job.token
  );

  throw new DelayedError();
}

    const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: {
    user: sender.etherealUser,
    pass: sender.etherealPassword,
  },
});

    const info = await transporter.sendMail({
      from: `"ReachInbox" <${sender.etherealUser}>`,
      to: recipient,
      subject,
      text: body,
    });
    console.log("Preview URL:", nodemailer.getTestMessageUrl(info));

    console.log("Email sent successfully!");
    console.log("Preview URL:", nodemailer.getTestMessageUrl(info));

    await prisma.email.update({
  where: {
    id: email.id,
  },
  data: {
    status: "SENT",
    sentAt: new Date(),
  },
});

    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  },
  {
    connection: redis,
    concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", async (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);

  if (job?.data?.emailId) {
    await prisma.email.update({
      where: {
        id: Number(job.data.emailId),
      },
      data: {
        status: "FAILED",
      },
    });
  }
});

console.log("Email worker is running...");