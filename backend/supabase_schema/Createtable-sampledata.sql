-- Create Tables (use IF NOT EXISTS to avoid errors if tables exist)
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

CREATE TABLE IF NOT EXISTS categories (
    category_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type category_type NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Test insertion for temple category
INSERT INTO categories (name, type, description)
VALUES ('Temple Festivals', 'temple', 'Categories for temple-related events and services')
ON CONFLICT DO NOTHING;

-- Test insertion for a temple listing and linking to category
INSERT INTO users (firebase_uid, email, first_name, last_name, role)
VALUES ('firebase_user_uid_789', 'temple@example.com', 'Temple', 'Admin', 'organizer')
ON CONFLICT DO NOTHING;

INSERT INTO listings (type, title, description, address, city, state, zip_code, user_id, status)
VALUES ('temple', 'Sri Venkateswara Temple', 'Hindu temple in Cary', '123 Temple Rd', 'Cary', 'NC', '27518', 
        (SELECT user_id FROM users WHERE firebase_uid = 'firebase_user_uid_789'), 'pending')
ON CONFLICT DO NOTHING
RETURNING listing_id;

INSERT INTO listing_categories (listing_id, category_id)
VALUES ((SELECT listing_id FROM listings WHERE title = 'Sri Venkateswara Temple'), 
        (SELECT category_id FROM categories WHERE name = 'Temple Festivals'))
ON CONFLICT DO NOTHING;

-- Verify category_type values
SELECT enumlabel 
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'category_type';