const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const admin = require('../config/firebaseAdmin');
const { body, validationResult } = require('express-validator');


// Add router-level logging
router.use((req, res, next) => {
  console.log(`Listings router handling: ${req.method} ${req.url}`);
  next();
});

// GET /fetchfavorites - Fetch the user's favorite listings
router.get('/fetchfavorites', async (req, res) => {
  console.log('GET /fetchfavorites endpoint hit');
  
  const { user_id: firebase_uid } = req.query;
  console.log('Query params:', req.query);
  
  try {
    if (!firebase_uid) {
      return res.status(400).json({ error: 'Missing required field: user_id' });
    }

    console.log('Fetching favorites for firebase_uid:', firebase_uid);
    const { data: favorites, error: favoritesError } = await supabase
      .from('favorites')
      .select(`
        listing_id,
        listings (
          *,
          event_details (
            start_date_time,
            is_free
          ),
          temple_details (
            deity,
            denomination
          ),
          vendor_details (
            business_type
          ),
          activity_details (
            activity_type,
            schedule
          ),
          listing_categories (
            categories (
              category_id,
              name
            )
          )
        )
      `)
      .eq('firebase_uid', firebase_uid);

    if (favoritesError) {
      console.error('Error fetching favorites:', favoritesError);
      return res.status(500).json({ error: favoritesError.message });
    }

    console.log('Raw favorites data:', JSON.stringify(favorites, null, 2));

    const validFavorites = favorites.filter(favorite => favorite.listings !== null);
    
    // Format the response
    const formattedFavorites = validFavorites.map(favorite => ({
      ...favorite.listings,
      categories: favorite.listings.listing_categories?.map(lc => lc.categories) || []
    }));

    res.json(formattedFavorites);
  } catch (err) {
    console.error('Error fetching favorites:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Search approved listings (public)
// router.get('/search', async (req, res) => {
//   const { category, location, date, type } = req.query;
  
//   try {
//     // Step 1: Fetch listings with related data
//     let query = supabase
//       .from('listings')
//       .select(`
//         listing_id,
//         type,
//         title,
//         description,
//         address,
//         city,
//         state,
//         zip_code,
//         status,
//         media:media(url, caption),
//         event_details:event_details(start_date_time, is_free),
//         temple_details:temple_details(deity, denomination),
//         vendor_details:vendor_details(business_type)
//       `)
//       .eq('status', 'approved');

//     // Apply filters
//     if (type && ['event', 'vendor', 'temple'].includes(type)) {
//       query = query.eq('type', type);
//     }
//     if (location) {
//       query = query.or(`city.ilike.%${location}%,state.ilike.%${location}%`);
//     }
//     if (date && date !== 'any') {
//       const startOfDay = new Date(date).toISOString();
//       const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999)).toISOString();
//       query = query
//         .eq('type', 'event')
//         .gte('event_details.start_date_time', startOfDay)
//         .lte('event_details.start_date_time', endOfDay);
//     }

//     const { data: listings, error: listingsError } = await query.limit(5);
//     if (listingsError) {
//       console.error('Listings error:', listingsError);
//       throw listingsError;
//     }

//     // Step 2: Fetch categories for the listings
//     const listingIds = listings.map(l => l.listing_id);
//     let categoryQuery = supabase
//       .from('listing_categories')
//       .select(`
//         listing_id,
//         category_id,
//         categories:categories(category_id, name)
//       `)
//       .in('listing_id', listingIds);

//     if (category) {
//       categoryQuery = categoryQuery.ilike('categories.name', `%${category}%`);
//     }

//     const { data: categoryData, error: categoryError } = await categoryQuery;
//     if (categoryError) {
//       console.error('Category error:', categoryError);
//       throw categoryError;
//     }

//     // Step 3: Merge categories into listings
//     const enrichedListings = listings.map(listing => ({
//       ...listing,
//       categories: categoryData
//         .filter(c => c.listing_id === listing.listing_id)
//         .map(c => c.categories)
//         .filter(c => c) // Remove null entries
//     }));

//     console.log('Search results:', enrichedListings); // Debug
//     res.json(enrichedListings || []);
//   } catch (error) {
//     console.error('Search error:', error);
//     res.status(500).json({ error: error.message, data: [] });
//   }
// });
// router.get('/search', async (req, res) => {
//   console.log('Received /listings/search request:', req.query);
//   try {
//     const {
//       page = 1,
//       limit = 6,
//       type,
//       category,
//       location,
//       date,
//     } = req.query;

//     let query = supabase
//       .from('listings')
//       .select(`
//         *,
       
//         listing_categories!inner (
//           categories (
//             category_id,
//             name
//           )
//         )
//       `)
//       .eq('status', 'approved')
//       .order('created_at', { ascending: false })
//       .range((page - 1) * limit, page * limit - 1);

//     if (type) query = query.eq('type', type);
//     if (location) {
//       const [city, state] = location.split(',').map((s) => s.trim());
//       if (city) query = query.ilike('city', `%${city}%`);
//       if (state) query = query.eq('state', state);
//     }
//     if (date) {
//       query = query.gte('created_at', date);
//       query = query.lte('created_at', `${date}T23:59:59`);
//       // For events, check event_details.start_date_time
//       if (type === 'event') {
//         query = query.gte('event_details.start_date_time', date);
//         query = query.lte('event_details.start_date_time', `${date}T23:59:59`);
//       }
//     }
//     if (category) {
//       query = query.eq('listing_categories.categories.name', category);
//     }

//     const { data, error } = await query;

//     if (error) {
//       console.error('Error fetching listings:', error);
//       return res.status(500).json({ error: 'Failed to fetch listings' });
//     }

//     // Flatten categories for frontend
//     const formattedData = data.map((listing) => ({
//       ...listing,
//       categories: listing.listing_categories.map((lc) => lc.categories),
//       media: listing.listing_media,
//     }));

//     res.json(formattedData);
//   } catch (err) {
//     console.error('Server error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// router.get('/categories', async (req, res) => {
//   try {
//     const { data, error } = await supabase.from('categories').select('*');
//     if (error) throw error;
//     res.json(data);
//   } catch (err) {
//     console.error('Error fetching categories:', err);
//     res.status(500).json({ error: 'Failed to fetch categories' });
//   }
// });

//const fs = require('fs');

// Simple function to log to both console and a file
// const logToFile = (message, data) => {
//   console.log(message, JSON.stringify(data, null, 2));
//   fs.appendFileSync(
//     'backend.log',
//     `${new Date().toISOString()} - ${message}\n${JSON.stringify(data, null, 2)}\n\n`,
//     'utf8'
//   );
// };

// router.get('/search', async (req, res) => {
//   console.log('Received /listings/search request:', req.query);
//   try {
//     const {
//       page = 1,
//       limit = 6,
//       type,
//       category,
//       location,
//       date,
//     } = req.query;

//     console.log('Parsed query params:', { page, limit, type, category, location, date });

//     // Step 1: Fetch listings with related data (excluding media for now)
//     console.log('Building Supabase query:', {});
//     let query = supabase
//       .from('listings')
//       .select(`
//         *,
//         event_details (
//           start_date_time
//         ),
//         temple_details (
//           deity,
//           denomination
//         ),
//         vendor_details (
//           business_type
//         ),
//         listing_categories!inner (
//           categories (
//             category_id,
//             name
//           )
//         )
//       `)
//       .eq('status', 'approved')
//       .order('created_at', { ascending: false })
//       .range((page - 1) * limit, page * limit - 1);

//     if (type) query = query.eq('type', type);
//     if (location) {
//       const [city, state] = location.split(',').map((s) => s.trim());
//       if (city) query = query.ilike('city', `%${city}%`);
//       if (state) query = query.eq('state', state);
//     }
//     if (date) {
//       query = query.gte('created_at', date);
//       query = query.lte('created_at', `${date}T23:59:59`);
//       if (type === 'event') {
//         query = query.gte('event_details.start_date_time', date);
//         query = query.lte('event_details.start_date_time', `${date}T23:59:59`);
//       }
//     }
//     if (category) {
//       query = query.eq('listing_categories.categories.name', category);
//     }

//     console.log('Executing Supabase query:', {});
//     const { data: listings, error: listingError } = await query;

//     if (listingError) {
//       console.log('Error fetching listings:', listingError);
//       return res.status(500).json({ error: 'Failed to fetch listings' });
//     }

//     console.log('Listings without media:', listings);

//     // Step 2: Check if there are listings to fetch media for
//     if (!listings || listings.length === 0) {
//       console.log('No listings found, skipping media fetch:', {});
//       res.json([]);
//       return;
//     }

//     // Step 3: Extract listing_ids
//     const listingIds = listings.map(listing => listing.listing_id);
//     console.log('Extracted listing_ids:', listingIds);

//     if (!listingIds || listingIds.length === 0) {
//       console.log('No listing_ids to fetch media for:', {});
//       res.json(listings.map(listing => ({
//         ...listing,
//         media: [],
//         categories: listing.listing_categories.map((lc) => lc.categories),
//       })));
//       return;
//     }

//     // Step 4: Fetch media for each listing
//     console.log('Fetching media for listing_ids:', listingIds);
//     const { data: mediaData, error: mediaError } = await supabase
//       .from('media')
//       .select('listing_id, url, caption')
//       .in('listing_id', listingIds);

//     if (mediaError) {
//       console.log('Error fetching media:', mediaError);
//       return res.status(500).json({ error: 'Failed to fetch media' });
//     }

//     console.log('Fetched media data:', mediaData);

//     // Step 5: Combine media with listings
//     const formattedData = listings.map((listing) => {
//       const listingMedia = mediaData.filter(media => String(media.listing_id) === String(listing.listing_id));
//       return {
//         ...listing,
//         media: listingMedia,
//         categories: listing.listing_categories.map((lc) => lc.categories),
//       };
//     });

//     console.log('Formatted listings with media:', formattedData);

//     res.json(formattedData);
//   } catch (err) {
//     console.log('Server error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
// const fs = require('fs');

// const logToFile = (message, data) => {
//   console.log(message, JSON.stringify(data, null, 2));
//   fs.appendFileSync(
//     'backend.log',
//     `${new Date().toISOString()} - ${message}\n${JSON.stringify(data, null, 2)}\n\n`,
//     'utf8'
//   );
// };

// router.get('/search', async (req, res) => {
//   logToFile('Received /listings/search request:', req.query);
//   try {
//     const {
//       page = 1,
//       limit = 6,
//       type,
//       category,
//       location,
//       date,
//       status,
//     } = req.query;

//     logToFile('Parsed query params:', { page, limit, type, category, location, date, status });

//     let query = supabase
//       .from('listings')
//       .select(`
//         *,
//         event_details (
//           start_date_time
//         ),
//         temple_details (
//           deity,
//           denomination
//         ),
//         vendor_details (
//           business_type
//         ),
//         listing_categories (
//           categories (
//             category_id,
//             name
//           )
//         )
//       `)
//       .order('created_at', { ascending: false })
//       .range((page - 1) * limit, page * limit - 1);

//     if (status) query = query.eq('status', status);
//     else query = query.eq('status', 'approved');

//     if (type) query = query.eq('type', type);
//     if (location) {
//       const [city, state] = location.split(',').map((s) => s.trim());
//       if (city) query = query.ilike('city', `%${city}%`);
//       if (state) query = query.eq('state', state);
//     }
//     if (date) {
//       query = query.gte('created_at', date);
//       query = query.lte('created_at', `${date}T23:59:59`);
//       if (type === 'event') {
//         query = query.gte('event_details.start_date_time', date);
//         query = query.lte('event_details.start_date_time', `${date}T23:59:59`);
//       }
//     }
//     if (category) {
//       query = query.eq('listing_categories.categories.name', category);
//     }

//     logToFile('Executing Supabase query:', {});
//     const { data: listings, error: listingError } = await query;

//     if (listingError) {
//       logToFile('Error fetching listings:', listingError);
//       return res.status(500).json({ error: 'Failed to fetch listings' });
//     }

//     logToFile('Listings without media:', listings);

//     if (!listings || listings.length === 0) {
//       logToFile('No listings found, skipping media fetch:', {});
//       res.json([]);
//       return;
//     }

//     const listingIds = listings.map(listing => Number(listing.listing_id));
//     logToFile('Extracted listing_ids:', listingIds);

//     if (!listingIds || listingIds.length === 0) {
//       logToFile('No listing_ids to fetch media for:', {});
//       res.json(listings.map(listing => ({
//         ...listing,
//         media: [],
//         categories: listing.listing_categories.map((lc) => lc.categories),
//       })));
//       return;
//     }

//     logToFile('Fetching media for listing_ids:', listingIds);
//     const { data: mediaData, error: mediaError } = await supabase
//       .from('media')
//       .select('listing_id, url, caption')
//       .in('listing_id', listingIds);

//     if (mediaError) {
//       logToFile('Error fetching media:', mediaError);
//       return res.status(500).json({ error: 'Failed to fetch media' });
//     }

//     logToFile('Fetched media data:', mediaData);

//     const eventIds = listings.filter(listing => listing.type === 'event').map(listing => Number(listing.listing_id));
//     let eventVendorsData = [];
//     if (eventIds.length > 0) {
//       logToFile('Fetching event vendors for event_ids:', eventIds);
//       const { data: eventVendors, error: eventVendorsError } = await supabase
//         .from('event_vendors')
//         .select('event_id, vendor_id')
//         .in('event_id', eventIds);

//       if (eventVendorsError) {
//         logToFile('Error fetching event vendors:', eventVendorsError);
//         return res.status(500).json({ error: 'Failed to fetch event vendors' });
//       }

//       logToFile('Fetched event vendors:', eventVendors);

//       const vendorIds = eventVendors.map(ev => Number(ev.vendor_id));
//       if (vendorIds.length > 0) {
//         const { data: vendorDetails, error: vendorDetailsError } = await supabase
//           .from('listings')
//           .select('listing_id, title')
//           .eq('type', 'vendor')
//           .in('listing_id', vendorIds);

//         if (vendorDetailsError) {
//           logToFile('Error fetching vendor details:', vendorDetailsError);
//           return res.status(500).json({ error: 'Failed to fetch vendor details' });
//         }

//         logToFile('Fetched vendor details:', vendorDetails);

//         eventVendorsData = eventVendors.map(ev => ({
//           event_id: Number(ev.event_id),
//           vendor: vendorDetails.find(v => Number(v.listing_id) === Number(ev.vendor_id)) || { listing_id: ev.vendor_id, title: 'Unknown Vendor' }
//         }));
//       }
//     }

//     const formattedData = listings.map((listing) => {
//       const listingMedia = mediaData.filter(media => Number(media.listing_id) === Number(listing.listing_id));
//       const associatedVendors = listing.type === 'event'
//         ? eventVendorsData.filter(ev => Number(ev.event_id) === Number(listing.listing_id)).map(ev => ev.vendor)
//         : [];
//       return {
//         ...listing,
//         media: listingMedia,
//         vendors: associatedVendors,
//         categories: listing.listing_categories.map((lc) => lc.categories),
//       };
//     });

//     logToFile('Formatted listings with media and vendors:', formattedData);

//     res.json(formattedData);
//   } catch (err) {
//     logToFile('Server error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
const fs = require('fs');

const logToFile = (message, data) => {
  console.log(message, JSON.stringify(data, null, 2));
  fs.appendFileSync(
    'backend.log',
    `${new Date().toISOString()} - ${message}\n${JSON.stringify(data, null, 2)}\n\n`,
    'utf8'
  );
};

router.get('/users/check', async (req, res) => {
  try {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { data: userData, error } = await supabase
      .from('users')
      .select('first_name, last_name, email, phone_number, terms_accepted, is_admin')
      .eq('firebase_uid', decodedToken.uid)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking user:', error);
      return res.status(500).json({ error: 'Failed to check user' });
    }

    if (!userData) {
      return res.json({
        profileComplete: false,
        user: null,
      });
    }

    const profileComplete = !!(
      userData.first_name?.trim() &&
      userData.last_name?.trim() &&
      userData.email?.trim() &&
      userData.terms_accepted
    ); // phone_number is optional

    res.json({
      profileComplete,
      user: {
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        phone_number: userData.phone_number || '',
        terms_accepted: userData.terms_accepted || false,
        is_admin: userData.is_admin || false,
      },
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/update', async (req, res) => {
  try {
    const { firebase_uid, email, first_name, last_name, phone_number, terms_accepted } = req.body;
    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) return res.status(401).json({ error: 'Unauthorized' });
    if (!firebase_uid || !email || !first_name || !last_name || terms_accepted === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    if (decodedToken.uid !== firebase_uid) {
      return res.status(403).json({ error: 'Token mismatch' });
    }

    const upsertData = {
      firebase_uid,
      email,
      first_name,
      last_name,
      terms_accepted,
      updated_at: new Date().toISOString(),
    };

    if (phone_number !== undefined) {
      upsertData.phone_number = phone_number || null; // Allow empty string or null
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          ...upsertData,
          created_at: new Date().toISOString(), // Set only for new records
        },
        {
          onConflict: 'firebase_uid',
          returning: 'representation',
        }
      )
      .select('user_id')
      .single();

    if (error) {
      console.error('Error upserting user:', error);
      return res.status(500).json({ error: 'Failed to upsert user', details: error.message });
    }

    res.json({ message: 'User upserted successfully', user_id: data.user_id });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin: Create a new coupon
router.post('/coupons', verifyToken, [
  body('code').isString().notEmpty().trim(),
  body('description').isString().notEmpty().trim(),
  body('discount_percentage').optional().isNumeric().toFloat(),
  body('discount_amount').optional().isNumeric().toFloat(),
  body('location').isString().notEmpty().trim(),
  body('valid_from').isISO8601(),
  body('valid_until').isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, description, discount_percentage, discount_amount, location, valid_from, valid_until } = req.body;
  const firebase_uid = req.user.uid;

  try {
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_id, is_admin')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (userError || !userData?.is_admin) {
      return res.status(403).json({ error: 'Access denied: Admins only' });
    }

    // Validate either percentage or amount is provided, not both
    if ((discount_percentage && discount_amount) || (!discount_percentage && !discount_amount)) {
      return res.status(400).json({ error: 'Provide either discount_percentage or discount_amount, not both' });
    }

    // Insert coupon
    const { data, error } = await supabase
      .from('coupons')
      .insert({
        code,
        description,
        discount_percentage,
        discount_amount,
        location,
        valid_from,
        valid_until,
        created_by: userData.user_id,
      })
      .select('coupon_id')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create coupon', details: error.message });
    }

    res.json({ message: 'Coupon created successfully', coupon_id: data.coupon_id });
  } catch (err) {
    console.error('Error creating coupon:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch coupons with optional location search
router.get('/coupons', async (req, res) => {
  const { location } = req.query;

  try {
    let query = supabase
      .from('coupons')
      .select('*')
      .gte('valid_until', new Date().toISOString()) // Only show active coupons
      .order('created_at', { ascending: false });

    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch coupons' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error fetching coupons:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/users/insert', async (req, res) => {
  try {
    const { firebase_uid, email } = req.body;
    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) return res.status(401).json({ error: 'Unauthorized' });
    if (!firebase_uid || !email) return res.status(400).json({ error: 'Missing required fields' });

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    if (decodedToken.uid !== firebase_uid) {
      return res.status(403).json({ error: 'Token mismatch' });
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          firebase_uid,
          email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'firebase_uid' }
      )
      .select('user_id')
      .single();

    if (error) {
      console.error('Error inserting user:', error);
      return res.status(500).json({ error: 'Failed to insert user', details: error.message });
    }

    res.json({ message: 'User inserted successfully', user_id: data.user_id });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});




router.get('/search', async (req, res) => {
  logToFile('Received /listings/search request:', req.query);
  try {
    const {
      page = 1,
      limit = 6,
      type,
      category,
      location,
      date,
      status,
    } = req.query;

    logToFile('Parsed query params:', { page, limit, type, category, location, date, status });

    let query = supabase
      .from('listings')
      .select(`
        *,
        event_details (
          start_date_time
        ),
        temple_details (
          deity,
          denomination
        ),
        vendor_details (
          business_type
        ),
        activity_details (
          activity_type,
          schedule
        ),
        listing_categories (
          categories (
            category_id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);
    else query = query.eq('status', 'approved');

    if (type) query = query.eq('type', type);
    if (location) {
      const [city, state] = location.split(',').map((s) => s.trim());
      if (city) query = query.ilike('city', `%${city}%`);
      if (state) query = query.eq('state', state);
    }
    if (date) {
      query = query.gte('created_at', date);
      query = query.lte('created_at', `${date}T23:59:59`);
      if (type === 'event') {
        query = query.gte('event_details.start_date_time', date);
        query = query.lte('event_details.start_date_time', `${date}T23:59:59`);
      }
    }
    if (category) {
      query = query.eq('listing_categories.categories.name', category);
    }

    logToFile('Executing Supabase query:', {});
    const { data: listings, error: listingError } = await query;

    if (listingError) {
      logToFile('Error fetching listings:', listingError);
      return res.status(500).json({ error: 'Failed to fetch listings' });
    }

    logToFile('Listings without media:', listings);

    if (!listings || listings.length === 0) {
      logToFile('No listings found, skipping media fetch:', {});
      res.json([]);
      return;
    }

    const listingIds = listings.map(listing => Number(listing.listing_id));
    logToFile('Extracted listing_ids:', listingIds);

    if (!listingIds || listingIds.length === 0) {
      logToFile('No listing_ids to fetch media for:', {});
      res.json(listings.map(listing => ({
        ...listing,
        media: [],
        categories: listing.listing_categories.map((lc) => lc.categories),
      })));
      return;
    }

    logToFile('Fetching media for listing_ids:', listingIds);
    const { data: mediaData, error: mediaError } = await supabase
      .from('media')
      .select('listing_id, url, caption')
      .in('listing_id', listingIds);

    if (mediaError) {
      logToFile('Error fetching media:', mediaError);
      return res.status(500).json({ error: 'Failed to fetch media' });
    }

    logToFile('Fetched media data:', mediaData);

    // Fetch associated vendors for events
    const eventIds = listings.filter(listing => listing.type === 'event').map(listing => Number(listing.listing_id));
    let eventVendorsData = [];
    if (eventIds.length > 0) {
      logToFile('Fetching event vendors for event_ids:', eventIds);
      const { data: eventVendors, error: eventVendorsError } = await supabase
        .from('event_vendors')
        .select('event_id, vendor_id')
        .in('event_id', eventIds);

      if (eventVendorsError) {
        logToFile('Error fetching event vendors:', eventVendorsError);
        return res.status(500).json({ error: 'Failed to fetch event vendors' });
      }

      logToFile('Fetched event vendors:', eventVendors);

      const vendorIds = eventVendors.map(ev => Number(ev.vendor_id));
      if (vendorIds.length > 0) {
        const { data: vendorDetails, error: vendorDetailsError } = await supabase
          .from('listings')
          .select('listing_id, title')
          .eq('type', 'vendor')
          .in('listing_id', vendorIds);

        if (vendorDetailsError) {
          logToFile('Error fetching vendor details:', vendorDetailsError);
          return res.status(500).json({ error: 'Failed to fetch vendor details' });
        }

        logToFile('Fetched vendor details:', vendorDetails);

        eventVendorsData = eventVendors.map(ev => ({
          event_id: Number(ev.event_id),
          vendor: vendorDetails.find(v => Number(v.listing_id) === Number(ev.vendor_id)) || { listing_id: ev.vendor_id, title: 'Unknown Vendor' }
        }));
      }
    }

    // Fetch associated activities for temples
    const templeIds = listings.filter(listing => listing.type === 'temple').map(listing => Number(listing.listing_id));
    let templeActivitiesData = [];
    if (templeIds.length > 0) {
      logToFile('Fetching temple activities for temple_ids:', templeIds);
      const { data: templeActivities, error: templeActivitiesError } = await supabase
        .from('temple_activities')
        .select('temple_id, activity_id')
        .in('temple_id', templeIds);

      if (templeActivitiesError) {
        logToFile('Error fetching temple activities:', templeActivitiesError);
        return res.status(500).json({ error: 'Failed to fetch temple activities' });
      }

      logToFile('Fetched temple activities:', templeActivities);

      const activityIds = templeActivities.map(ta => Number(ta.activity_id));
      if (activityIds.length > 0) {
        const { data: activityDetails, error: activityDetailsError } = await supabase
          .from('listings')
          .select('listing_id, title')
          .eq('type', 'activity')
          .in('listing_id', activityIds);

        if (activityDetailsError) {
          logToFile('Error fetching activity details:', activityDetailsError);
          return res.status(500).json({ error: 'Failed to fetch activity details' });
        }

        logToFile('Fetched activity details:', activityDetails);

        templeActivitiesData = templeActivities.map(ta => ({
          temple_id: Number(ta.temple_id),
          activity: activityDetails.find(a => Number(a.listing_id) === Number(ta.activity_id)) || { listing_id: ta.activity_id, title: 'Unknown Activity' }
        }));
      }
    }

    // Combine media, vendors, and activities with listings
    const formattedData = listings.map((listing) => {
      const listingMedia = mediaData.filter(media => Number(media.listing_id) === Number(listing.listing_id));
      const associatedVendors = listing.type === 'event'
        ? eventVendorsData.filter(ev => Number(ev.event_id) === Number(listing.listing_id)).map(ev => ev.vendor)
        : [];
      const associatedActivities = listing.type === 'temple'
        ? templeActivitiesData.filter(ta => Number(ta.temple_id) === Number(listing.listing_id)).map(ta => ta.activity)
        : [];
      return {
        ...listing,
        media: listingMedia,
        vendors: associatedVendors,
        activities: associatedActivities,
        categories: listing.listing_categories.map((lc) => lc.categories),
      };
    });

    logToFile('Formatted listings with media, vendors, and activities:', formattedData);

    res.json(formattedData);
  } catch (err) {
    logToFile('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.post('/categories', async (req, res) => {
  const { name, type } = req.body;
  try {
    if (!name || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!['event', 'vendor', 'temple', 'activity'].includes(type)) {
      return res.status(400).json({ error: 'Invalid category type' });
    }
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, type })
      .select();
    if (error) {
      console.error('Error creating category:', error);
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data[0]);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// router.get('/categories', async (req, res) => {
//   try {
//     const { data, error } = await supabase.from('categories').select('*');
//     if (error) throw error;
//     res.json(data);
//   } catch (err) {
//     console.error('Error fetching categories:', err);
//     res.status(500).json({ error: 'Failed to fetch categories' });
//   }
// });
// ... (other routes: POST, PUT, etc., remain unchanged)


// Existing routes (e.g., GET /, GET /search) remain unchanged

// Create new listing


// router.post('/', async (req, res) => {
//   const {
//     type,
//     title,
//     description,
//     address,
//     city,
//     state,
//     zip_code,
//     contact_email,
//     contact_phone,
//     website_url,
//     media,
//     status,
//     user_id: firebase_uid,
//     event,
//     temple,
//     vendor,
//     category_id,
//     vendor_ids, // Array of vendor listing_ids (as numbers)
//   } = req.body;

//   try {
//     if (!type || !title || !address || !city || !state || !firebase_uid) {
//       return res.status(400).json({ error: 'Missing required fields' });
//     }

//     const token = req.headers.authorization?.split('Bearer ')[1];
//     if (!token) {
//       return res.status(401).json({ error: 'No token provided' });
//     }
//     const decodedToken = await admin.auth().verifyIdToken(token);
//     if (decodedToken.uid !== firebase_uid) {
//       return res.status(401).json({ error: 'Unauthorized user' });
//     }

//     const { data: user, error: userError } = await supabase
//       .from('users')
//       .select('user_id')
//       .eq('firebase_uid', firebase_uid)
//       .single();

//     if (userError || !user) {
//       console.error('User lookup error:', userError);
//       return res.status(400).json({ error: 'User not found' });
//     }

//     const user_id = user.user_id;

//     const { data: listing, error: listingError } = await supabase
//       .from('listings')
//       .insert({
//         type,
//         title,
//         description,
//         address,
//         city,
//         state,
//         zip_code,
//         contact_email,
//         contact_phone,
//         website_url,
//         status: status || 'pending',
//         user_id
//       })
//       .select('listing_id')
//       .single();

//     if (listingError) {
//       console.error('Listing error:', listingError);
//       return res.status(500).json({ error: listingError.message });
//     }

//     const listing_id = listing.listing_id;

//     if (type === 'event' && event) {
//       const { error: eventError } = await supabase
//         .from('event_details')
//         .insert({
//           listing_id,
//           start_date_time: event.start_date_time,
//           is_free: event.is_free || false
//         });
//       if (eventError) {
//         console.error('Event details error:', eventError);
//         return res.status(500).json({ error: eventError.message });
//       }

//       if (Array.isArray(vendor_ids) && vendor_ids.length > 0) {
//         // Convert vendor_ids to numbers and validate
//         const vendorIdsAsNumbers = vendor_ids.map(id => Number(id));
//         if (vendorIdsAsNumbers.some(id => isNaN(id))) {
//           return res.status(400).json({ error: 'Invalid vendor IDs: must be numbers' });
//         }

//         const { data: vendors, error: vendorCheckError } = await supabase
//           .from('listings')
//           .select('listing_id')
//           .eq('type', 'vendor')
//           .in('listing_id', vendorIdsAsNumbers);

//         if (vendorCheckError) {
//           console.error('Vendor check error:', vendorCheckError);
//           return res.status(500).json({ error: vendorCheckError.message });
//         }

//         const validVendorIds = vendors.map(v => v.listing_id);
//         const invalidVendorIds = vendorIdsAsNumbers.filter(id => !validVendorIds.includes(id));
//         if (invalidVendorIds.length > 0) {
//           return res.status(400).json({ error: `Invalid vendor IDs: ${invalidVendorIds.join(', ')}` });
//         }

//         const eventVendorEntries = vendorIdsAsNumbers.map(vendor_id => ({
//           event_id: listing_id,
//           vendor_id,
//         }));
//         const { error: eventVendorError } = await supabase
//           .from('event_vendors')
//           .insert(eventVendorEntries);

//         if (eventVendorError) {
//           console.error('Event vendors error:', eventVendorError);
//           return res.status(500).json({ error: eventVendorError.message });
//         }
//       }
//     } else if (type === 'temple' && temple) {
//       const { error: templeError } = await supabase
//         .from('temple_details')
//         .insert({
//           listing_id,
//           deity: temple.deity,
//           denomination: temple.denomination
//         });
//       if (templeError) {
//         console.error('Temple details error:', templeError);
//         return res.status(500).json({ error: templeError.message });
//       }
//     } else if (type === 'vendor' && vendor) {
//       const { error: vendorError } = await supabase
//         .from('vendor_details')
//         .insert({
//           listing_id,
//           business_type: vendor.business_type
//         });
//       if (vendorError) {
//         console.error('Vendor details error:', vendorError);
//         return res.status(500).json({ error: vendorError.message });
//       }
//     }

//     if (Array.isArray(media) && media.length > 0) {
//       for (const mediaItem of media) {
//         if (!mediaItem.url || typeof mediaItem.url !== 'string') {
//           return res.status(400).json({ error: 'Invalid media URL' });
//         }
//         const { error: mediaError } = await supabase
//           .from('media')
//           .insert({
//             listing_id,
//             media_type: 'image',
//             url: mediaItem.url,
//             caption: mediaItem.caption || null
//           });
//         if (mediaError) {
//           console.error('Media error:', mediaError);
//           return res.status(500).json({ error: mediaError.message });
//         }
//       }
//     }

//     if (category_id) {
//       const { error: categoryError } = await supabase
//         .from('listing_categories')
//         .insert({ listing_id, category_id });
//       if (categoryError) {
//         console.error('Category error:', categoryError);
//         return res.status(500).json({ error: categoryError.message });
//       }
//     }

//     res.status(201).json({ message: 'Listing created', listing_id });
//   } catch (err) {
//     console.error('Create listing error:', err);
//     res.status(500).json({ error: err.message });
//   }
// });
router.post('/', async (req, res) => {
  const {
    type,
    title,
    description,
    address,
    city,
    state,
    zip_code,
    contact_email,
    contact_phone,
    website_url,
    media,
    status,
    user_id: firebase_uid,
    event,
    temple,
    vendor,
    activity, // New field for activity details
    category_id,
    vendor_ids,
    activity_ids, // New field: array of activity listing_ids
  } = req.body;

  try {
    if (!type || !title || !address || !city || !state || !firebase_uid) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.uid !== firebase_uid) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return res.status(400).json({ error: 'User not found' });
    }

    const user_id = user.user_id;

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert({
        type,
        title,
        description,
        address,
        city,
        state,
        zip_code,
        contact_email,
        contact_phone,
        website_url,
        status: status || 'pending',
        user_id
      })
      .select('listing_id')
      .single();

    if (listingError) {
      console.error('Listing error:', listingError);
      return res.status(500).json({ error: listingError.message });
    }

    const listing_id = listing.listing_id;

    if (type === 'event' && event) {
      const { error: eventError } = await supabase
        .from('event_details')
        .insert({
          listing_id,
          start_date_time: event.start_date_time,
          is_free: event.is_free || false
        });
      if (eventError) {
        console.error('Event details error:', eventError);
        return res.status(500).json({ error: eventError.message });
      }

      if (Array.isArray(vendor_ids) && vendor_ids.length > 0) {
        const vendorIdsAsNumbers = vendor_ids.map(id => Number(id));
        if (vendorIdsAsNumbers.some(id => isNaN(id))) {
          return res.status(400).json({ error: 'Invalid vendor IDs: must be numbers' });
        }

        const { data: vendors, error: vendorCheckError } = await supabase
          .from('listings')
          .select('listing_id')
          .eq('type', 'vendor')
          .in('listing_id', vendorIdsAsNumbers);

        if (vendorCheckError) {
          console.error('Vendor check error:', vendorCheckError);
          return res.status(500).json({ error: vendorCheckError.message });
        }

        const validVendorIds = vendors.map(v => v.listing_id);
        const invalidVendorIds = vendorIdsAsNumbers.filter(id => !validVendorIds.includes(id));
        if (invalidVendorIds.length > 0) {
          return res.status(400).json({ error: `Invalid vendor IDs: ${invalidVendorIds.join(', ')}` });
        }

        const eventVendorEntries = vendorIdsAsNumbers.map(vendor_id => ({
          event_id: listing_id,
          vendor_id,
        }));
        const { error: eventVendorError } = await supabase
          .from('event_vendors')
          .insert(eventVendorEntries);

        if (eventVendorError) {
          console.error('Event vendors error:', eventVendorError);
          return res.status(500).json({ error: eventVendorError.message });
        }
      }
    } else if (type === 'temple' && temple) {
      const { error: templeError } = await supabase
        .from('temple_details')
        .insert({
          listing_id,
          deity: temple.deity,
          denomination: temple.denomination
        });
      if (templeError) {
        console.error('Temple details error:', templeError);
        return res.status(500).json({ error: templeError.message });
      }

      // Associate activities with the temple
      if (Array.isArray(activity_ids) && activity_ids.length > 0) {
        const activityIdsAsNumbers = activity_ids.map(id => Number(id));
        if (activityIdsAsNumbers.some(id => isNaN(id))) {
          return res.status(400).json({ error: 'Invalid activity IDs: must be numbers' });
        }

        const { data: activities, error: activityCheckError } = await supabase
          .from('listings')
          .select('listing_id')
          .eq('type', 'activity')
          .in('listing_id', activityIdsAsNumbers);

        if (activityCheckError) {
          console.error('Activity check error:', activityCheckError);
          return res.status(500).json({ error: activityCheckError.message });
        }

        const validActivityIds = activities.map(a => a.listing_id);
        const invalidActivityIds = activityIdsAsNumbers.filter(id => !validActivityIds.includes(id));
        if (invalidActivityIds.length > 0) {
          return res.status(400).json({ error: `Invalid activity IDs: ${invalidActivityIds.join(', ')}` });
        }

        const templeActivityEntries = activityIdsAsNumbers.map(activity_id => ({
          temple_id: listing_id,
          activity_id,
        }));
        const { error: templeActivityError } = await supabase
          .from('temple_activities')
          .insert(templeActivityEntries);

        if (templeActivityError) {
          console.error('Temple activities error:', templeActivityError);
          return res.status(500).json({ error: templeActivityError.message });
        }
      }
    } else if (type === 'vendor' && vendor) {
      const { error: vendorError } = await supabase
        .from('vendor_details')
        .insert({
          listing_id,
          business_type: vendor.business_type
        });
      if (vendorError) {
        console.error('Vendor details error:', vendorError);
        return res.status(500).json({ error: vendorError.message });
      }
    } else if (type === 'activity' && activity) {
      const { error: activityError } = await supabase
        .from('activity_details')
        .insert({
          listing_id,
          activity_type: activity.activity_type,
          schedule: activity.schedule
        });
      if (activityError) {
        console.error('Activity details error:', activityError);
        return res.status(500).json({ error: activityError.message });
      }
    }

    if (Array.isArray(media) && media.length > 0) {
      for (const mediaItem of media) {
        if (!mediaItem.url || typeof mediaItem.url !== 'string') {
          return res.status(400).json({ error: 'Invalid media URL' });
        }
        const { error: mediaError } = await supabase
          .from('media')
          .insert({
            listing_id,
            media_type: 'image',
            url: mediaItem.url,
            caption: mediaItem.caption || null
          });
        if (mediaError) {
          console.error('Media error:', mediaError);
          return res.status(500).json({ error: mediaError.message });
        }
      }
    }

    if (category_id) {
      const { error: categoryError } = await supabase
        .from('listing_categories')
        .insert({ listing_id, category_id });
      if (categoryError) {
        console.error('Category error:', categoryError);
        return res.status(500).json({ error: categoryError.message });
      }
    }

    res.status(201).json({ message: 'Listing created', listing_id });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: err.message });
  }
});
// router.post('/', async (req, res) => {
//   const {
//     type,
//     title,
//     description,
//     address,
//     city,
//     state,
//     zip_code,
//     contact_email,
//     contact_phone,
//     website_url,
//     media,
//     status,
//     user_id: firebase_uid,
//     event,
//     temple,
//     vendor,
//     category_id
//   } = req.body;

//   try {
//     // Validate required fields
//     if (!type || !title || !address || !city || !state || !firebase_uid) {
//       return res.status(400).json({ error: 'Missing required fields' });
//     }

//     // Verify Firebase token
//     const token = req.headers.authorization?.split('Bearer ')[1];
//     if (!token) {
//       return res.status(401).json({ error: 'No token provided' });
//     }
//     const decodedToken = await admin.auth().verifyIdToken(token);
//     if (decodedToken.uid !== firebase_uid) {
//       return res.status(401).json({ error: 'Unauthorized user' });
//     }

//     // Look up user_id (UUID) from firebase_uid
//     const { data: user, error: userError } = await supabase
//       .from('users')
//       .select('user_id')
//       .eq('firebase_uid', firebase_uid)
//       .single();

//     if (userError || !user) {
//       console.error('User lookup error:', userError);
//       return res.status(400).json({ error: 'User not found' });
//     }

//     const user_id = user.user_id;

//     // Insert listing
//     const { data: listing, error: listingError } = await supabase
//       .from('listings')
//       .insert({
//         type,
//         title,
//         description,
//         address,
//         city,
//         state,
//         zip_code,
//         contact_email,
//         contact_phone,
//         website_url,
//         status: status || 'pending',
//         user_id
//       })
//       .select('listing_id')
//       .single();

//     if (listingError) {
//       console.error('Listing error:', listingError);
//       return res.status(500).json({ error: listingError.message });
//     }

//     const listing_id = listing.listing_id;

//     // Insert type-specific details
//     if (type === 'event' && event) {
//       const { error: eventError } = await supabase
//         .from('event_details')
//         .insert({
//           listing_id,
//           start_date_time: event.start_date_time,
//           is_free: event.is_free || false
//         });
//       if (eventError) {
//         console.error('Event details error:', eventError);
//         return res.status(500).json({ error: eventError.message });
//       }
//     } else if (type === 'temple' && temple) {
//       const { error: templeError } = await supabase
//         .from('temple_details')
//         .insert({
//           listing_id,
//           deity: temple.deity,
//           denomination: temple.denomination
//         });
//       if (templeError) {
//         console.error('Temple details error:', templeError);
//         return res.status(500).json({ error: templeError.message });
//       }
//     } else if (type === 'vendor' && vendor) {
//       const { error: vendorError } = await supabase
//         .from('vendor_details')
//         .insert({
//           listing_id,
//           business_type: vendor.business_type
//         });
//       if (vendorError) {
//         console.error('Vendor details error:', vendorError);
//         return res.status(500).json({ error: vendorError.message });
//       }
//     }

//     // Insert media
//     if (Array.isArray(media) && media.length > 0) {
//       for (const mediaItem of media) {
//         const { error: mediaError } = await supabase
//           .from('media')
//           .insert({
//             listing_id,
//             media_type: 'image',
//             url: mediaItem.url,
//             caption: mediaItem.caption
//           });
//         if (mediaError) {
//           console.error('Media error:', mediaError);
//           return res.status(500).json({ error: mediaError.message });
//         }
//       }
//     }

//     // Insert category association
//     if (category_id) {
//       const { error: categoryError } = await supabase
//         .from('listing_categories')
//         .insert({ listing_id, category_id });
//       if (categoryError) {
//         console.error('Category error:', categoryError);
//         return res.status(500).json({ error: categoryError.message });
//       }
//     }

//     res.status(201).json({ message: 'Listing created', listing_id });
//   } catch (err) {
//     console.error('Create listing error:', err);
//     res.status(500).json({ error: err.message });
//   }
// });

// router.get('/pending', adminMiddleware, async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from('listings')
//       .select(`
//         listing_id,
//         title,
//         type,
//         description,
//         city,
//         state,
//         media:media(url, caption),
//         event_details(start_date_time),
//         temple_details(deity, denomination),
//         vendor_details(business_type),
//         user_email:users!inner(email),
//         listing_reviews(comment)
//       `)
//       .eq('status', 'pending');

//     if (error) {
//       console.error('Error fetching pending listings:', error);
//       return res.status(500).json({ error: error.message });
//     }

//     res.json(data || []);
//   } catch (err) {
//     console.error('Unexpected error:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });
router.get('/pending', async (req, res) => {
  try {
    // Verify the user's ID token (from Firebase)
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Query pending listings with explicit relationship
    const { data, error } = await supabase
      .from('listings')
      .select(`
        listing_id,
        title,
        type,
        description,
        city,
        state,
        status,
        contact_email,
        users!listings_user_id_fkey(email, firebase_uid)
      `)
      .eq('status', 'pending');

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// router.post('/review-listing', async (req, res) => {
//   console.log('Received /review-listing request:', req.body);
//   try {
//     const { listingId, status, comment, rejection_reason } = req.body;
//     const idToken = req.headers.authorization?.split('Bearer ')[1];

//     // Validate request
//     if (!idToken) {
//       return res.status(401).json({ error: 'Unauthorized: No token provided' });
//     }
//     if (!listingId || !status || !['approved', 'rejected'].includes(status)) {
//       return res.status(400).json({ error: 'Invalid request: listingId and valid status required' });
//     }
//     if (status === 'rejected' && !rejection_reason?.trim()) {
//       return res.status(400).json({ error: 'Rejection reason required for rejected status' });
//     }

//     // Verify Firebase ID token
//     let decodedToken;
//     try {
//       decodedToken = await admin.auth().verifyIdToken(idToken);
//     } catch (error) {
//       console.error('Error verifying ID token:', error);
//       return res.status(401).json({ error: 'Unauthorized: Invalid token' });
//     }

//     // Check admin status
//     const { data: userData, error: userError } = await supabase
//       .from('users')
//       .select('is_admin, user_id')
//       .eq('user_id', decodedToken.uid) // Assuming user_id is firebase_uid
//       .single();

//     if (userError || !userData?.is_admin) {
//       console.error('Admin check error:', userError);
//       return res.status(403).json({ error: 'Access denied: Admins only' });
//     }

//     // Check if listing exists and is pending
//     const { data: listing, error: listingError } = await supabase
//       .from('listings')
//       .select('status')
//       .eq('listing_id', listingId)
//       .single();

//     if (listingError || !listing) {
//       console.error('Listing fetch error:', listingError);
//       return res.status(404).json({ error: 'Listing not found' });
//     }

//     if (listing.status !== 'pending') {
//       return res.status(400).json({ error: `Listing is already ${listing.status}` });
//     }

//     // Update listing status
//     const { error: updateError } = await supabase
//       .from('listings')
//       .update({ status })
//       .eq('listing_id', listingId);

//     if (updateError) {
//       console.error('Error updating listing:', updateError);
//       return res.status(500).json({ error: 'Failed to update listing' });
//     }

//     // Save review
//     const { error: reviewError } = await supabase
//       .from('listing_reviews')
//       .insert({
//         listing_id: listingId,
//         admin_id: userData.user_id, // Use user_id from users table
//         status,
//         comment: comment || null,
//         rejection_reason: rejection_reason || null,
//       });

//     if (reviewError) {
//       console.error('Error saving review:', reviewError);
//       return res.status(500).json({ error: 'Failed to save review' });
//     }

//     res.json({ message: `Listing ${status} successfully` });
//   } catch (err) {
//     console.error('Server error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

router.post('/review-listing', async (req, res) => {
  console.log('Received /listings/review-listing request:', req.body);
  try {
    const { listingId, status, comment, rejection_reason } = req.body;
    const idToken = req.headers.authorization?.split('Bearer ')[1];

    // Validate request
    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    if (!listingId || !status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid request: listingId and valid status required' });
    }
    if (status === 'rejected' && !rejection_reason?.trim()) {
      return res.status(400).json({ error: 'Rejection reason required for rejected status' });
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying ID token:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Check admin status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin, user_id')
      .eq('firebase_uid', decodedToken.uid) // Use firebase_uid if user_id is UUID
      .single();

    if (userError || !userData?.is_admin) {
      console.error('Admin check error:', userError);
      return res.status(403).json({ error: 'Access denied: Admins only' });
    }

    // Check if listing exists and is pending
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('status')
      .eq('listing_id', listingId)
      .single();

    if (listingError || !listing) {
      console.error('Listing fetch error:', listingError);
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'pending') {
      return res.status(400).json({ error: `Listing is already ${listing.status}` });
    }

    // Update listing status
    const { error: updateError } = await supabase
      .from('listings')
      .update({ status })
      .eq('listing_id', listingId);

    if (updateError) {
      console.error('Error updating listing:', updateError);
      return res.status(500).json({ error: 'Failed to update listing' });
    }

    // Save review
    const { error: reviewError } = await supabase
      .from('listing_reviews')
      .insert({
        listing_id: listingId,
        reviewed_by: userData.user_id,
        status, // Uses review_status (approved/rejected)
        comment: comment || null,
        rejection_reason: rejection_reason || null,
      });

    if (reviewError) {
      console.error('Error saving review:', reviewError);
      return res.status(500).json({ error: 'Failed to save review' });
    }

    res.json({ message: `Listing ${status} successfully` });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(`
        *,
        event_details (
          start_date_time,
          is_free
        ),
        temple_details (
          deity,
          denomination
        ),
        vendor_details (
          business_type
        ),
        activity_details (
          activity_type,
          schedule
        ),
        media (
          url,
          caption
        ),
        listing_categories (
          categories (
            category_id,
            name
          )
        ),
        user_id:users!listings_user_id_fkey(firebase_uid, is_admin)
      `)
      .eq('listing_id', id)
      .single();

    if (listingError || !listing) {
      console.error('Error fetching listing:', listingError);
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Fetch associated vendors for events
    let vendors = [];
    if (listing.type === 'event') {
      const { data: eventVendors, error: eventVendorsError } = await supabase
        .from('event_vendors')
        .select('vendor_id')
        .eq('event_id', id);

      if (eventVendorsError) {
        console.error('Error fetching event vendors:', eventVendorsError);
        return res.status(500).json({ error: 'Failed to fetch event vendors' });
      }

      const vendorIds = eventVendors.map(ev => ev.vendor_id);
      if (vendorIds.length > 0) {
        const { data: vendorDetails, error: vendorDetailsError } = await supabase
          .from('listings')
          .select('listing_id, title')
          .eq('type', 'vendor')
          .in('listing_id', vendorIds);

        if (vendorDetailsError) {
          console.error('Error fetching vendor details:', vendorDetailsError);
          return res.status(500).json({ error: 'Failed to fetch vendor details' });
        }

        vendors = vendorDetails;
      }
    }

    // Fetch associated activities for temples
    let activities = [];
    if (listing.type === 'temple') {
      const { data: templeActivities, error: templeActivitiesError } = await supabase
        .from('temple_activities')
        .select('activity_id')
        .eq('temple_id', id);

      if (templeActivitiesError) {
        console.error('Error fetching temple activities:', templeActivitiesError);
        return res.status(500).json({ error: 'Failed to fetch temple activities' });
      }

      const activityIds = templeActivities.map(ta => ta.activity_id);
      if (activityIds.length > 0) {
        const { data: activityDetails, error: activityDetailsError } = await supabase
          .from('listings')
          .select('listing_id, title')
          .eq('type', 'activity')
          .in('listing_id', activityIds);

        if (activityDetailsError) {
          console.error('Error fetching activity details:', activityDetailsError);
          return res.status(500).json({ error: 'Failed to fetch activity details' });
        }

        activities = activityDetails;
      }
    }

    const formattedListing = {
      ...listing,
      categories: listing.listing_categories.map(lc => lc.categories),
      vendors,
      activities,
      user_id: listing.user_id.firebase_uid,
      is_admin: listing.user_id.is_admin,
    };

    res.json(formattedListing);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Existing endpoints (GET /:id, PUT /:id, etc.) remain unchanged...

// POST /favorites - Mark a listing as a favorite
// router.post('/favorites', async (req, res) => {
//   const { listing_id, user_id: firebase_uid } = req.body;

//   try {
//     if (!listing_id || !firebase_uid) {
//       return res.status(400).json({ error: 'Missing required fields: listing_id and user_id' });
//     }

//     const token = req.headers.authorization?.split('Bearer ')[1];
//     if (!token) {
//       return res.status(401).json({ error: 'No token provided' });
//     }
//     const decodedToken = await admin.auth().verifyIdToken(token);
//     if (decodedToken.uid !== firebase_uid) {
//       return res.status(401).json({ error: 'Unauthorized user' });
//     }

//     // Fetch the user_id from the users table
//     const { data: user, error: userError } = await supabase
//       .from('users')
//       .select('user_id')
//       .eq('firebase_uid', firebase_uid)
//       .single();

//     if (userError || !user) {
//       console.error('User lookup error:', userError);
//       return res.status(400).json({ error: 'User not found' });
//     }

//     const user_id = user.user_id;

//     // Check if the listing exists
//     const { data: listing, error: listingError } = await supabase
//       .from('listings')
//       .select('listing_id')
//       .eq('listing_id', listing_id)
//       .single();

//     if (listingError || !listing) {
//       console.error('Listing lookup error:', listingError);
//       return res.status(404).json({ error: 'Listing not found' });
//     }

//     // Add to favorites
//     const { error: favoriteError } = await supabase
//       .from('favorites')
//       .insert({ user_id, listing_id });

//     if (favoriteError) {
//       if (favoriteError.code === '23505') { // Unique constraint violation (already favorited)
//         return res.status(400).json({ error: 'Listing already favorited' });
//       }
//       console.error('Favorite error:', favoriteError);
//       return res.status(500).json({ error: favoriteError.message });
//     }

//     res.status(201).json({ message: 'Listing marked as favorite' });
//   } catch (err) {
//     console.error('Error marking favorite:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
router.post('/favorites', async (req, res) => {
  const { listing_id, user_id: firebase_uid } = req.body;

  try {
    if (!listing_id || !firebase_uid) {
      return res.status(400).json({ error: 'Missing required fields: listing_id and user_id' });
    }

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.uid !== firebase_uid) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return res.status(400).json({ error: 'User not found' });
    }

    const user_id = user.user_id;

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('listing_id')
      .eq('listing_id', listing_id)
      .single();

    if (listingError || !listing) {
      console.error('Listing lookup error:', listingError);
      return res.status(404).json({ error: 'Listing not found' });
    }

    const { error: favoriteError } = await supabase
      .from('favorites')
      .insert({ user_id, firebase_uid, listing_id });

    if (favoriteError) {
      if (favoriteError.code === '23505') {
        return res.status(400).json({ error: 'Listing already favorited' });
      }
      console.error('Favorite error:', favoriteError);
      return res.status(500).json({ error: favoriteError.message });
    }

    res.status(201).json({ message: 'Listing marked as favorite' });
  } catch (err) {
    console.error('Error marking favorite:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// DELETE /favorites/:listing_id - Remove a listing from favorites
router.delete('/favorites/:listing_id', async (req, res) => {
  const { listing_id } = req.params;
  const { user_id: firebase_uid } = req.body;

  try {
    if (!listing_id || !firebase_uid) {
      return res.status(400).json({ error: 'Missing required fields: listing_id and user_id' });
    }

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.uid !== firebase_uid) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    const { error: deleteError, count } = await supabase
      .from('favorites')
      .delete()
      .eq('firebase_uid', firebase_uid)
      .eq('listing_id', listing_id);

    if (deleteError) {
      console.error('Delete favorite error:', deleteError);
      return res.status(500).json({ error: deleteError.message });
    }

    if (count === 0) {
      return res.status(404).json({ error: 'Listing not found in favorites' });
    }

    res.json({ message: 'Listing removed from favorites' });
  } catch (err) {
    console.error('Error removing favorite:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test route to verify router is mounted
router.get('/test', (req, res) => {
  console.log('Listings test route hit');
  res.json({ message: 'Listings router is working' });
});

// Get approved listings (public)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      listing_id,
      type,
      title,
      description,
      address,
      city,
      state,
      zip_code,
      status,
      media:media(url, caption),
      event_details:event_details(start_date_time, is_free),
      temple_details:temple_details(deity, denomination),
      vendor_details:vendor_details(business_type)
    `)
    .eq('status', 'approved')
    .limit(6);
  if (error) {
    console.error('Error fetching listings:', error);
    return res.status(500).json({ error: error.message, data: [] });
  }
  console.log('Listings:', data); // Debug
  res.json(data || []);
});



// POST /notifications/opt-in - Opt-in to notifications for a listing
router.post('/notifications/opt-in', async (req, res) => {
  const { listing_id, user_id: firebase_uid } = req.body;

  try {
    if (!listing_id || !firebase_uid) {
      return res.status(400).json({ error: 'Missing required fields: listing_id and user_id' });
    }

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.uid !== firebase_uid) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return res.status(400).json({ error: 'User not found' });
    }

    const user_id = user.user_id;

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('listing_id')
      .eq('listing_id', listing_id)
      .single();

    if (listingError || !listing) {
      console.error('Listing lookup error:', listingError);
      return res.status(404).json({ error: 'Listing not found' });
    }

    const { error: optInError } = await supabase
      .from('notification_preferences')
      .upsert({ user_id, listing_id, opted_in: true }, { onConflict: ['user_id', 'listing_id'] });

    if (optInError) {
      console.error('Opt-in error:', optInError);
      return res.status(500).json({ error: optInError.message });
    }

    res.json({ message: 'Opted in to notifications for this listing' });
  } catch (err) {
    console.error('Error opting in to notifications:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /notifications/opt-out - Opt-out of notifications for a listing
router.post('/notifications/opt-out', async (req, res) => {
  const { listing_id, user_id: firebase_uid } = req.body;

  try {
    if (!listing_id || !firebase_uid) {
      return res.status(400).json({ error: 'Missing required fields: listing_id and user_id' });
    }

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.uid !== firebase_uid) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return res.status(400).json({ error: 'User not found' });
    }

    const user_id = user.user_id;

    const { error: optOutError } = await supabase
      .from('notification_preferences')
      .delete()
      .eq('user_id', user_id)
      .eq('listing_id', listing_id);

    if (optOutError) {
      console.error('Opt-out error:', optOutError);
      return res.status(500).json({ error: optOutError.message });
    }

    res.json({ message: 'Opted out of notifications for this listing' });
  } catch (err) {
    console.error('Error opting out of notifications:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /listings/:id - Update a listing
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    type,
    title,
    description,
    address,
    city,
    state,
    zip_code,
    contact_email,
    contact_phone,
    website_url,
    media,
    user_id: firebase_uid,
    event,
    temple,
    vendor,
    activity,
    category_id,
    vendor_ids,
    activity_ids,
  } = req.body;

  try {
    if (!type || !title || !address || !city || !state || !firebase_uid) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.uid !== firebase_uid) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    // Fetch the listing to verify ownership
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('user_id')
      .eq('listing_id', id)
      .single();

    if (listingError || !listing) {
      console.error('Listing error:', listingError);
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Look up user to check if they are admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, is_admin')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return res.status(400).json({ error: 'User not found' });
    }

    const user_id = user.user_id;
    const isAdmin = user.is_admin;

    // Check if the user is the owner or an admin
    if (listing.user_id !== user_id && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to edit this listing' });
    }

    // Update listing
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        type,
        title,
        description,
        address,
        city,
        state,
        zip_code,
        contact_email,
        contact_phone,
        website_url,
        status: 'pending', // Reset status to pending for re-approval
      })
      .eq('listing_id', id);

    if (updateError) {
      console.error('Update listing error:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    // Update type-specific details
    if (type === 'event' && event) {
      const { error: eventError } = await supabase
        .from('event_details')
        .update({
          start_date_time: event.start_date_time,
          is_free: event.is_free || false
        })
        .eq('listing_id', id);
      if (eventError) {
        console.error('Event details error:', eventError);
        return res.status(500).json({ error: eventError.message });
      }

      // Update event vendors
      await supabase.from('event_vendors').delete().eq('event_id', id);
      if (Array.isArray(vendor_ids) && vendor_ids.length > 0) {
        const vendorIdsAsNumbers = vendor_ids.map(id => Number(id));
        if (vendorIdsAsNumbers.some(id => isNaN(id))) {
          return res.status(400).json({ error: 'Invalid vendor IDs: must be numbers' });
        }

        const { data: vendors, error: vendorCheckError } = await supabase
          .from('listings')
          .select('listing_id')
          .eq('type', 'vendor')
          .in('listing_id', vendorIdsAsNumbers);

        if (vendorCheckError) {
          console.error('Vendor check error:', vendorCheckError);
          return res.status(500).json({ error: vendorCheckError.message });
        }

        const validVendorIds = vendors.map(v => v.listing_id);
        const invalidVendorIds = vendorIdsAsNumbers.filter(id => !validVendorIds.includes(id));
        if (invalidVendorIds.length > 0) {
          return res.status(400).json({ error: `Invalid vendor IDs: ${invalidVendorIds.join(', ')}` });
        }

        const eventVendorEntries = vendorIdsAsNumbers.map(vendor_id => ({
          event_id: Number(id),
          vendor_id,
        }));
        const { error: eventVendorError } = await supabase
          .from('event_vendors')
          .insert(eventVendorEntries);

        if (eventVendorError) {
          console.error('Event vendors error:', eventVendorError);
          return res.status(500).json({ error: eventVendorError.message });
        }
      }
    } else if (type === 'temple' && temple) {
      const { error: templeError } = await supabase
        .from('temple_details')
        .update({
          deity: temple.deity,
          denomination: temple.denomination
        })
        .eq('listing_id', id);
      if (templeError) {
        console.error('Temple details error:', templeError);
        return res.status(500).json({ error: templeError.message });
      }

      // Update temple activities
      await supabase.from('temple_activities').delete().eq('temple_id', id);
      if (Array.isArray(activity_ids) && activity_ids.length > 0) {
        const activityIdsAsNumbers = activity_ids.map(id => Number(id));
        if (activityIdsAsNumbers.some(id => isNaN(id))) {
          return res.status(400).json({ error: 'Invalid activity IDs: must be numbers' });
        }

        const { data: activities, error: activityCheckError } = await supabase
          .from('listings')
          .select('listing_id')
          .eq('type', 'activity')
          .in('listing_id', activityIdsAsNumbers);

        if (activityCheckError) {
          console.error('Activity check error:', activityCheckError);
          return res.status(500).json({ error: activityCheckError.message });
        }

        const validActivityIds = activities.map(a => a.listing_id);
        const invalidActivityIds = activityIdsAsNumbers.filter(id => !validActivityIds.includes(id));
        if (invalidActivityIds.length > 0) {
          return res.status(400).json({ error: `Invalid activity IDs: ${invalidActivityIds.join(', ')}` });
        }

        const templeActivityEntries = activityIdsAsNumbers.map(activity_id => ({
          temple_id: Number(id),
          activity_id,
        }));
        const { error: templeActivityError } = await supabase
          .from('temple_activities')
          .insert(templeActivityEntries);

        if (templeActivityError) {
          console.error('Temple activities error:', templeActivityError);
          return res.status(500).json({ error: templeActivityError.message });
        }
      }
    } else if (type === 'vendor' && vendor) {
      const { error: vendorError } = await supabase
        .from('vendor_details')
        .update({
          business_type: vendor.business_type
        })
        .eq('listing_id', id);
      if (vendorError) {
        console.error('Vendor details error:', vendorError);
        return res.status(500).json({ error: vendorError.message });
      }
    } else if (type === 'activity' && activity) {
      const { error: activityError } = await supabase
        .from('activity_details')
        .update({
          activity_type: activity.activity_type,
          schedule: activity.schedule
        })
        .eq('listing_id', id);
      if (activityError) {
        console.error('Activity details error:', activityError);
        return res.status(500).json({ error: activityError.message });
      }
    }

    // Update media
    await supabase.from('media').delete().eq('listing_id', id);
    if (Array.isArray(media) && media.length > 0) {
      for (const mediaItem of media) {
        if (!mediaItem.url || typeof mediaItem.url !== 'string') {
          return res.status(400).json({ error: 'Invalid media URL' });
        }
        const { error: mediaError } = await supabase
          .from('media')
          .insert({
            listing_id: Number(id),
            media_type: 'image',
            url: mediaItem.url,
            caption: mediaItem.caption || null
          });
        if (mediaError) {
          console.error('Media error:', mediaError);
          return res.status(500).json({ error: mediaError.message });
        }
      }
    }

    // Update category association
    await supabase.from('listing_categories').delete().eq('listing_id', id);
    if (category_id) {
      const { error: categoryError } = await supabase
        .from('listing_categories')
        .insert({ listing_id: Number(id), category_id });
      if (categoryError) {
        console.error('Category error:', categoryError);
        return res.status(500).json({ error: categoryError.message });
      }
    }

    res.json({ message: 'Listing updated successfully' });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
