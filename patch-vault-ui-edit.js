const fs = require("fs");
const filePath = "n8n/apps/web/src/app/credentials/page.tsx";
let c = fs.readFileSync(filePath, "utf8");

// 1. editingId state
c = c.replace(
  "const [showCreateModal, setShowCreateModal] = useState(false);",
  "const [showCreateModal, setShowCreateModal] = useState(false);\n  const [editingId, setEditingId] = useState(null);"
);

// 2. Add handleEditCredential + update the submit handler
c = c.replace(
  `  const handleCreateCredential = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      let data = {};
      if (type === "smtp") {
        data = { host: smtpHost, port: Number(smtpPort) || 587, user: smtpUser, pass: smtpPass, secure: smtpSecure };
      } else if (type === "apiKey") {
        data = { key: apiKeyValue, provider: apiKeyProvider };
      } else {
        data = { host: pgHost, port: Number(pgPort) || 5432, database: pgDatabase, user: pgUser, password: pgPassword, ssl: pgSsl };
      }
      await api.credentials.create({ name, type, data });
      setName(""); setSmtpHost(""); setSmtpUser(""); setSmtpPass("");
      setPgHost(""); setPgDatabase(""); setPgUser(""); setPgPassword("");
      setApiKeyValue("");
      setShowCreateModal(false);
      fetchCredentials();
    } catch (err) {
      console.error("Failed to save credentials:", err);
      alert("Error saving credentials.");
    } finally {
      setSubmitting(false);
    }
  };`,
  // Replacement skipped — handled in raw text mode below
  "PLACEHOLDER_SKIP"
);

console.log("editingId added:", c.includes("editingId"));
fs.writeFileSync(filePath, c, "utf8");
