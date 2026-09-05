import redis from "./redis.js";

export async function checkHourlyLimit(
  senderId: number,
  hourlyLimit: number
): Promise<{
  allowed: boolean;
  count: number;
  retryAt: number;
}> {
  const now = new Date();

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");

  const hourKey = `${year}-${month}-${day}-${hour}`;
  const key = `rate-limit:${senderId}:${hourKey}`;

  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);

  const result = await redis.eval(
    `
    local current = tonumber(redis.call("GET", KEYS[1]) or "0")
    local limit = tonumber(ARGV[1])

    if current >= limit then
      return -1
    end

    local newCount = redis.call("INCR", KEYS[1])

    if newCount == 1 then
      redis.call("EXPIRE", KEYS[1], 3700)
    end

    return newCount
    `,
    1,
    key,
    hourlyLimit
  );

  const count = Number(result);

if (count === -1) {
  return {
    allowed: false,
    count: hourlyLimit,
    retryAt: nextHour.getTime(),
  };
}

return {
  allowed: true,
  count,
  retryAt: nextHour.getTime(),
};
}