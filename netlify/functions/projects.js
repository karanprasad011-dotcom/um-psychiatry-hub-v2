exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'umpsych2026';

  try {
    // Dynamically import @netlify/blobs at runtime
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('projects');

    if (event.httpMethod === 'GET') {
      try {
        const result = await store.get('all', { type: 'json' });
        const projects = Array.isArray(result) ? result : [];
        return { statusCode: 200, headers, body: JSON.stringify(projects) };
      } catch {
        return { statusCode: 200, headers, body: JSON.stringify([]) };
      }
    }

    if (event.httpMethod === 'POST') {
      const { password, action, project, id } = JSON.parse(event.body);
      if (password !== ADMIN_PASSWORD) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

      let projects = [];
      try {
        const result = await store.get('all', { type: 'json' });
        if (Array.isArray(result)) projects = result;
      } catch {}

      if (action === 'save') {
        const now = new Date().toISOString();
        const saved = { ...project, id: project.id || `proj_${Date.now()}`, createdAt: project.createdAt || now, updatedAt: now };
        const idx = projects.findIndex(p => p.id === saved.id);
        if (idx >= 0) projects[idx] = saved; else projects.unshift(saved);
        await store.setJSON('all', projects);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, project: saved }) };
      }

      if (action === 'delete') {
        projects = projects.filter(p => p.id !== id);
        await store.setJSON('all', projects);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
