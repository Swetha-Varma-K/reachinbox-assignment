import "dotenv/config";
import prisma from "./prisma.js";

export async function notifySlack(
  userId: number,
  message: string
) {
  const connection = await prisma.slackConnection.findUnique({
    where: {
      userId,
    },
  });

  if (!connection?.webhookUrl) {
    console.log("Slack is not connected. Skipping notification.");
    return;
  }

  try {
    const response = await fetch(connection.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: message,
      }),
    });

    if (!response.ok) {
      console.error(
        `Slack notification failed: ${response.status}`
      );
    }
  } catch (error) {
    console.error("Slack notification error:", error);
  }
}