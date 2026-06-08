const https = require('https');

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = 'appVpFZgycFM6Seat';
const TABLE_ID = 'tblSF0AU4vD8KgfEq';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const options = {
      hostname: 'api.airtable.com',
      path: `/v0/${BASE_ID}/${TABLE_ID}?maxRecords=100`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.end();
    });

    return {
      statusCode: result.statusCode,
      headers,
      body: result.body
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
