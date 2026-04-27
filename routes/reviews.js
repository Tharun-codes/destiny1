const express = require('express');
const { body, validationResult } = require('express-validator');
const { sql } = require('../models/database');

const router = express.Router();

// Create a new review
router.post('/', [
    body('reviewer_id').isInt().withMessage('Reviewer ID must be an integer'),
    body('reviewed_user_id').isInt().withMessage('Reviewed user ID must be an integer'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().isLength({ max: 1000 }).withMessage('Comment must be less than 1000 characters'),
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
            reviewer_id,
            reviewed_user_id,
            rating,
            comment,
            delivery_request_id,
            ride_request_id
        } = req.body;

        // Validate that either delivery_request_id or ride_request_id is provided (but not both)
        if ((!delivery_request_id && !ride_request_id) || (delivery_request_id && ride_request_id)) {
            return res.status(400).json({
                success: false,
                message: 'Either delivery_request_id or ride_request_id must be provided (but not both)'
            });
        }

        // Check if reviewer has already reviewed this request
        let existingReviewQuery = '';
        let existingReviewParams = [];
        
        if (delivery_request_id) {
            existingReviewQuery = `SELECT id FROM reviews WHERE delivery_request_id = $1 AND reviewer_id = $2`;
            existingReviewParams = [delivery_request_id, reviewer_id];
        } else {
            existingReviewQuery = `SELECT id FROM reviews WHERE ride_request_id = $1 AND reviewer_id = $2`;
            existingReviewParams = [ride_request_id, reviewer_id];
        }

        const existingReview = await sql.query(existingReviewQuery, existingReviewParams);
        
        if (existingReview.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this request'
            });
        }

        const result = await sql`
            INSERT INTO reviews (
                reviewer_id, reviewed_user_id, rating, comment, delivery_request_id, ride_request_id
            )
            VALUES (
                ${reviewer_id}, ${reviewed_user_id}, ${rating}, ${comment}, 
                ${delivery_request_id}, ${ride_request_id}
            )
            RETURNING *
        `;

        // Update the reviewed user's average rating
        await this.updateUserRating(reviewed_user_id);

        res.status(201).json({
            success: true,
            message: 'Review created successfully',
            data: result[0]
        });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating review'
        });
    }
});

// Get reviews for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const result = await sql`
            SELECT r.*, reviewer.username as reviewer_name, reviewer.full_name as reviewer_full_name,
                   dr.tracking_id as delivery_tracking_id, rr.tracking_id as ride_tracking_id
            FROM reviews r
            LEFT JOIN users reviewer ON r.reviewer_id = reviewer.id
            LEFT JOIN delivery_requests dr ON r.delivery_request_id = dr.id
            LEFT JOIN ride_requests rr ON r.ride_request_id = rr.id
            WHERE r.reviewed_user_id = ${userId}
            ORDER BY r.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get user reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user reviews'
        });
    }
});

// Get reviews for a delivery request
router.get('/delivery/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        const result = await sql`
            SELECT r.*, reviewer.username as reviewer_name, reviewer.full_name as reviewer_full_name,
                   reviewed.username as reviewed_user_name, reviewed.full_name as reviewed_user_full_name
            FROM reviews r
            LEFT JOIN users reviewer ON r.reviewer_id = reviewer.id
            LEFT JOIN users reviewed ON r.reviewed_user_id = reviewed.id
            WHERE r.delivery_request_id = ${requestId}
            ORDER BY r.created_at DESC
        `;

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get delivery reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching delivery reviews'
        });
    }
});

// Get reviews for a ride request
router.get('/ride/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        const result = await sql`
            SELECT r.*, reviewer.username as reviewer_name, reviewer.full_name as reviewer_full_name,
                   reviewed.username as reviewed_user_name, reviewed.full_name as reviewed_user_full_name
            FROM reviews r
            LEFT JOIN users reviewer ON r.reviewer_id = reviewer.id
            LEFT JOIN users reviewed ON r.reviewed_user_id = reviewed.id
            WHERE r.ride_request_id = ${requestId}
            ORDER BY r.created_at DESC
        `;

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get ride reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching ride reviews'
        });
    }
});

// Get review statistics for a user
router.get('/stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await sql`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_reviews,
                COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_reviews,
                COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_reviews,
                COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_reviews,
                COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_reviews
            FROM reviews
            WHERE reviewed_user_id = ${userId}
        `;

        const stats = result[0];

        // Calculate rating distribution percentages
        const total = stats.total_reviews || 1;
        const ratingDistribution = {
            5: Math.round((stats.five_star_reviews / total) * 100),
            4: Math.round((stats.four_star_reviews / total) * 100),
            3: Math.round((stats.three_star_reviews / total) * 100),
            2: Math.round((stats.two_star_reviews / total) * 100),
            1: Math.round((stats.one_star_reviews / total) * 100)
        };

        res.json({
            success: true,
            data: {
                total_reviews: stats.total_reviews,
                average_rating: parseFloat(stats.average_rating) || 0,
                rating_distribution: ratingDistribution
            }
        });
    } catch (error) {
        console.error('Get review stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching review statistics'
        });
    }
});

// Helper function to update user's average rating
async function updateUserRating(userId) {
    try {
        const result = await sql`
            SELECT AVG(rating) as average_rating
            FROM reviews
            WHERE reviewed_user_id = ${userId}
        `;

        const averageRating = parseFloat(result[0].average_rating) || 5.0;

        await sql`
            UPDATE users 
            SET rating = ${averageRating}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${userId}
        `;
    } catch (error) {
        console.error('Update user rating error:', error);
    }
}

// Export the helper function for use in other routes
module.exports.updateUserRating = updateUserRating;

module.exports = router;
