import { Queue } from "bullmq";
import redis from "../lib/redis.js";

const emailQueue = new Queue("email-queue", {
  connection: redis,
});

export default emailQueue;