const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { sql } = require('../models/database');

const router = express.Router();

// Register a new user
router.post('/register', [
    body('username').isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('full_name').isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters'),
    body('phone').optional().isLength({ min: 10, max: 20 }).withMessage('Phone number must be 10-20 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { username, email, password, full_name, phone, address } = req.body;

        // Check if user already exists
        const existingUser = await sql`
            SELECT id FROM users WHERE email = ${email} OR username = ${username}
        `;

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or username already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user
        const result = await sql`
            INSERT INTO users (username, email, password_hash, full_name, phone, address)
            VALUES (${username}, ${email}, ${password_hash}, ${full_name}, ${phone}, ${address})
            RETURNING id, username, email, full_name, phone, address, created_at
        `;

        // Generate JWT token
        const token = jwt.sign(
            { user_id: result[0].id, email: result[0].email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: result[0],
                token
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
});

// Login user
router.post('/login', [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // Find user
        const user = await sql`
            SELECT id, username, email, password_hash, full_name, phone, address, rating, total_deliveries, total_rides
            FROM users WHERE email = ${email}
        `;

        if (user.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user[0].password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { user_id: user[0].id, email: user[0].email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Remove password from response
        const { password_hash, ...userWithoutPassword } = user[0];

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: userWithoutPassword,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

// Verify JWT token
router.get('/verify', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await sql`
            SELECT id, username, email, full_name, phone, address, rating, total_deliveries, total_rides, is_verified
            FROM users WHERE id = ${decoded.user_id}
        `;

        if (user.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Token is not valid'
            });
        }

        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                user: user[0]
            }
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({
            success: false,
            message: 'Token is not valid'
        });
    }
});

module.exports = router;
