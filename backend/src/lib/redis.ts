import "dotenv/config";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not defined");
}

const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export default redis;