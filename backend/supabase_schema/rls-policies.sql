-- Enable RLS on listings table
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings FORCE ROW LEVEL SECURITY;

-- Allow authenticated users to insert listings
CREATE POLICY "Users can insert listings" ON listings
FOR INSERT TO authenticated
WITH CHECK (auth.uid()::UUID = user_id);

-- Allow public read for approved listings
CREATE POLICY "Public read approved listings" ON listings
FOR SELECT TO public
USING (status = 'approved');

-- Allow admins to update listings
CREATE POLICY "Admins can update listings" ON listings
FOR UPDATE TO authenticated
USING (
    auth.uid()::UUID IN (SELECT user_id FROM users WHERE role = 'admin')
);

-- Enable RLS on media table
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media FORCE ROW LEVEL SECURITY;

-- Allow public read for media of approved listings
CREATE POLICY "View approved listings media" ON media
FOR SELECT TO public
USING (
    EXISTS (SELECT 1 FROM listings WHERE listings.listing_id = media.listing_id AND listings.status = 'approved')
);