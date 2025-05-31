const admin = require('firebase-admin');
const ServiceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  const serviceAccount = ServiceAccount
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.log('Firebase Admin already initialized');
}

module.exports = admin;