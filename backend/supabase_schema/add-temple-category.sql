-- Enable UUID extension
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        CREATE EXTENSION "uuid-ossp";
    END IF;
END $$;

-- Create ENUM Types (check existence before creating)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
        CREATE TYPE role_type AS ENUM ('user', 'vendor', 'organizer', 'admin');
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

-- Handle category_type: Add 'temple' if it exists, or create it if it doesn't
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_type') THEN
        -- Check if 'temple' is already in category_type
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE pg_type.typname = 'category_type' AND pg_enum.enumlabel = 'temple'
        ) THEN
            ALTER TYPE category_type ADD VALUE 'temple';
        END IF;
    ELSE
        CREATE TYPE category_type AS ENUM ('event', 'vendor', 'temple');
    END IF;
END $$;

CREATE TABLE event_vendors (
  event_id BIGINT NOT NULL,
  vendor_id BIGINT NOT NULL,
  PRIMARY KEY (event_id, vendor_id),
  FOREIGN KEY (event_id) REFERENCES listings(listing_id),
  FOREIGN KEY (vendor_id) REFERENCES listings(listing_id)
);

CREATE TABLE temple_activities (
  temple_id BIGINT NOT NULL,
  activity_id BIGINT NOT NULL,
  PRIMARY KEY (temple_id, activity_id),
  FOREIGN KEY (temple_id) REFERENCES listings(listing_id),
  FOREIGN KEY (activity_id) REFERENCES listings(listing_id)
);

CREATE TABLE activity_details (
  listing_id BIGINT PRIMARY KEY,
  activity_type TEXT NOT NULL, -- e.g., "Puja", "Festival", "Meditation"
  schedule TEXT, -- e.g., "Every Sunday at 10 AM"
  FOREIGN KEY (listing_id) REFERENCES listings(listing_id)
);

-- Create the favorites table
CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID NOT NULL,
  listing_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(listing_id) ON DELETE CASCADE
);

-- Create the notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID NOT NULL,
  listing_id INTEGER NOT NULL,
  opted_in BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(listing_id) ON DELETE CASCADE
);

-- Commit the transaction to make 'temple' available
COMMIT;