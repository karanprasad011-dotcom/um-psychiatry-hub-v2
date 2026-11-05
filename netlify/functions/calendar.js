const https = require('https');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'umpsych2026';
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = 'appVpFZgycFM6Seat';
const TABLE_ID = 'tblSF0AU4vD8KgfEq';

// Airtable field names used by this function (must match the Airtable table EXACTLY):
//   name, org, abstract_date, conference_date, conference_end_date,
//   edition_year, location, website, notes

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
  const f = record.fields || {};
  return {
    id: record.id,
    airtableId: record.id,
    name: f.name || '',
    org: f.org || '',
    abstract_date: f.abstract_date || '',
    conference_date: f.conference_date || '',
    conference_end_date: f.conference_end_date || '',
    edition_year: f.edition_year || '',
    location: f.location || '',
    website: f.website || '',
    notes: f.notes || '',
  };
}

// Fetch every record, following Airtable's pagination (100 per page)
async function fetchAllRecords() {
  let records = [];
  let offset = null;
  do {
    const path = `${TABLE_ID}?pageSize=100` + (offset ? `&offset=${encodeURIComponent(offset)}` : '');
    const res = await airtableRequest('GET', path);
    if (res.status !== 200) throw new Error('Airtable returned ' + res.status);
    records = records.concat(res.body.records || []);
    offset = res.body.offset || null;
  } while (offset);
  return records;
}

function cleanDate(value) {
  // Accept only YYYY-MM-DD; anything else (blank, "TBD") becomes null = TBD
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null;
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
      const records = await fetchAllRecords();
      return { statusCode: 200, headers, body: JSON.stringify(records.map(recordToConf)) };
    } catch (err) {
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { password, action, conference, id } = JSON.parse(event.body);
      if (password !== ADMIN_PASSWORD) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

      if (action === 'save') {
        const start = cleanDate(conference.conference_date);
        let end = cleanDate(conference.conference_end_date);
        if (!start) end = null;                 // no start date means the whole thing is TBD
        if (start && end && end < start) {
          return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'End date is before the start date.' }) };
        }
        if (end === start) end = null;          // single-day conference

        let year = parseInt(conference.edition_year, 10);
        if (!year && start) year = Number(start.slice(0, 4));
        if (!year) year = null;

        // null tells Airtable to CLEAR the field. This is what makes "TBD" work when editing.
        const fields = {
          name: conference.name || '',
          org: conference.org || '',
          abstract_date: cleanDate(conference.abstract_date),
          conference_date: start,
          conference_end_date: end,
          edition_year: year,
          location: conference.location || '',
          website: conference.website || '',
          notes: conference.notes || '',
        };

        let res;
        if (conference.airtableId) {
          res = await airtableRequest('PATCH', `${TABLE_ID}/${conference.airtableId}`, { fields });
        } else {
          // When creating, leave out empty values rather than sending null
          Object.keys(fields).forEach(k => { if (fields[k] === null) delete fields[k]; });
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
