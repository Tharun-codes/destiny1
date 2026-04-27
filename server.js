const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { neon } = require('@neondatabase/serverless');

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const sql = neon(process.env.DATABASE_URL);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const riderRoutes = require('./routes/riders');
const deliveryRoutes = require('./routes/deliveries');
const rideRoutes = require('./routes/rides');
const reviewRoutes = require('./routes/reviews');
const transactionRoutes = require('./routes/transactions');
const notificationRoutes = require('./routes/notifications');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes);

// Serve static files for frontend apps
app.use('/destiny', express.static('../destiny-app'));
app.use('/partners', express.static('../destiny-partners'));

// Default route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Destiny Delivery Platform API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            riders: '/api/riders',
            deliveries: '/api/deliveries',
            rides: '/api/rides',
            reviews: '/api/reviews',
            transactions: '/api/transactions',
            notifications: '/api/notifications'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Destiny server running on port ${PORT}`);
    console.log(`Main app: http://localhost:${PORT}/destiny`);
    console.log(`Partners app: http://localhost:${PORT}/partners`);
});

module.exports = app;
