const express = require('express');
const { body, validationResult } = require('express-validator');
const { sql } = require('../models/database');

const router = express.Router();

// Create a new transaction
router.post('/', [
    body('user_id').isInt().withMessage('User ID must be an integer'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('transaction_type').isIn(['payment', 'earning', 'refund', 'platform_fee']).withMessage('Invalid transaction type'),
    body('payment_method').optional().isIn(['cash', 'card', 'wallet', 'upi']).withMessage('Invalid payment method'),
    body('delivery_request_id').optional().isInt().withMessage('Delivery request ID must be an integer'),
    body('ride_request_id').optional().isInt().withMessage('Ride request ID must be an integer')
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
            rider_id,
            amount,
            transaction_type,
            payment_method,
            delivery_request_id,
            ride_request_id,
            payment_id
        } = req.body;

        const result = await sql`
            INSERT INTO transactions (
                user_id, rider_id, amount, transaction_type, payment_method, 
                delivery_request_id, ride_request_id, payment_id
            )
            VALUES (
                ${user_id}, ${rider_id}, ${amount}, ${transaction_type}, ${payment_method},
                ${delivery_request_id}, ${ride_request_id}, ${payment_id}
            )
            RETURNING *
        `;

        res.status(201).json({
            success: true,
            message: 'Transaction created successfully',
            data: result[0]
        });
    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating transaction'
        });
    }
});

// Get transactions for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { transaction_type, status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT t.*, dr.tracking_id as delivery_tracking_id, rr.tracking_id as ride_tracking_id,
                   r.username as rider_name, r.full_name as rider_full_name
            FROM transactions t
            LEFT JOIN delivery_requests dr ON t.delivery_request_id = dr.id
            LEFT JOIN ride_requests rr ON t.ride_request_id = rr.id
            LEFT JOIN riders rd ON t.rider_id = rd.id
            LEFT JOIN users r ON rd.user_id = r.id
            WHERE t.user_id = ${userId}
        `;

        const params = [];

        if (transaction_type) {
            query += ` AND t.transaction_type = $${params.length + 1}`;
            params.push(transaction_type);
        }

        if (status) {
            query += ` AND t.status = $${params.length + 1}`;
            params.push(status);
        }

        query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await sql.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get user transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user transactions'
        });
    }
});

// Get transactions for a rider
router.get('/rider/:riderId', async (req, res) => {
    try {
        const { riderId } = req.params;
        const { transaction_type, status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT t.*, u.username as user_name, u.full_name as user_full_name,
                   dr.tracking_id as delivery_tracking_id, rr.tracking_id as ride_tracking_id
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN delivery_requests dr ON t.delivery_request_id = dr.id
            LEFT JOIN ride_requests rr ON t.ride_request_id = rr.id
            WHERE t.rider_id = ${riderId}
        `;

        const params = [];

        if (transaction_type) {
            query += ` AND t.transaction_type = $${params.length + 1}`;
            params.push(transaction_type);
        }

        if (status) {
            query += ` AND t.status = $${params.length + 1}`;
            params.push(status);
        }

        query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await sql.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get rider transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching rider transactions'
        });
    }
});

// Update transaction status
router.patch('/:id/status', [
    body('status').isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Invalid status')
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
        const { status, payment_id } = req.body;

        let updateFields = ['status = $1'];
        let params = [status];

        if (payment_id) {
            updateFields.push('payment_id = $' + (params.length + 1));
            params.push(payment_id);
        }

        params.push(id);

        const result = await sql.query(`
            UPDATE transactions 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${params.length}
            RETURNING *
        `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        res.json({
            success: true,
            message: 'Transaction status updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update transaction status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating transaction status'
        });
    }
});

// Get transaction statistics for a user
router.get('/stats/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await sql`
            SELECT 
                transaction_type,
                COUNT(*) as total_transactions,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_amount,
                COALESCE(SUM(amount), 0) as gross_amount
            FROM transactions
            WHERE user_id = ${userId}
            GROUP BY transaction_type
        `;

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get user transaction stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user transaction statistics'
        });
    }
});

// Get transaction statistics for a rider
router.get('/stats/rider/:riderId', async (req, res) => {
    try {
        const { riderId } = req.params;

        const result = await sql`
            SELECT 
                transaction_type,
                COUNT(*) as total_transactions,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_amount,
                COALESCE(SUM(amount), 0) as gross_amount
            FROM transactions
            WHERE rider_id = ${riderId}
            GROUP BY transaction_type
        `;

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get rider transaction stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching rider transaction statistics'
        });
    }
});

// Create payment transaction for delivery completion
router.post('/payment/delivery/:deliveryId', async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const { payment_method = 'cash', payment_id } = req.body;

        // Get delivery details
        const deliveryResult = await sql`
            SELECT user_id, rider_id, delivery_fee, platform_fee, rider_earnings
            FROM delivery_requests
            WHERE id = ${deliveryId} AND status = 'delivered'
        `;

        if (deliveryResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Delivery not found or not completed'
            });
        }

        const delivery = deliveryResult[0];

        // Create user payment transaction
        const userTransaction = await sql`
            INSERT INTO transactions (
                user_id, rider_id, amount, transaction_type, payment_method,
                delivery_request_id, payment_id, status
            )
            VALUES (
                ${delivery.user_id}, ${delivery.rider_id}, ${delivery.delivery_fee}, 'payment', 
                ${payment_method}, ${deliveryId}, ${payment_id}, 'completed'
            )
            RETURNING *
        `;

        // Create platform fee transaction
        const platformTransaction = await sql`
            INSERT INTO transactions (
                user_id, rider_id, amount, transaction_type, payment_method,
                delivery_request_id, status
            )
            VALUES (
                ${delivery.user_id}, ${delivery.rider_id}, ${delivery.platform_fee}, 'platform_fee',
                ${payment_method}, ${deliveryId}, 'completed'
            )
            RETURNING *
        `;

        // Create rider earning transaction
        const riderTransaction = await sql`
            INSERT INTO transactions (
                user_id, rider_id, amount, transaction_type, payment_method,
                delivery_request_id, status
            )
            VALUES (
                ${delivery.user_id}, ${delivery.rider_id}, ${delivery.rider_earnings}, 'earning',
                ${payment_method}, ${deliveryId}, 'completed'
            )
            RETURNING *
        `;

        res.json({
            success: true,
            message: 'Payment transactions created successfully',
            data: {
                user_transaction: userTransaction[0],
                platform_transaction: platformTransaction[0],
                rider_transaction: riderTransaction[0]
            }
        });
    } catch (error) {
        console.error('Create delivery payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating delivery payment'
        });
    }
});

// Create payment transaction for ride completion
router.post('/payment/ride/:rideId', async (req, res) => {
    try {
        const { rideId } = req.params;
        const { payment_method = 'cash', payment_id } = req.body;

        // Get ride details
        const rideResult = await sql`
            SELECT user_id, rider_id, ride_fee, platform_fee, rider_earnings
            FROM ride_requests
            WHERE id = ${rideId} AND status = 'dropped'
        `;

        if (rideResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found or not completed'
            });
        }

        const ride = rideResult[0];

        // Create user payment transaction
        const userTransaction = await sql`
            INSERT INTO transactions (
                user_id, rider_id, amount, transaction_type, payment_method,
                ride_request_id, payment_id, status
            )
            VALUES (
                ${ride.user_id}, ${ride.rider_id}, ${ride.ride_fee}, 'payment', 
                ${payment_method}, ${rideId}, ${payment_id}, 'completed'
            )
            RETURNING *
        `;

        // Create platform fee transaction
        const platformTransaction = await sql`
            INSERT INTO transactions (
                user_id, rider_id, amount, transaction_type, payment_method,
                ride_request_id, status
            )
            VALUES (
                ${ride.user_id}, ${ride.rider_id}, ${ride.platform_fee}, 'platform_fee',
                ${payment_method}, ${rideId}, 'completed'
            )
            RETURNING *
        `;

        // Create rider earning transaction
        const riderTransaction = await sql`
            INSERT INTO transactions (
                user_id, rider_id, amount, transaction_type, payment_method,
                ride_request_id, status
            )
            VALUES (
                ${ride.user_id}, ${ride.rider_id}, ${ride.rider_earnings}, 'earning',
                ${payment_method}, ${rideId}, 'completed'
            )
            RETURNING *
        `;

        res.json({
            success: true,
            message: 'Payment transactions created successfully',
            data: {
                user_transaction: userTransaction[0],
                platform_transaction: platformTransaction[0],
                rider_transaction: riderTransaction[0]
            }
        });
    } catch (error) {
        console.error('Create ride payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating ride payment'
        });
    }
});

module.exports = router;
