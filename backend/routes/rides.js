const express = require('express');
const { body, validationResult } = require('express-validator');
const { sql } = require('../models/database');

const router = express.Router();

// Create a new ride request
router.post('/', [
    body('user_id').isInt().withMessage('User ID must be an integer'),
    body('pickup_address').notEmpty().withMessage('Pickup address is required'),
    body('destination_address').notEmpty().withMessage('Destination address is required'),
    body('passengers').isInt({ min: 1, max: 8 }).withMessage('Passengers must be between 1 and 8'),
    body('max_price').optional().isFloat({ min: 0 }).withMessage('Max price must be positive')
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

        const {
            user_id,
            pickup_address,
            pickup_lat,
            pickup_lng,
            destination_address,
            destination_lat,
            destination_lng,
            passengers,
            preferred_time,
            max_price,
            notes
        } = req.body;

        // Generate unique tracking ID
        const tracking_id = 'RST' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();

        const result = await sql`
            INSERT INTO ride_requests (
                user_id, pickup_address, pickup_lat, pickup_lng, destination_address, destination_lat, destination_lng,
                passengers, preferred_time, max_price, notes, tracking_id
            )
            VALUES (
                ${user_id}, ${pickup_address}, ${pickup_lat}, ${pickup_lng}, ${destination_address}, ${destination_lat}, ${destination_lng},
                ${passengers}, ${preferred_time}, ${max_price}, ${notes}, ${tracking_id}
            )
            RETURNING *
        `;

        res.status(201).json({
            success: true,
            message: 'Ride request created successfully',
            data: result[0]
        });
    } catch (error) {
        console.error('Create ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating ride request'
        });
    }
});

// Get all ride requests (with filters)
router.get('/', async (req, res) => {
    try {
        const { status, user_id, rider_id, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT rr.*, u.username as user_name, u.full_name, u.phone,
                   r.username as rider_name, r.full_name as rider_full_name, r.phone as rider_phone,
                   rd.vehicle_type, rd.rating as rider_rating
            FROM ride_requests rr
            LEFT JOIN users u ON rr.user_id = u.id
            LEFT JOIN riders rd ON rr.rider_id = rd.id
            LEFT JOIN users r ON rd.user_id = r.id`;
        
        const conditions = [];
        const params = [];
        
        if (status) {
            conditions.push(`rr.status = $${params.length + 1}`);
            params.push(status);
        }
        
        if (user_id) {
            conditions.push(`rr.user_id = $${params.length + 1}`);
            params.push(user_id);
        }
        
        if (rider_id) {
            conditions.push(`rr.rider_id = $${params.length + 1}`);
            params.push(rider_id);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ` ORDER BY rr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const result = await sql.query(query, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching rides'
        });
    }
});

// Get ride request by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await sql`
            SELECT rr.*, u.username as user_name, u.full_name, u.phone, u.email,
                   r.username as rider_name, r.full_name as rider_full_name, r.phone as rider_phone, r.email as rider_email,
                   rd.vehicle_type, rd.vehicle_number, rd.rating as rider_rating
            FROM ride_requests rr
            LEFT JOIN users u ON rr.user_id = u.id
            LEFT JOIN riders rd ON rr.rider_id = rd.id
            LEFT JOIN users r ON rd.user_id = r.id
            WHERE rr.id = ${id}
        `;
        
        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ride request not found'
            });
        }
        
        res.json({
            success: true,
            data: result[0]
        });
    } catch (error) {
        console.error('Get ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching ride'
        });
    }
});

// Update ride request status
router.patch('/:id/status', [
    body('status').isIn(['pending', 'accepted', 'picked_up', 'dropped', 'cancelled']).withMessage('Invalid status'),
    body('rider_id').optional().isInt().withMessage('Rider ID must be an integer')
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
        const { status, rider_id } = req.body;

        // Update status and relevant timestamps
        let updateFields = ['status = $1'];
        let params = [status];
        
        if (status === 'accepted') {
            updateFields.push('accepted_at = CURRENT_TIMESTAMP');
            if (rider_id) {
                updateFields.push('rider_id = $2');
                params.push(rider_id);
            }
        } else if (status === 'picked_up') {
            updateFields.push('picked_up_at = CURRENT_TIMESTAMP');
        } else if (status === 'dropped') {
            updateFields.push('dropped_at = CURRENT_TIMESTAMP');
        }
        
        params.push(id);
        
        const result = await sql.query(`
            UPDATE ride_requests 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${params.length}
            RETURNING *
        `, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ride request not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Ride status updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update ride status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating ride status'
        });
    }
});

// Get available ride requests for riders
router.get('/available/for-riders', async (req, res) => {
    try {
        const { lat, lng, radius = 10, vehicle_type } = req.query;
        
        let query = `
            SELECT rr.*, u.username as user_name, u.full_name, u.phone
            FROM ride_requests rr
            LEFT JOIN users u ON rr.user_id = u.id
            WHERE rr.status = 'pending'
        `;
        
        if (lat && lng) {
            // Add distance calculation (simplified version)
            query += ` ORDER BY rr.created_at ASC`;
        } else {
            query += ` ORDER BY rr.created_at ASC`;
        }
        
        query += ` LIMIT 50`;
        
        const result = await sql.query(query);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get available rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching available rides'
        });
    }
});

module.exports = router;
