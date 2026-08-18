const https = require('https');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'umpsych2026';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = 'appVpFZgycFM6Seat';
const TABLE_ID = 'tblSF0AU4vD8KgfEq';

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

function recordToConf(record) {
  return {
    id: record.id,
    airtableId: record.id,
    name: record.fields.name || '',
    org: record.fields.org || '',
    abstract_date: record.fields.abstract_date || '',
    conference_date: record.fields.conference_date || '',
    location: record.fields.location || '',
    website: record.fields.website || '',
    notes: record.fields.notes || '',
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
      const res = await airtableRequest('GET', `${TABLE_ID}?maxRecords=100`);
      if (res.status !== 200) return { statusCode: 200, headers, body: JSON.stringify([]) };
      const conferences = (res.body.records || []).map(recordToConf);
      return { statusCode: 200, headers, body: JSON.stringify(conferences) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { password, action, conference, id } = JSON.parse(event.body);
      if (password !== ADMIN_PASSWORD) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

      if (action === 'save') {
        const fields = {
          name: conference.name || '',
          org: conference.org || '',
          abstract_date: conference.abstract_date || null,
          conference_date: conference.conference_date || null,
          location: conference.location || '',
          website: conference.website || '',
          notes: conference.notes || '',
        };
        // Airtable date fields reject empty strings; only send if present
        if (!fields.abstract_date) delete fields.abstract_date;
        if (!fields.conference_date) delete fields.conference_date;

        let res;
        if (conference.airtableId) {
          res = await airtableRequest('PATCH', `${TABLE_ID}/${conference.airtableId}`, { fields });
        } else {
          res = await airtableRequest('POST', TABLE_ID, { records: [{ fields }] });
        }

        if (res.status === 200 || res.status === 201) {
          const record = res.body.id ? res.body : res.body.records?.[0];
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, conference: recordToConf(record) }) };
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: JSON.stringify(res.body) }) };
      }

      if (action === 'delete') {
        const res = await airtableRequest('DELETE', `${TABLE_ID}/${id}`);
        if (res.status === 200) return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to delete' }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
