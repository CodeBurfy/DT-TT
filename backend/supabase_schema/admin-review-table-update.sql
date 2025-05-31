-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS categories (
    category_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type category_type NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Listings Table
CREATE TABLE IF NOT EXISTS listings (
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
CREATE TABLE IF NOT EXISTS listing_reviews (
    review_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(user_id),
    status review_status NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to enforce listing status on update
CREATE OR REPLACE FUNCTION check_listing_status_on_update() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'approved' AND NEW.status != 'rejected' THEN
        NEW.status = 'pending';
        NEW.approved_by = NULL;
        NEW.approved_at = NULL;
        NEW.rejection_reason = NULL;
        PERFORM (SELECT 1 FROM listing_reviews WHERE listing_id = NEW.listing_id AND status = 'pending' LIMIT 1);
        IF NOT FOUND THEN
            INSERT INTO listing_reviews (listing_id, status, comment)
            VALUES (NEW.listing_id, 'pending', 'Awaiting admin review for listing update');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce listing status on update
CREATE TRIGGER enforce_listing_status_on_update
BEFORE UPDATE ON listings
FOR EACH ROW
WHEN (OLD.status = 'approved')
EXECUTE FUNCTION check_listing_status_on_update();

-- 5. Media Table
CREATE TABLE IF NOT EXISTS media (
    media_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    media_type media_type NOT NULL,
    url VARCHAR(255) NOT NULL,
    caption TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to enforce image count (allow exactly 2 for vendors)
CREATE OR REPLACE FUNCTION enforce_image_count() RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM media m
        JOIN listings l ON m.listing_id = l.listing_id
        WHERE l.listing_id = NEW.listing_id
        GROUP BY l.listing_id, l.type
        HAVING 
            (l.type = 'vendor' AND COUNT(*) > 2) OR
            (l.type = 'event' AND COUNT(*) > 1) OR
            (l.type = 'temple' AND COUNT(*) > 1)
    ) THEN
        RAISE EXCEPTION 'Image limit exceeded: vendors allow 2 images, events and temples allow 1 image';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce image count
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
CREATE TABLE IF NOT EXISTS event_details (
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
CREATE TABLE IF NOT EXISTS temple_details (
    temple_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT UNIQUE REFERENCES listings(listing_id) ON DELETE CASCADE,
    deity VARCHAR(100),
    denomination VARCHAR(100),
    services TEXT[],
    operating_hours TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Vendor Details Table
CREATE TABLE IF NOT EXISTS vendor_details (
    vendor_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT UNIQUE REFERENCES listings(listing_id) ON DELETE CASCADE,
    business_type VARCHAR(100),
    products_services TEXT[],
    menu_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Listing Categories Table
CREATE TABLE IF NOT EXISTS listing_categories (
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES categories(category_id) ON DELETE CASCADE,
    PRIMARY KEY (listing_id, category_id)
);

-- 10. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
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
CREATE TABLE IF NOT EXISTS rsvps (
    rsvp_id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (listing_id, user_id)
);

-- 12. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    listing_id BIGINT REFERENCES listings(listing_id),
    notification_type notification_type NOT NULL
);

-- 13. Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
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
CREATE TABLE IF NOT EXISTS coupon_reviews (
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
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    redemption_id BIGSERIAL PRIMARY KEY,
    coupon_id BIGINT REFERENCES coupons(coupon_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    listing_id BIGINT REFERENCES listings(listing_id),
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    order_id VARCHAR(100),
    UNIQUE (coupon_id, user_id)
);

-- 16. Ticket Types Table
CREATE TABLE IF NOT EXISTS ticket_types (
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
CREATE TABLE IF NOT EXISTS ticket_purchases (
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
CREATE TABLE IF NOT EXISTS favorites (
    favorite_id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    listing_id BIGINT REFERENCES listings(listing_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, listing_id)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_media_listing_id ON media(listing_id);
CREATE INDEX IF NOT EXISTS idx_listings_city_status ON listings(city, status);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_reviews_coupon_id ON coupon_reviews(coupon_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_user_id ON ticket_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_event_details_start_date_time ON event_details(start_date_time);
CREATE INDEX IF NOT EXISTS idx_listing_reviews_listing_id ON listing_reviews(listing_id);

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

-- RLS Policies
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert listings" ON listings
FOR INSERT TO authenticated
WITH CHECK (auth.uid()::UUID = user_id);

CREATE POLICY "Public read approved listings" ON listings
FOR SELECT TO public
USING (status = 'approved');

CREATE POLICY "Admins can update listings" ON listings
FOR UPDATE TO authenticated
USING (
    auth.uid()::UUID IN (SELECT user_id FROM users WHERE role = 'admin')
);

ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media FORCE ROW LEVEL SECURITY;

CREATE POLICY "View approved listings media" ON media
FOR SELECT TO public
USING (
    EXISTS (SELECT 1 FROM listings WHERE listings.listing_id = media.listing_id AND listings.status = 'approved')
);

-- Sample Data
INSERT INTO users (firebase_uid, email, first_name, last_name, role)
VALUES 
    ('firebase_admin_uid_123', 'admin@example.com', 'Admin', 'User', 'admin'),
    ('firebase_vendor_uid_456', 'vendor@example.com', 'Vendor', 'User', 'vendor'),
    ('firebase_organizer_uid_789', 'organizer@example.com', 'Organizer', 'User', 'organizer')
ON CONFLICT DO NOTHING;

INSERT INTO categories (name, type, description)
VALUES 
    ('Diwali', 'event', 'Diwali festival events'),
    ('Restaurant', 'vendor', 'Indian restaurants'),
    ('Temple Festivals', 'temple', 'Categories for temple-related events and services')
ON CONFLICT DO NOTHING;

-- Insert a vendor with two images and review entry
DO $$ 
DECLARE
    v_listing_id BIGINT;
    v_user_id UUID;
BEGIN
    -- Get vendor user_id
    SELECT user_id INTO v_user_id
    FROM users
    WHERE firebase_uid = 'firebase_vendor_uid_456';

    -- Insert listing
    INSERT INTO listings (type, title, description, address, city, state, zip_code, user_id, status)
    VALUES ('vendor', 'Saffron Indian Restaurant', 'Authentic Indian cuisine', '123 Main St', 'New York', 'NY', '10001', 
            v_user_id, 'pending')
    ON CONFLICT DO NOTHING
    RETURNING listing_id INTO v_listing_id;

    -- Insert first image
    IF v_listing_id IS NOT NULL AND (SELECT COUNT(*) FROM media WHERE listing_id = v_listing_id) < 2 THEN
        INSERT INTO media (listing_id, media_type, url, caption)
        VALUES (v_listing_id, 'image', 'https://s3.amazonaws.com/images/saffron_logo.jpg', 'Restaurant Logo')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Insert second image
    IF v_listing_id IS NOT NULL AND (SELECT COUNT(*) FROM media WHERE listing_id = v_listing_id) < 2 THEN
        INSERT INTO media (listing_id, media_type, url, caption)
        VALUES (v_listing_id, 'image', 'https://s3.amazonaws.com/images/saffron_storefront.jpg', 'Storefront')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Insert review entry
    IF v_listing_id IS NOT NULL THEN
        INSERT INTO listing_reviews (listing_id, admin_id, status, comment)
        VALUES (v_listing_id, (SELECT user_id FROM users WHERE firebase_uid = 'firebase_admin_uid_123'), 
                'pending', 'Awaiting verification of images and details')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Insert a coupon with review entry
DO $$ 
DECLARE
    v_listing_id BIGINT;
    v_coupon_id BIGINT;
BEGIN
    -- Get vendor listing_id
    SELECT listing_id INTO v_listing_id
    FROM listings
    WHERE title = 'Saffron Indian Restaurant';

    -- Insert coupon
    INSERT INTO coupons (listing_id, user_id, code, description, discount_type, discount_value, start_date, expiry_date, status)
    VALUES (v_listing_id, (SELECT user_id FROM users WHERE firebase_uid = 'firebase_vendor_uid_456'), 
            'DIWALI20', '20% off all items', 'percentage', 20.00, '2025-11-01', '2025-11-15', 'pending')
    ON CONFLICT DO NOTHING
    RETURNING coupon_id INTO v_coupon_id;

    -- Insert coupon review
    IF v_coupon_id IS NOT NULL THEN
        INSERT INTO coupon_reviews (coupon_id, status, comment)
        VALUES (v_coupon_id, 'pending', 'Awaiting admin review for coupon')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Link vendor listing to category
INSERT INTO listing_categories (listing_id, category_id)
SELECT listing_id, (SELECT category_id FROM categories WHERE name = 'Restaurant')
FROM listings WHERE title = 'Saffron Indian Restaurant'
ON CONFLICT DO NOTHING;

-- Verify insertions
SELECT * FROM listings;
SELECT * FROM media;
SELECT * FROM listing_reviews;
SELECT * FROM coupons;
SELECT * FROM coupon_reviews;
SELECT * FROM listing_categories;