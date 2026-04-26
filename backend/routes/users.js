const express = require('express');
const { body, validationResult } = require('express-validator');
const { sql } = require('../models/database');

const router = express.Router();

// Get user profile by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await sql`
            SELECT id, username, email, full_name, phone, address, profile_image, rating, 
                   total_deliveries, total_rides, is_verified, created_at, updated_at
            FROM users 
            WHERE id = ${id}
        `;
        
        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            data: result[0]
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user'
        });
    }
});

// Update user profile
router.patch('/:id', [
    body('username').optional().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('full_name').optional().isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters'),
    body('phone').optional().isLength({ min: 10, max: 20 }).withMessage('Phone number must be 10-20 characters'),
    body('address').optional().isLength({ max: 500 }).withMessage('Address must be less than 500 characters')
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

        const { id } = req.params;
        const { username, full_name, phone, address, profile_image } = req.body;

        // Build dynamic update query
        const updateFields = [];
        const params = [];
        
        if (username !== undefined) {
            updateFields.push('username = $' + (params.length + 1));
            params.push(username);
        }
        
        if (full_name !== undefined) {
            updateFields.push('full_name = $' + (params.length + 1));
            params.push(full_name);
        }
        
        if (phone !== undefined) {
            updateFields.push('phone = $' + (params.length + 1));
            params.push(phone);
        }
        
        if (address !== undefined) {
            updateFields.push('address = $' + (params.length + 1));
            params.push(address);
        }
        
        if (profile_image !== undefined) {
            updateFields.push('profile_image = $' + (params.length + 1));
            params.push(profile_image);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }
        
        params.push(id);
        
        const result = await sql.query(`
            UPDATE users 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${params.length}
            RETURNING id, username, email, full_name, phone, address, profile_image, rating, 
                   total_deliveries, total_rides, is_verified, created_at, updated_at
        `, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            message: 'User profile updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating user profile'
        });
    }
});

// Get user's delivery history
router.get('/:id/deliveries', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT dr.*, r.username as rider_name, r.full_name as rider_full_name, r.phone as rider_phone,
                   rd.vehicle_type, rd.rating as rider_rating
            FROM delivery_requests dr
            LEFT JOIN riders rd ON dr.rider_id = rd.id
            LEFT JOIN users r ON rd.user_id = r.id
            WHERE dr.user_id = ${id}
        `;
        
        const params = [];
        
        if (status) {
            query += ` AND dr.status = $${params.length + 1}`;
            params.push(status);
        }
        
        query += ` ORDER BY dr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await sql.query(query, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get user deliveries error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user deliveries'
        });
    }
});

// Get user's ride history
router.get('/:id/rides', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT rr.*, r.username as rider_name, r.full_name as rider_full_name, r.phone as rider_phone,
                   rd.vehicle_type, rd.rating as rider_rating
            FROM ride_requests rr
            LEFT JOIN riders rd ON rr.rider_id = rd.id
            LEFT JOIN users r ON rd.user_id = r.id
            WHERE rr.user_id = ${id}
        `;
        
        const params = [];
        
        if (status) {
            query += ` AND rr.status = $${params.length + 1}`;
            params.push(status);
        }
        
        query += ` ORDER BY rr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await sql.query(query, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get user rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user rides'
        });
    }
});

// Update user rating
router.patch('/:id/rating', [
    body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
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

        const { id } = req.params;
        const { rating } = req.body;

        const result = await sql`
            UPDATE users 
            SET rating = ${rating}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
            RETURNING id, username, email, full_name, rating, total_deliveries, total_rides
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User rating updated successfully',
            data: result[0]
        });
    } catch (error) {
        console.error('Update user rating error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating user rating'
        });
    }
});

// Increment user's delivery count
router.patch('/:id/deliveries/increment', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await sql`
            UPDATE users 
            SET total_deliveries = total_deliveries + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
            RETURNING id, username, total_deliveries, total_rides
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Delivery count incremented successfully',
            data: result[0]
        });
    } catch (error) {
        console.error('Increment delivery count error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error incrementing delivery count'
        });
    }
});

// Increment user's ride count
router.patch('/:id/rides/increment', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await sql`
            UPDATE users 
            SET total_rides = total_rides + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
            RETURNING id, username, total_deliveries, total_rides
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Ride count incremented successfully',
            data: result[0]
        });
    } catch (error) {
        console.error('Increment ride count error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error incrementing ride count'
        });
    }
});

module.exports = router;
