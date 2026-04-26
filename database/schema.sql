-- Destiny Delivery Platform Database Schema
-- PostgreSQL with Neon DB

-- Users Table (Customers who send items or request rides)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    profile_image VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_deliveries INTEGER DEFAULT 0,
    total_rides INTEGER DEFAULT 0
);

-- Riders/Drivers Table (Daily travelers, auto drivers, bus drivers)
CREATE TABLE riders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL, -- 'car', 'motorcycle', 'auto', 'bus'
    vehicle_number VARCHAR(50),
    license_number VARCHAR(50),
    is_available BOOLEAN DEFAULT TRUE,
    current_location_lat DECIMAL(10,8),
    current_location_lng DECIMAL(11,8),
    work_route TEXT, -- JSON string of regular route points
    work_schedule TEXT, -- JSON string of work timings
    max_delivery_weight DECIMAL(5,2) DEFAULT 10.0, -- kg
    max_passengers INTEGER DEFAULT 4,
    vehicle_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_deliveries_completed INTEGER DEFAULT 0,
    total_rides_given INTEGER DEFAULT 0,
    earnings DECIMAL(10,2) DEFAULT 0.0
);

-- Delivery Requests Table
CREATE TABLE delivery_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pickup_address TEXT NOT NULL,
    pickup_lat DECIMAL(10,8),
    pickup_lng DECIMAL(11,8),
    delivery_address TEXT NOT NULL,
    delivery_lat DECIMAL(10,8),
    delivery_lng DECIMAL(11,8),
    item_description TEXT NOT NULL,
    item_weight DECIMAL(5,2),
    item_value DECIMAL(8,2),
    package_type VARCHAR(50), -- 'document', 'parcel', 'food', 'electronics', etc.
    urgent BOOLEAN DEFAULT FALSE,
    preferred_time TIMESTAMP,
    max_price DECIMAL(8,2),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'picked_up', 'delivered', 'cancelled'
    rider_id INTEGER REFERENCES riders(id) ON DELETE SET NULL,
    accepted_at TIMESTAMP,
    picked_up_at TIMESTAMP,
    delivered_at TIMESTAMP,
    delivery_fee DECIMAL(8,2),
    platform_fee DECIMAL(6,2),
    rider_earnings DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    tracking_id VARCHAR(50) UNIQUE
);

-- Ride Requests Table (for lift/ride sharing)
CREATE TABLE ride_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pickup_address TEXT NOT NULL,
    pickup_lat DECIMAL(10,8),
    pickup_lng DECIMAL(11,8),
    destination_address TEXT NOT NULL,
    destination_lat DECIMAL(10,8),
    destination_lng DECIMAL(11,8),
    passengers INTEGER DEFAULT 1,
    preferred_time TIMESTAMP,
    max_price DECIMAL(8,2),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'picked_up', 'dropped', 'cancelled'
    rider_id INTEGER REFERENCES riders(id) ON DELETE SET NULL,
    accepted_at TIMESTAMP,
    picked_up_at TIMESTAMP,
    dropped_at TIMESTAMP,
    ride_fee DECIMAL(8,2),
    platform_fee DECIMAL(6,2),
    rider_earnings DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    tracking_id VARCHAR(50) UNIQUE
);

-- Reviews Table
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    reviewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reviewed_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    delivery_request_id INTEGER REFERENCES delivery_requests(id) ON DELETE SET NULL,
    ride_request_id INTEGER REFERENCES ride_requests(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Transactions Table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rider_id INTEGER REFERENCES riders(id) ON DELETE SET NULL,
    delivery_request_id INTEGER REFERENCES delivery_requests(id) ON DELETE SET NULL,
    ride_request_id INTEGER REFERENCES ride_requests(id) ON DELETE SET NULL,
    amount DECIMAL(8,2) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- 'payment', 'earning', 'refund', 'platform_fee'
    payment_method VARCHAR(50), -- 'cash', 'card', 'wallet', 'upi'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_id VARCHAR(100) -- External payment gateway ID
);

-- Notifications Table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rider_id INTEGER REFERENCES riders(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50), -- 'delivery_request', 'ride_request', 'payment', 'review', 'system'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_riders_user_id ON riders(user_id);
CREATE INDEX idx_riders_available ON riders(is_available);
CREATE INDEX idx_delivery_requests_user_id ON delivery_requests(user_id);
CREATE INDEX idx_delivery_requests_rider_id ON delivery_requests(rider_id);
CREATE INDEX idx_delivery_requests_status ON delivery_requests(status);
CREATE INDEX idx_ride_requests_user_id ON ride_requests(user_id);
CREATE INDEX idx_ride_requests_rider_id ON ride_requests(rider_id);
CREATE INDEX idx_ride_requests_status ON ride_requests(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_rider_id ON transactions(rider_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_riders_updated_at BEFORE UPDATE ON riders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_requests_updated_at BEFORE UPDATE ON delivery_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ride_requests_updated_at BEFORE UPDATE ON ride_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
