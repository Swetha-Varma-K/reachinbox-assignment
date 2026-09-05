import elasticsearch from "./elasticsearch.js";

const INDEX_NAME = "emails";

export async function indexEmail(email: {
  id: number;
  userId: number;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  sentAt: Date | null;
  status: string;
}) {
  await elasticsearch.index({
    index: INDEX_NAME,
    id: String(email.id),
    document: {
      id: email.id,
      userId: email.userId,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      scheduledAt: email.scheduledAt.toISOString(),
      sentAt: email.sentAt?.toISOString() ?? null,
      status: email.status,
    },
  });
}

export async function searchEmails(userId: number, query: string) {
  const response = await elasticsearch.search({
    index: INDEX_NAME,
    query: {
      bool: {
        must: [
          {
            term: {
              userId,
            },
          },
          {
            multi_match: {
              query,
              fields: ["recipient", "subject", "body"],
            },
          },
        ],
      },
    },
  });

  return response.hits.hits.map((hit) => hit._source);
}