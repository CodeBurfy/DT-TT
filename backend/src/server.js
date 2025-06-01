const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const serviceAccount = require('./config/serviceAccountKey.json');
const listingsRouter = require('./routes/listings');
const couponRouter = require('./routes/coupons');
const categoriesRouter = require('./routes/categories');
const admin = require('firebase-admin');


dotenv.config();

const app = express();

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });
app.use(cors());
app.use(express.json());



// Mount the listings router
app.use('/api/listings', listingsRouter);
console.log('Mounted listings router at /api/listings');


app.use('/api/coupons',couponRouter);
//app.use('/api/listings', require('./routes/listings'));


// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));





// Add a test route for the favorites endpoint
app.get('/api/test-favorites', (req, res) => {
  console.log('Test favorites route hit');
  res.json({ message: 'Favorites test route is working' });
});



// Test route to confirm server is running
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});
// Catch-all route for debugging 404s
app.use((req, res) => {
  console.log(`[${new Date().toISOString()}] 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not found' });
});

app.use(cors({
  origin: 'http://localhost:5173', // Replace with your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use('/api/categories', require('./routes/categories')); // New

const userRoutes = require('./routes/users');
// ...
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



module.exports = { admin };
