-- Ensure uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Clean up existing data to avoid duplicates
DELETE FROM listing_categories;
DELETE FROM media;
DELETE FROM event_details;
DELETE FROM vendor_details;
DELETE FROM temple_details;
DELETE FROM listings;
DELETE FROM categories;
DELETE FROM users WHERE firebase_uid = 'firebase_user_123';

-- Step 2: Insert a single user
INSERT INTO users (user_id, firebase_uid, email, first_name, last_name, role)
VALUES 
  (uuid_generate_v4(), 'firebase_user_123', 'user@example.com', 'John', 'Doe', 'vendor')
RETURNING user_id;

-- Step 3: Insert categories
INSERT INTO categories (name, type, description)
VALUES 
  ('Diwali', 'event', 'Diwali festival events'),
  ('Holi', 'event', 'Holi festival events'),
  ('Restaurant', 'vendor', 'Indian restaurants'),
  ('Catering', 'vendor', 'Indian catering services')
RETURNING category_id, name;

-- Step 4: Insert listings and related data
DO $$
DECLARE
  v_user_id UUID;
  v_listing_ids BIGINT[];
  v_titles TEXT[] := ARRAY[
    'Diwali Festival 2025', 'Holi Color Run', 'Navratri Garba Night',
    'Saffron Indian Restaurant', 'Spice Catering Co.', 'Taste of India',
    'Sri Venkateswara Temple', 'Shiva Vishnu Temple', 'Ganesha Temple'
  ];
  v_types TEXT[] := ARRAY['event', 'event', 'event', 'vendor', 'vendor', 'vendor', 'temple', 'temple', 'temple'];
  v_descriptions TEXT[] := ARRAY[
    'Celebrate Diwali with lights and music', 'Join the vibrant Holi celebration', 'Dance the night away with Garba',
    'Authentic Indian cuisine', 'Catering for all occasions', 'Delicious Indian street food',
    'Hindu temple dedicated to Lord Venkateswara', 'Temple for Shiva and Vishnu devotees', 'Dedicated to Lord Ganesha'
  ];
  v_addresses TEXT[] := ARRAY[
    '123 Park Ave', '456 Beach Rd', '789 Cultural St',
    '101 Main St', '202 Market St', '303 Broadway',
    '404 Temple Rd', '505 Divine St', '606 Holy Ave'
  ];
  v_cities TEXT[] := ARRAY[
    'New York', 'Miami', 'Chicago',
    'San Francisco', 'Austin', 'Seattle',
    'Atlanta', 'Houston', 'Los Angeles'
  ];
  v_states TEXT[] := ARRAY[
    'NY', 'FL', 'IL',
    'CA', 'TX', 'WA',
    'GA', 'TX', 'CA'
  ];
  v_zip_codes TEXT[] := ARRAY[
    '10001', '33139', '60614',
    '94105', '78701', '98122',
    '30301', '77002', '90001'
  ];
  i INTEGER;
  temp_listing_id BIGINT; -- Temporary variable to hold listing_id
BEGIN
  -- Get user_id
  SELECT user_id INTO v_user_id FROM users WHERE firebase_uid = 'firebase_user_123' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with firebase_uid firebase_user_123 not found';
  END IF;

  -- Initialize v_listing_ids array
  v_listing_ids := ARRAY_FILL(0::BIGINT, ARRAY[array_length(v_titles, 1)]);

  -- Insert listings and store listing_ids
  FOR i IN 1..array_length(v_titles, 1) LOOP
    INSERT INTO listings (
      type, title, description, address, city, state, zip_code, user_id, status, approved_by, approved_at
    )
    VALUES (
      v_types[i]::listing_type, -- Cast to listing_type ENUM
      v_titles[i], v_descriptions[i], v_addresses[i], v_cities[i], v_states[i], v_zip_codes[i],
      v_user_id, 'approved', v_user_id, CURRENT_TIMESTAMP
    )
    RETURNING listing_id INTO temp_listing_id; -- Store the returned listing_id
    v_listing_ids[i] := temp_listing_id; -- Assign to array
  END LOOP;

  -- Debug: Print the contents of v_listing_ids
  RAISE NOTICE 'Listing IDs: %', v_listing_ids;

  -- Step 5: Insert media
  INSERT INTO media (listing_id, media_type, url, caption)
  VALUES 
    -- Events (1 image each)
    (v_listing_ids[1], 'image', 'https://via.placeholder.com/300?text=Diwali', 'Diwali Event Poster'),
    (v_listing_ids[2], 'image', 'https://via.placeholder.com/300?text=Holi', 'Holi Event Poster'),
    (v_listing_ids[3], 'image', 'https://via.placeholder.com/300?text=Garba', 'Garba Event Poster'),
    -- Vendors (2 images each)
    (v_listing_ids[4], 'image', 'https://via.placeholder.com/300?text=Restaurant1', 'Restaurant Front'),
    (v_listing_ids[4], 'image', 'https://via.placeholder.com/300?text=Restaurant2', 'Dining Area'),
    (v_listing_ids[5], 'image', 'https://via.placeholder.com/300?text=Catering1', 'Catering Setup'),
    (v_listing_ids[5], 'image', 'https://via.placeholder.com/300?text=Catering2', 'Food Display'),
    (v_listing_ids[6], 'image', 'https://via.placeholder.com/300?text=StreetFood1', 'Food Stall'),
    (v_listing_ids[6], 'image', 'https://via.placeholder.com/300?text=StreetFood2', 'Menu Board'),
    -- Temples (1 image each)
    (v_listing_ids[7], 'image', 'https://via.placeholder.com/300?text=Temple1', 'Temple Entrance'),
    (v_listing_ids[8], 'image', 'https://via.placeholder.com/300?text=Temple2', 'Temple Sanctum'),
    (v_listing_ids[9], 'image', 'https://via.placeholder.com/300?text=Temple3', 'Ganesha Idol');

  -- Step 6: Insert event details
  INSERT INTO event_details (listing_id, start_date_time, is_free)
  VALUES 
    (v_listing_ids[1], '2025-11-10T18:00:00Z', FALSE),
    (v_listing_ids[2], '2025-03-15T10:00:00Z', TRUE),
    (v_listing_ids[3], '2025-10-05T19:00:00Z', FALSE);

  -- Step 7: Insert vendor details
  INSERT INTO vendor_details (listing_id, business_type, products_services)
  VALUES 
    (v_listing_ids[4], 'Restaurant', ARRAY['North Indian', 'South Indian']),
    (v_listing_ids[5], 'Catering', ARRAY['Wedding Catering', 'Event Catering']),
    (v_listing_ids[6], 'Food Truck', ARRAY['Street Food', 'Snacks']);

  -- Step 8: Insert temple details
  INSERT INTO temple_details (listing_id, deity, denomination, services)
  VALUES 
    (v_listing_ids[7], 'Venkateswara', 'Vaishnavism', ARRAY['Daily Puja', 'Festivals']),
    (v_listing_ids[8], 'Shiva, Vishnu', 'Shaivism, Vaishnavism', ARRAY['Abhishekam', 'Havan']),
    (v_listing_ids[9], 'Ganesha', 'Hinduism', ARRAY['Puja', 'Aarti']);

  -- Step 9: Insert listing categories
  INSERT INTO listing_categories (listing_id, category_id)
  VALUES 
    (v_listing_ids[1], (SELECT category_id FROM categories WHERE name = 'Diwali' LIMIT 1)),
    (v_listing_ids[2], (SELECT category_id FROM categories WHERE name = 'Holi' LIMIT 1)),
    (v_listing_ids[3], (SELECT category_id FROM categories WHERE name = 'Diwali' LIMIT 1)),
    (v_listing_ids[4], (SELECT category_id FROM categories WHERE name = 'Restaurant' LIMIT 1)),
    (v_listing_ids[5], (SELECT category_id FROM categories WHERE name = 'Catering' LIMIT 1)),
    (v_listing_ids[6], (SELECT category_id FROM categories WHERE name = 'Restaurant' LIMIT 1));

END $$;