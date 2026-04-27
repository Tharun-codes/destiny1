const express = require('express');
const { body, validationResult } = require('express-validator');
const { sql } = require('../models/database');

const router = express.Router();

// Register as a rider
router.post('/register', [
    body('user_id').isInt().withMessage('User ID must be an integer'),
    body('vehicle_type').isIn(['car', 'motorcycle', 'auto', 'bus']).withMessage('Invalid vehicle type'),
    body('vehicle_number').notEmpty().withMessage('Vehicle number is required'),
    body('license_number').notEmpty().withMessage('License number is required'),
    body('max_delivery_weight').optional().isFloat({ min: 0 }).withMessage('Weight must be positive'),
    body('max_passengers').optional().isInt({ min: 1 }).withMessage('Passengers must be at least 1')
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
            vehicle_type,
            vehicle_number,
            license_number,
            work_route,
            work_schedule,
            max_delivery_weight,
            max_passengers,
            vehicle_description
        } = req.body;

        // Check if user exists and is not already a rider
        const existingRider = await sql`
            SELECT id FROM riders WHERE user_id = ${user_id}
        `;

        if (existingRider.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User is already registered as a rider'
            });
        }

        const result = await sql`
            INSERT INTO riders (
                user_id, vehicle_type, vehicle_number, license_number, work_route, work_schedule,
                max_delivery_weight, max_passengers, vehicle_description
            )
            VALUES (
                ${user_id}, ${vehicle_type}, ${vehicle_number}, ${license_number}, 
                ${JSON.stringify(work_route)}, ${JSON.stringify(work_schedule)},
                ${max_delivery_weight || 10.0}, ${max_passengers || 4}, ${vehicle_description}
            )
            RETURNING *
        `;

        res.status(201).json({
            success: true,
            message: 'Rider registered successfully',
            data: result[0]
        });
    } catch (error) {
        console.error('Rider registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during rider registration'
        });
    }
});

// Get rider profile
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await sql`
            SELECT r.*, u.username, u.full_name, u.phone, u.email, u.rating as user_rating,
                   u.total_deliveries, u.total_rides
            FROM riders r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.id = ${id}
        `;
        
        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Rider not found'
            });
        }
        
        res.json({
            success: true,
            data: result[0]
        });
    } catch (error) {
        console.error('Get rider error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching rider'
        });
    }
});

// Update rider availability
router.patch('/:id/availability', [
    body('is_available').isBoolean().withMessage('is_available must be boolean'),
    body('current_location_lat').optional().isFloat().withMessage('Latitude must be float'),
    body('current_location_lng').optional().isFloat().withMessage('Longitude must be float')
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
        const { is_available, current_location_lat, current_location_lng } = req.body;

        let updateFields = ['is_available = $1'];
        let params = [is_available];
        
        if (current_location_lat !== undefined) {
            updateFields.push('current_location_lat = $' + (params.length + 1));
            params.push(current_location_lat);
        }
        
        if (current_location_lng !== undefined) {
            updateFields.push('current_location_lng = $' + (params.length + 1));
            params.push(current_location_lng);
        }
        
        params.push(id);
        
        const result = await sql.query(`
            UPDATE riders 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${params.length}
            RETURNING *
        `, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Rider not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Rider availability updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update rider availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating rider availability'
        });
    }
});

// Get available riders in area
router.get('/available/nearby', async (req, res) => {
    try {
        const { lat, lng, radius = 10, vehicle_type } = req.query;
        
        let query = `
            SELECT r.*, u.username, u.full_name, u.phone, u.rating
            FROM riders r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.is_available = true
        `;
        
        const params = [];
        
        if (vehicle_type) {
            query += ` AND r.vehicle_type = $${params.length + 1}`;
            params.push(vehicle_type);
        }
        
        if (lat && lng) {
            // Simple distance calculation (you might want to use PostGIS for better accuracy)
            query += ` ORDER BY r.rating DESC, r.total_deliveries_completed DESC`;
        } else {
            query += ` ORDER BY r.rating DESC, r.total_deliveries_completed DESC`;
        }
        
        query += ` LIMIT 50`;
        
        const result = await sql.query(query, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get available riders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching available riders'
        });
    }
});

// Get rider's delivery history
router.get('/:id/deliveries', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT dr.*, u.username as user_name, u.full_name, u.phone
            FROM delivery_requests dr
            LEFT JOIN users u ON dr.user_id = u.id
            WHERE dr.rider_id = ${id}
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
        console.error('Get rider deliveries error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching rider deliveries'
        });
    }
});

// Update rider earnings
router.patch('/:id/earnings', [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive')
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
        const { amount } = req.body;

        const result = await sql`
            UPDATE riders 
            SET earnings = earnings + ${amount}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Rider not found'
            });
        }

        res.json({
            success: true,
            message: 'Rider earnings updated successfully',
            data: result[0]
        });
    } catch (error) {
        console.error('Update rider earnings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating rider earnings'
        });
    }
});

module.exports = router;
