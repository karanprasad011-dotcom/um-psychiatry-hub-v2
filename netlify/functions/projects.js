const { getStore } = require("@netlify/blobs");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "umpsych2026";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // GET - fetch all projects
  if (event.httpMethod === "GET") {
    try {
      const store = getStore("projects");
      const { blobs } = await store.list();
      const projects = await Promise.all(
        blobs.map(async ({ key }) => {
          const data = await store.get(key, { type: "json" });
          return data;
        })
      );
      projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { statusCode: 200, headers, body: JSON.stringify(projects) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST - save or delete
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body);
      const { password, action, project, id } = body;

      if (password !== ADMIN_PASSWORD) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
      }

      const store = getStore("projects");

      if (action === "save") {
        const now = new Date().toISOString();
        const saved = {
          ...project,
          id: project.id || `proj_${Date.now()}`,
          createdAt: project.createdAt || now,
          updatedAt: now,
        };
        await store.setJSON(saved.id, saved);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, project: saved }) };
      }

      if (action === "delete") {
        await store.delete(id);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action" }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
