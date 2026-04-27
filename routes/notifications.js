const express = require('express');
const { body, validationResult } = require('express-validator');
const { sql } = require('../models/database');

const router = express.Router();

// Create a new notification
router.post('/', [
    body('user_id').optional().isInt().withMessage('User ID must be an integer'),
    body('rider_id').optional().isInt().withMessage('Rider ID must be an integer'),
    body('title').isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
    body('message').isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
    body('type').isIn(['delivery_request', 'ride_request', 'payment', 'review', 'system']).withMessage('Invalid notification type')
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
            title,
            message,
            type
        } = req.body;

        // Validate that either user_id or rider_id is provided
        if (!user_id && !rider_id) {
            return res.status(400).json({
                success: false,
                message: 'Either user_id or rider_id must be provided'
            });
        }

        const result = await sql`
            INSERT INTO notifications (user_id, rider_id, title, message, type)
            VALUES (${user_id}, ${rider_id}, ${title}, ${message}, ${type})
            RETURNING *
        `;

        res.status(201).json({
            success: true,
            message: 'Notification created successfully',
            data: result[0]
        });
    } catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating notification'
        });
    }
});

// Get notifications for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { unread_only, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT *
            FROM notifications
            WHERE user_id = ${userId}
        `;

        if (unread_only === 'true') {
            query += ` AND is_read = false`;
        }

        query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

        const result = await sql.query(query);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get user notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user notifications'
        });
    }
});

// Get notifications for a rider
router.get('/rider/:riderId', async (req, res) => {
    try {
        const { riderId } = req.params;
        const { unread_only, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT *
            FROM notifications
            WHERE rider_id = ${riderId}
        `;

        if (unread_only === 'true') {
            query += ` AND is_read = false`;
        }

        query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

        const result = await sql.query(query);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get rider notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching rider notifications'
        });
    }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await sql`
            UPDATE notifications 
            SET is_read = true
            WHERE id = ${id}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification marked as read',
            data: result[0]
        });
    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error marking notification as read'
        });
    }
});

// Mark all notifications as read for a user
router.patch('/user/:userId/read-all', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await sql`
            UPDATE notifications 
            SET is_read = true
            WHERE user_id = ${userId} AND is_read = false
            RETURNING *
        `;

        res.json({
            success: true,
            message: `${result.length} notifications marked as read`,
            data: {
                updated_count: result.length
            }
        });
    } catch (error) {
        console.error('Mark all user notifications as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error marking notifications as read'
        });
    }
});

// Mark all notifications as read for a rider
router.patch('/rider/:riderId/read-all', async (req, res) => {
    try {
        const { riderId } = req.params;

        const result = await sql`
            UPDATE notifications 
            SET is_read = true
            WHERE rider_id = ${riderId} AND is_read = false
            RETURNING *
        `;

        res.json({
            success: true,
            message: `${result.length} notifications marked as read`,
            data: {
                updated_count: result.length
            }
        });
    } catch (error) {
        console.error('Mark all rider notifications as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error marking notifications as read'
        });
    }
});

// Delete notification
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await sql`
            DELETE FROM notifications 
            WHERE id = ${id}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification deleted successfully',
            data: result[0]
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting notification'
        });
    }
});

// Get unread notification count for a user
router.get('/count/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await sql`
            SELECT COUNT(*) as unread_count
            FROM notifications
            WHERE user_id = ${userId} AND is_read = false
        `;

        res.json({
            success: true,
            data: {
                unread_count: parseInt(result[0].unread_count)
            }
        });
    } catch (error) {
        console.error('Get user notification count error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching notification count'
        });
    }
});

// Get unread notification count for a rider
router.get('/count/rider/:riderId', async (req, res) => {
    try {
        const { riderId } = req.params;

        const result = await sql`
            SELECT COUNT(*) as unread_count
            FROM notifications
            WHERE rider_id = ${riderId} AND is_read = false
        `;

        res.json({
            success: true,
            data: {
                unread_count: parseInt(result[0].unread_count)
            }
        });
    } catch (error) {
        console.error('Get rider notification count error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching notification count'
        });
    }
});

// Helper function to create notifications for common events
async function createDeliveryRequestNotification(userId, trackingId) {
    try {
        await sql`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (
                ${userId}, 
                'Delivery Request Created', 
                'Your delivery request ' || ${trackingId} || ' has been created and is waiting for a rider to accept.',
                'delivery_request'
            )
        `;
    } catch (error) {
        console.error('Create delivery notification error:', error);
    }
}

async function createDeliveryAcceptedNotification(userId, trackingId) {
    try {
        await sql`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (
                ${userId}, 
                'Delivery Accepted', 
                'Your delivery request ' || ${trackingId} || ' has been accepted by a rider.',
                'delivery_request'
            )
        `;
    } catch (error) {
        console.error('Create delivery accepted notification error:', error);
    }
}

async function createRideRequestNotification(userId, trackingId) {
    try {
        await sql`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (
                ${userId}, 
                'Ride Request Created', 
                'Your ride request ' || ${trackingId} || ' has been created and is waiting for a driver to accept.',
                'ride_request'
            )
        `;
    } catch (error) {
        console.error('Create ride notification error:', error);
    }
}

async function createRideAcceptedNotification(userId, trackingId) {
    try {
        await sql`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (
                ${userId}, 
                'Ride Accepted', 
                'Your ride request ' || ${trackingId} || ' has been accepted by a driver.',
                'ride_request'
            )
        `;
    } catch (error) {
        console.error('Create ride accepted notification error:', error);
    }
}

async function createNewRequestNotification(riderId, requestType, requestId) {
    try {
        const title = requestType === 'delivery' ? 'New Delivery Request' : 'New Ride Request';
        const message = 'A new ' || requestType || ' request is available in your area. Check your dashboard to accept.';
        
        await sql`
            INSERT INTO notifications (rider_id, title, message, type)
            VALUES (${riderId}, ${title}, ${message}, '${requestType}_request')
        `;
    } catch (error) {
        console.error('Create new request notification error:', error);
    }
}

async function createPaymentNotification(userId, amount, transactionType) {
    try {
        await sql`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (
                ${userId}, 
                'Payment Processed', 
                'Your payment of ₹' || ${amount} || ' for ' || ${transactionType} || ' has been processed successfully.',
                'payment'
            )
        `;
    } catch (error) {
        console.error('Create payment notification error:', error);
    }
}

async function createReviewNotification(reviewedUserId, rating) {
    try {
        await sql`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (
                ${reviewedUserId}, 
                'New Review Received', 
                'You received a ' || ${rating} || '-star review. Check your profile to see the details.',
                'review'
            )
        `;
    } catch (error) {
        console.error('Create review notification error:', error);
    }
}

// Export helper functions
module.exports = router;
module.exports.createDeliveryRequestNotification = createDeliveryRequestNotification;
module.exports.createDeliveryAcceptedNotification = createDeliveryAcceptedNotification;
module.exports.createRideRequestNotification = createRideRequestNotification;
module.exports.createRideAcceptedNotification = createRideAcceptedNotification;
module.exports.createNewRequestNotification = createNewRequestNotification;
module.exports.createPaymentNotification = createPaymentNotification;
module.exports.createReviewNotification = createReviewNotification;
