-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables and functions if they exist (for clean setup)
DROP TABLE IF EXISTS favorites, ticket_purchases, ticket_types, coupon_redemptions, coupon_reviews, coupons, notifications, rsvps, reviews, listing_reviews, listing_categories, vendor_details, temple_details, event_details, media, listings, categories, users CASCADE;
DROP FUNCTION IF EXISTS enforce_image_count, check_image_count_on_approval, update_coupon_usage, check_coupon_status_on_update;

-- Create ENUM Types
CREATE TYPE role_type AS ENUM ('user', 'vendor', 'organizer', 'admin');
CREATE TYPE listing_type AS ENUM ('event', 'temple', 'vendor');
CREATE TYPE category_type AS ENUM ('event', 'vendor');
CREATE TYPE listing_status AS ENUM ('pending', 'approved', 'rejected', 'draft');
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE coupon_status AS ENUM ('pending', 'approved', 'rejected', 'active', 'expired', 'disabled');
CREATE TYPE notification_type AS ENUM ('event_reminder', 'listing_approval', 'listing_rejection', 'coupon_added', 'ticket_purchase', 'coupon_approval', 'coupon_rejection');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE media_type AS ENUM ('image');

-- 1. Users Table
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(128) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone_number VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    role role_type DEFAULT 'user' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Categories Table
CREATE TABLE categories (
    category_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type category_type NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Listings Table
CREATE TABLE listings (
    listing_id BIGSERIAL PRIMARY KEY,
    type listing_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    website_url VARCHAR(255),
    user_id UUID REFERENCES users(user_id),
    status listing_status DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP,
    rejection_reason TEXT
);

-- 4. Listing Reviews Table
CREATE TABLE listing_reviews (
    review_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(user_id),
    status review_status NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Media Table
CREATE TABLE media (
    media_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    media_type media_type NOT NULL,
    url VARCHAR(255) NOT NULL,
    caption TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to enforce image count (2 for vendors, 1 for events, up to 1 for temples)
CREATE OR REPLACE FUNCTION enforce_image_count() RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM media m
        JOIN listings l ON m.listing_id = l.listing_id
        WHERE l.listing_id = NEW.listing_id
        GROUP BY l.listing_id, l.type
        HAVING 
            (l.type = 'vendor' AND COUNT(*) >= 2) OR
            (l.type = 'event' AND COUNT(*) >= 1) OR
            (l.type = 'temple' AND COUNT(*) >= 1)
    ) THEN
        RAISE EXCEPTION 'Image limit exceeded: vendors allow 2 images, events and temples allow 1 image';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce image count before insert
CREATE TRIGGER check_image_count
BEFORE INSERT ON media
FOR EACH ROW
EXECUTE FUNCTION enforce_image_count();

-- Function to enforce exact image count on listing approval
CREATE OR REPLACE FUNCTION check_image_count_on_approval() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' THEN
        IF EXISTS (
            SELECT l.listing_id
            FROM listings l
            LEFT JOIN media m ON l.listing_id = m.listing_id
            WHERE l.listing_id = NEW.listing_id
            GROUP BY l.listing_id, l.type
            HAVING 
                (l.type = 'vendor' AND COUNT(m.media_id) != 2) OR
                (l.type = 'event' AND COUNT(m.media_id) != 1) OR
                (l.type = 'temple' AND COUNT(m.media_id) > 1)
        ) THEN
            RAISE EXCEPTION 'Invalid image count for approval: vendors require 2 images, events require 1 image, temples allow up to 1 image';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce image count on approval
CREATE TRIGGER enforce_image_count_on_approval
BEFORE UPDATE ON listings
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
EXECUTE FUNCTION check_image_count_on_approval();

-- 6. Event Details Table
CREATE TABLE event_details (
    event_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT UNIQUE REFERENCES listings(listing_id) ON DELETE CASCADE,
    start_date_time TIMESTAMP NOT NULL,
    end_date_time TIMESTAMP,
    is_free BOOLEAN DEFAULT FALSE,
    ticket_price DECIMAL(10,2),
    ticket_url VARCHAR(255),
    has_internal_ticketing BOOLEAN DEFAULT FALSE,
    organizer_name VARCHAR(100),
    is_virtual BOOLEAN DEFAULT FALSE,
    virtual_link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Temple Details Table
CREATE TABLE temple_details (
    temple_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT UNIQUE REFERENCES listings(listing_id) ON DELETE CASCADE,
    deity VARCHAR(100),
    denomination VARCHAR(100),
    services TEXT[],
    operating_hours TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Vendor Details Table
CREATE TABLE vendor_details (
    vendor_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT UNIQUE REFERENCES listings(listing_id) ON DELETE CASCADE,
    business_type VARCHAR(100),
    products_services TEXT[],
    menu_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Listing Categories Table
CREATE TABLE listing_categories (
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES categories(category_id) ON DELETE CASCADE,
    PRIMARY KEY (listing_id, category_id)
);

-- 10. Reviews Table
CREATE TABLE reviews (
    review_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP
);

-- 11. RSVP Table
CREATE TABLE rsvps (
    rsvp_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (listing_id, user_id)
);

-- 12. Notifications Table
CREATE TABLE notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    listing_id BIGINT REFERENCES listings(listing_id),
    notification_type notification_type NOT NULL
);

-- 13. Coupons Table
CREATE TABLE coupons (
    coupon_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type discount_type NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_purchase_amount DECIMAL(10,2),
    max_usage INT,
    usage_count INT DEFAULT 0,
    start_date TIMESTAMP NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    status coupon_status DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP,
    rejection_reason TEXT
);

-- 14. Coupon Reviews Table
CREATE TABLE coupon_reviews (
    review_id BIGSERIAL PRIMARY KEY,
    coupon_id BIGINT REFERENCES coupons(coupon_id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(user_id),
    status review_status NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to enforce coupon status on update
CREATE OR REPLACE FUNCTION check_coupon_status_on_update() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'approved' AND NEW.status != 'rejected' THEN
        NEW.status = 'pending';
        NEW.approved_by = NULL;
        NEW.approved_at = NULL;
        NEW.rejection_reason = NULL;
        PERFORM (SELECT 1 FROM coupon_reviews WHERE coupon_id = NEW.coupon_id AND status = 'pending' LIMIT 1);
        IF NOT FOUND THEN
            INSERT INTO coupon_reviews (coupon_id, status, comment)
            VALUES (NEW.coupon_id, 'pending', 'Awaiting admin review for coupon update');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce coupon status on update
CREATE TRIGGER enforce_coupon_status_on_update
BEFORE UPDATE ON coupons
FOR EACH ROW
WHEN (OLD.status = 'approved')
EXECUTE FUNCTION check_coupon_status_on_update();

-- 15. Coupon Redemptions Table
CREATE TABLE coupon_redemptions (
    redemption_id BIGSERIAL PRIMARY KEY,
    coupon_id BIGINT REFERENCES coupons(coupon_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    listing_id BIGINT REFERENCES listings(listing_id),
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    order_id VARCHAR(100),
    UNIQUE (coupon_id, user_id)
);

-- 16. Ticket Types Table
CREATE TABLE ticket_types (
    ticket_type_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity_available INT NOT NULL,
    quantity_sold INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. Ticket Purchases Table
CREATE TABLE ticket_purchases (
    purchase_id BIGSERIAL PRIMARY KEY,
    ticket_type_id BIGINT REFERENCES ticket_types(ticket_type_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    listing_id BIGINT REFERENCES listings(listing_id),
    quantity INT NOT NULL CHECK (quantity > 0),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status payment_status DEFAULT 'pending' NOT NULL,
    payment_id VARCHAR(100),
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. Favorites Table
CREATE TABLE favorites (
    favorite_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, listing_id)
);

-- Indexes for Performance
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_media_listing_id ON media(listing_id);
CREATE INDEX idx_listings_city_status ON listings(city, status);
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupon_reviews_coupon_id ON coupon_reviews(coupon_id);
CREATE INDEX idx_ticket_purchases_user_id ON ticket_purchases(user_id);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_event_details_start_date_time ON event_details(start_date_time);
CREATE INDEX idx_listing_reviews_listing_id ON listing_reviews(listing_id);

-- Trigger for Coupon Usage Count
CREATE OR REPLACE FUNCTION update_coupon_usage() RETURNS TRIGGER AS $$
BEGIN
    UPDATE coupons SET usage_count = usage_count + 1 WHERE coupon_id = NEW.coupon_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_coupon_usage
AFTER INSERT ON coupon_redemptions
FOR EACH ROW
EXECUTE FUNCTION update_coupon_usage();