-- Enable UUID extension
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        CREATE EXTENSION "uuid-ossp";
    END IF;
END $$;

-- Drop existing tables and functions (for clean setup, comment out if preserving data)
DROP TABLE IF EXISTS favorites, ticket_purchases, ticket_types, coupon_redemptions, coupon_reviews, coupons, notifications, rsvps, reviews, listing_reviews, listing_categories, vendor_details, temple_details, event_details, media, listings, categories, users CASCADE;
DROP FUNCTION IF EXISTS enforce_image_count, check_image_count_on_approval, update_coupon_usage, check_coupon_status_on_update, check_listing_status_on_update;

-- Create ENUM Types
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
        CREATE TYPE role_type AS ENUM ('user', 'vendor', 'organizer', 'admin');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_type') THEN
        CREATE TYPE listing_type AS ENUM ('event', 'temple', 'vendor', 'activity');
    ELSE
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE pg_type.typname = 'listing_type' AND pg_enum.enumlabel = 'activity'
        ) THEN
            ALTER TYPE listing_type ADD VALUE 'activity';
        END IF;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_type') THEN
        CREATE TYPE category_type AS ENUM ('event', 'vendor', 'temple', 'activity');
    ELSE
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE pg_type.typname = 'category_type' AND pg_enum.enumlabel = 'activity'
        ) THEN
            ALTER TYPE category_type ADD VALUE 'activity';
        END IF;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_type') THEN
        CREATE TYPE listing_type AS ENUM ('event', 'temple', 'vendor');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_type') THEN
        CREATE TYPE category_type AS ENUM ('event', 'vendor', 'temple');
    ELSE
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE pg_type.typname = 'category_type' AND pg_enum.enumlabel = 'temple'
        ) THEN
            ALTER TYPE category_type ADD VALUE 'temple';
        END IF;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
        CREATE TYPE listing_status AS ENUM ('pending', 'approved', 'rejected', 'draft');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
        CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type') THEN
        CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_status') THEN
        CREATE TYPE coupon_status AS ENUM ('pending', 'approved', 'rejected', 'active', 'expired', 'disabled');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM ('event_reminder', 'listing_approval', 'listing_rejection', 'coupon_added', 'ticket_purchase', 'coupon_approval', 'coupon_rejection');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
        CREATE TYPE media_type AS ENUM ('image');
    END IF;
END $$;

-- Commit the transaction
COMMIT;