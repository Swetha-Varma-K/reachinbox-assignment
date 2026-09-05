import { useEffect, useState, type ChangeEvent } from "react";
import axios from "axios";

type Email = {
  id: number;
  recipient: string;
  subject: string;
  scheduledAt?: string;
  sentAt?: string;
  status: string;
};

const API = "http://localhost:5000";

function App() {
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">(
    "scheduled"
  );

  const [scheduled, setScheduled] = useState<Email[]>([]);
  const [sent, setSent] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
const [searchResults, setSearchResults] = useState<Email[]>([]);

  const [showCompose, setShowCompose] = useState(false);

  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [delay, setDelay] = useState(2000);
const [hourlyLimit, setHourlyLimit] = useState(100);
  const [recipients, setRecipients] = useState<string[]>([]);
const [fileName, setFileName] = useState("");

  const [user, setUser] = useState<{
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  senderId: number | null;
} | null>(null);

  async function loadUser() {
  try {
    const response = await axios.get(`${API}/auth/me`, {
      withCredentials: true,
    });

    if (response.data.authenticated) {
  setUser({
    ...response.data.user,
    senderId: response.data.senderId,
  });
}
  } catch (error) {
    console.error("Failed to load user:", error);
  }
}

  useEffect(() => {
  loadUser();
}, []);

useEffect(() => {
  if (user) {
    loadEmails();
  }
}, [user]);

async function searchEmails() {
  if (!user || !searchQuery.trim()) {
    setSearchResults([]);
    return;
  }

  try {
    const response = await axios.get(
      `${API}/emails/search?userId=${user.id}&q=${encodeURIComponent(
        searchQuery
      )}`,
      {
        withCredentials: true,
      }
    );

    setSearchResults(response.data);
  } catch (error) {
    console.error("Search failed:", error);
    alert("Search failed.");
  }
}

  async function loadEmails() {
    try {
      setLoading(true);

      if (!user) return;

const [scheduledResponse, sentResponse] = await Promise.all([
  axios.get(`${API}/emails/scheduled?userId=${user.id}`, {
    withCredentials: true,
  }),
  axios.get(`${API}/emails/sent?userId=${user.id}`, {
    withCredentials: true,
  }),
]);

      setScheduled(scheduledResponse.data);
      setSent(sentResponse.data);
    } catch (error) {
      console.error("Failed to load emails:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(
  event: ChangeEvent<HTMLInputElement>
) {
  const file = event.target.files?.[0];

  if (!file) return;

  setFileName(file.name);

  const text = await file.text();

  const matches = text.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  );

  const uniqueEmails = [...new Set(matches || [])];

  setRecipients(uniqueEmails);

  if (uniqueEmails.length > 0) {
    setRecipient(uniqueEmails[0]);
  }
}


  async function scheduleEmail() {
  if (!subject || !body || !scheduledAt) {
    alert("Please fill subject, body and start time.");
    return;
  }

  const emailRecipients =
    recipients.length > 0 ? recipients : [recipient];

  if (emailRecipients.length === 0 || !emailRecipients[0]) {
    alert("Please enter a recipient email or upload a file.");
    return;
  }

  try {
    for (let i = 0; i < emailRecipients.length; i++) {
      const emailTime = new Date(
  new Date(scheduledAt).getTime() + i * delay
);

      await axios.post(`${API}/emails/schedule`, {
        recipient: emailRecipients[i],
        subject,
        body,
        scheduledAt: emailTime.toISOString(),
        senderId: user?.senderId,
userId: user?.id,
hourlyLimit,
}, {
  withCredentials: true,
});
    }

    alert(
      `${emailRecipients.length} email(s) scheduled successfully!`
    );

    setRecipient("");
    setRecipients([]);
    setSubject("");
    setBody("");
    setScheduledAt("");
    setFileName("");
    setDelay(2000);
setHourlyLimit(100);
    setShowCompose(false);

    await loadEmails();
  } catch (error) {
    console.error("Failed to schedule emails:", error);
    alert("Failed to schedule email(s).");
  }
}

  const emails = activeTab === "scheduled" ? scheduled : sent;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              ReachInbox
            </h1>

            <p className="text-sm text-gray-500">
              Email scheduling dashboard
            </p>
          </div>

          {user && (
  <div className="flex items-center gap-3">
    <div>
      <p className="text-sm font-semibold">{user.name}</p>
      <p className="text-xs text-gray-500">{user.email}</p>
    </div>

    <button
      onClick={() => {
        window.location.href = `${API}/auth/logout`;
      }}
      className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
    >
      Logout
    </button>
  </div>
)}

          <button
            onClick={loadEmails}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-8 py-8">

  {/* Search */}
  <div className="mb-6 flex gap-2">
    <input
      type="text"
      placeholder="Search emails..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          searchEmails();
        }
      }}
      className="flex-1 rounded-lg border px-4 py-2"
    />

    <button
      onClick={searchEmails}
      className="rounded-lg bg-gray-900 px-5 py-2 text-white"
    >
      Search
    </button>
  </div>

  {searchResults.length > 0 && (
  <div className="mb-6 rounded-lg border bg-white p-4">
    <h2 className="mb-3 text-lg font-semibold">
      Search Results
    </h2>

    <div className="space-y-2">
      {searchResults.map((email) => (
        <div
          key={email.id}
          className="flex items-center justify-between rounded border p-3"
        >
          <div>
            <p className="font-medium">{email.recipient}</p>
            <p className="text-sm text-gray-600">{email.subject}</p>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
            {email.status}
          </span>
        </div>
      ))}
    </div>
  </div>
)}

  {/* Tabs */}
  <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("scheduled")}
              className={`rounded-lg px-5 py-2 font-medium ${
                activeTab === "scheduled"
                  ? "bg-gray-900 text-white"
                  : "border bg-white text-gray-600"
              }`}
            >
              Scheduled
            </button>

            <button
              onClick={() => setActiveTab("sent")}
              className={`rounded-lg px-5 py-2 font-medium ${
                activeTab === "sent"
                  ? "bg-gray-900 text-white"
                  : "border bg-white text-gray-600"
              }`}
            >
              Sent
            </button>
          </div>

          <button
            onClick={() => setShowCompose(true)}
            className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
          >
            + Compose
          </button>
        </div>

        {/* Email Table */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading emails...
            </div>
          ) : emails.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              No {activeTab} emails found.
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">
                    {activeTab === "scheduled"
                      ? "Scheduled Time"
                      : "Sent Time"}
                  </th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>

              <tbody>
                {emails.map((email) => (
                  <tr key={email.id} className="border-b last:border-0">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {email.recipient}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-700">
                      {email.subject}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(
                        activeTab === "scheduled"
                          ? email.scheduledAt!
                          : email.sentAt!
                      ).toLocaleString()}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          email.status === "SENT"
                            ? "bg-green-100 text-green-700"
                            : email.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {email.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Compose Email
              </h2>

              <button
                onClick={() => setShowCompose(false)}
                className="text-xl text-gray-500 hover:text-gray-900"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
  <label className="mb-1 block text-sm font-medium text-gray-700">
    Upload Recipients CSV / Text File
  </label>

  <input
    type="file"
    accept=".csv,.txt"
    onChange={handleFileUpload}
    className="w-full rounded-lg border px-3 py-2 text-sm"
  />

  {fileName && (
    <p className="mt-2 text-sm text-gray-600">
      {fileName} — {recipients.length} email(s) detected
    </p>
  )}
</div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Recipient Email
                </label>

                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Subject
                </label>

                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Body
                </label>

                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email..."
                  rows={5}
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Start Time
                </label>

                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
  <label className="mb-1 block text-sm font-medium text-gray-700">
    Delay Between Emails (milliseconds)
  </label>

  <input
    type="number"
    min="0"
    value={delay}
    onChange={(e) => setDelay(Number(e.target.value))}
    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
  />

  <p className="mt-1 text-xs text-gray-500">
    Example: 2000 = 2 seconds
  </p>
</div>

<div>
  <label className="mb-1 block text-sm font-medium text-gray-700">
    Maximum Emails Per Hour
  </label>

  <input
    type="number"
    min="1"
    value={hourlyLimit}
    onChange={(e) => setHourlyLimit(Number(e.target.value))}
    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCompose(false)}
                className="rounded-lg border px-4 py-2 font-medium text-gray-700"
              >
                Cancel
              </button>

              <button
                onClick={scheduleEmail}
                className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
              >
                Schedule Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;