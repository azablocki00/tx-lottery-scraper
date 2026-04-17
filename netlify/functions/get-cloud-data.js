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

exports.handler = async () => {
  try {
    const db = getDb();
    const doc = await db.collection('lotteryData').doc('current').get();

    if (!doc.exists) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ games: null, lastUpdated: null }),
      };
    }

    const { games, lastUpdated } = doc.data();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ games, lastUpdated }),
    };
  } catch (err) {
    console.error('get-cloud-data error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to read cloud data' }),
    };
  }
};
