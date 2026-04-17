const admin = require('firebase-admin');

function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return admin.firestore();
}

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let games;
  try {
    const body = JSON.parse(event.body);
    games = body.games;
    if (!Array.isArray(games)) throw new Error('games must be an array');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  try {
    const db = getDb();
    const lastUpdated = new Date().toISOString();
    await db.collection('lotteryData').doc('current').set({ games, lastUpdated });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ lastUpdated }),
    };
  } catch (err) {
    console.error('save-cloud-data error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to save cloud data' }),
    };
  }
};
