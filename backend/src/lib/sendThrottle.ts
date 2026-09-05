import redis from "./redis.js";

export async function acquireSendSlot(
  senderId: number,
  minDelayMs: number
): Promise<{
  allowed: boolean;
  retryAt: number;
}> {
  const key = `send-delay:${senderId}`;
  const now = Date.now();

  const result = await redis.eval(
    `
    local lastSend = tonumber(redis.call("GET", KEYS[1]) or "0")
    local now = tonumber(ARGV[1])
    local delay = tonumber(ARGV[2])

    if lastSend > 0 and (now - lastSend) < delay then
      return lastSend + delay
    end

    redis.call("SET", KEYS[1], now, "PX", delay + 10000)
    return 0
    `,
    1,
    key,
    now,
    minDelayMs
  );

  const retryAt = Number(result);

  if (retryAt === 0) {
    return {
      allowed: true,
      retryAt: now,
    };
  }

  return {
    allowed: false,
    retryAt,
  };
}