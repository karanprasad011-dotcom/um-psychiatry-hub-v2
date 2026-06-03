const https = require('https');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'umpsych2026';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || 'pat57hastw0MzvPiZ.c9b0493bbf8600799720f085692db0f663ee15aef70682f363a4bf39ef37368a';
const BASE_ID = 'appVpFZgycFM6Seat';
const TABLE_ID = 'tblcGVrdBixm2RIep';

function airtableRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.airtable.com',
      path: `/v0/${BASE_ID}/${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
        ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) })
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function recordToProject(record) {
  return {
    id: record.id,
    airtableId: record.id,
    title: record.fields.title || '',
    pi: record.fields.pi || '',
    contact: record.fields.contact || '',
    description: record.fields.description || '',
    specialty: record.fields.specialty || '',
    level: record.fields.level || '',
    commitment: record.fields.commitment || '',
    status: record.fields.status || 'open',
    tag: record.fields.tag || 'Research',
    timeline: record.fields.timeline || '',
    skills: record.fields.skills || '',
  };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (event.httpMethod === 'GET') {
    try {
      const res = await airtableRequest('GET', `${TABLE_ID}?view=Grid%20view`);
      if (res.status !== 200) return { statusCode: 200, headers, body: JSON.stringify([]) };
      const projects = (res.body.records || []).map(recordToProject);
      return { statusCode: 200, headers, body: JSON.stringify(projects) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { password, action, project, id } = JSON.parse(event.body);
      if (password !== ADMIN_PASSWORD) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

      if (action === 'save') {
        const fields = {
          title: project.title || '',
          pi: project.pi || '',
          contact: project.contact || '',
          description: project.description || '',
          specialty: project.specialty || '',
          level: project.level || '',
          commitment: project.commitment || '',
          status: project.status || 'open',
          tag: project.tag || 'Research',
          timeline: project.timeline || '',
          skills: project.skills || '',
        };

        let res;
        if (project.airtableId) {
          // Update existing record
          res = await airtableRequest('PATCH', `${TABLE_ID}/${project.airtableId}`, { fields });
        } else {
          // Create new record
          res = await airtableRequest('POST', TABLE_ID, { records: [{ fields }] });
        }

        if (res.status === 200 || res.status === 201) {
          const record = res.body.id ? res.body : res.body.records?.[0];
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, project: recordToProject(record) }) };
        }
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save', details: res.body }) };
      }

      if (action === 'delete') {
        const res = await airtableRequest('DELETE', `${TABLE_ID}/${id}`);
        if (res.status === 200) return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Failed to save', status: res.status, details: res.body }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
