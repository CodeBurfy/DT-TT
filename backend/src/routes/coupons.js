// const express = require('express');
// const router = express.Router();
// const { body, validationResult }= require("express-validator");
// const supabase = require('../supabaseClient');
// const admin = require('../config/firebaseAdmin');
// const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// // Add router-level logging
// router.use((req, res, next) => {
//   console.log(`Coupon router handling: ${req.method} ${req.url}`);
//   next();
// });

// // POST / - Create a new coupon
// router.post(
//   "/",
//   authMiddleware,
//   [
//     body("code")
//       .isString()
//       .notEmpty()
//       .trim()
//       .isLength({ max: 50 })
//       .withMessage("Coupon code is required and must be 50 characters or less"),
//     body("description")
//       .optional()
//       .isString()
//       .trim()
//       .withMessage("Description must be a string"),
//     body("discount_type")
//       .isIn(["percentage", "fixed"])
//       .withMessage("Discount type must be 'percentage' or 'fixed'"),
//     body("discount_value")
//       .isFloat({ min: 0 })
//       .withMessage("Discount value must be a positive number"),
//     body("min_purchase_amount")
//       .optional()
//       .isFloat({ min: 0 })
//       .withMessage("Minimum purchase amount must be a positive number"),
//     body("max_usage")
//       .optional()
//       .isInt({ min: 1 })
//       .withMessage("Max usage must be a positive integer"),
//     body("start_date")
//       .isISO8601()
//       .withMessage("Start date must be a valid ISO 8601 date"),
//     body("expiry_date")
//       .isISO8601()
//       .withMessage("Expiry date must be a valid ISO 8601 date"),
//     body("location")
//       .optional()
//       .isString()
//       .trim()
//       .withMessage("Location must be a string"),
//     body("listing_id")
//       .optional()
//       .isInt()
//       .withMessage("Listing ID must be an integer"),
//     body("user_id")
//       .isString()
//       .notEmpty()
//       .withMessage("User ID is required"),
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }

//     const {
//       code,
//       description,
//       discount_type,
//       discount_value,
//       min_purchase_amount,
//       max_usage,
//       start_date,
//       expiry_date,
//       location,
//       listing_id,
//       user_id: firebase_uid,
//     } = req.body;

//     try {
//       // Verify Firebase token
//       const token = req.headers.authorization?.split("Bearer ")[1];
//       if (!token) {
//         return res.status(401).json({ error: "No token provided" });
//       }
//       const decodedToken = await admin.auth().verifyIdToken(token);
//       if (decodedToken.uid !== firebase_uid) {
//         return res.status(401).json({ error: "Unauthorized user" });
//       }

//       // Fetch Supabase user
//       const { data: user, error: userError } = await supabase
//         .from("users")
//         .select("user_id")
//         .eq("firebase_uid", firebase_uid)
//         .single();

//       if (userError || !user) {
//         console.error("User lookup error:", userError);
//         return res.status(400).json({ error: "User not found" });
//       }

//       // Validate listing_id if provided
//       if (listing_id) {
//         const { data: listing, error: listingError } = await supabase
//           .from("listings")
//           .select("listing_id")
//           .eq("listing_id", listing_id)
//           .single();

//         if (listingError || !listing) {
//           console.error("Listing lookup error:", listingError);
//           return res.status(400).json({ error: "Listing not found" });
//         }
//       }

//       // Insert coupon
//       const couponData = {
//         code,
//         user_id: user.user_id,
//         discount_type,
//         discount_value,
//         start_date,
//         expiry_date,
//         status: "pending", // Default per schema
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString(),
//       };

//       // Add optional fields if provided
//       if (description) couponData.description = description;
//       if (min_purchase_amount) couponData.min_purchase_amount = min_purchase_amount;
//       if (max_usage) couponData.max_usage = max_usage;
//       if (location) couponData.location = location;
//       if (listing_id) couponData.listing_id = listing_id;

//       const { data, error } = await supabase
//         .from("coupons")
//         .insert(couponData)
//         .select("coupon_id")
//         .single();

//       if (error) {
//         if (error.code === "23505") {
//           return res.status(400).json({ error: "Coupon code already exists" });
//         }
//         console.error("Coupon creation error:", error);
//         return res.status(500).json({ error: error.message });
//       }

//       res.status(201).json({ message: "Coupon created", coupon_id: data.coupon_id });
//     } catch (err) {
//       console.error("Server error:", err);
//       res.status(500).json({ error: "Internal server error" });
//     }
//   }
// );

// // GET / - Fetch approved coupons (unchanged)
// router.get("/", async (req, res) => {
//   const { location } = req.query;

//   try {
//     let query = supabase
//       .from("coupons")
//       .select(`
//         coupon_id,
//         code,
//         description,
//         discount_type,
//         discount_value,
//         min_purchase_amount,
//         max_usage,
//         usage_count,
//         start_date,
//         expiry_date,
//         status,
//         location,
//         listing_id,
//         user_id,
//         created_at,
//         updated_at
//       `)
//       .eq("status", "approved")
//       .gte("expiry_date", new Date().toISOString())
//       .order("created_at", { ascending: false });

//     if (location) {
//       query = query.ilike("location", `%${location}%`);
//     }

//     const { data, error } = await query;

//     if (error) {
//       console.error("Error fetching coupons:", error);
//       return res.status(500).json({ error: "Failed to fetch coupons" });
//     }

//     res.json(data || []);
//   } catch (err) {
//     console.error("Server error:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// // New endpoint: Check for pending coupons
// router.get('/has-pending', authMiddleware, async (req, res) => {
//   try {
//     const firebaseUid = req.user.uid; // From authMiddleware
//     console.log('Checking pending coupons for firebase_uid:', firebaseUid);

//     const { count, error } = await supabase
//       .from('coupons')
//       .select('*', { count: 'exact', head: true })
//       .eq('status', 'pending')
//       .eq('firebase_uid', firebaseUid);

//     if (error) {
//       console.error('Supabase error:', error);
//       return res.status(500).json({ error: 'Failed to check pending coupons.' });
//     }

//     res.json({ hasPending: count > 0 });
//   } catch (err) {
//     console.error('Unexpected error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });
// module.exports = router;
// backend/src/routes/coupons.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../supabaseClient');


router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      code,
      user_id: firebaseUid,
      discount_type: rawDiscountType,
      discount_value,
      start_date,
      expiry_date,
      location,
      description,
    } = req.body;

    const discountTypeMap = {
      fixed_amount: 'fixed',
      percentage: 'percentage',
      fixed: 'fixed',
    };
    const discount_type = discountTypeMap[rawDiscountType?.toLowerCase()];
    if (!discount_type) {
      return res.status(400).json({ error: 'Invalid discount_type. Use "percentage" or "fixed".' });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user UUID:', userError);
      return res.status(400).json({ error: 'User not found.' });
    }

    const { data, error } = await supabase
      .from('coupons')
      .insert([
        {
          code,
          user_id: userData.user_id,
          firebase_uid: firebaseUid,
          discount_type,
          discount_value,
          start_date,
          expiry_date,
          location,
          description,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/has-pending', authMiddleware, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    console.log('Checking pending coupons for firebase_uid:', firebaseUid);

    const { data, count, error } = await supabase
      .from('coupons')
      .select(
        `
        coupon_id,
        code,
        discount_type,
        discount_value,
        start_date,
        expiry_date,
        location,
        description,
        status
      `,
        { count: 'exact' }
      )
      .eq('status', 'pending')
      .eq('firebase_uid', firebaseUid);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to check pending coupons.' });
    }

    res.json({
      hasPending: (count || 0) > 0,
      pendingCoupons: data || [],
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const firebaseUid = req.user.uid;
    console.log('Fetching pending coupons for firebase_uid:', firebaseUid);

    const { data, error } = await supabase
      .from('coupons')
      .select(`
        coupon_id,
        code,
        discount_type,
        discount_value,
        start_date,
        expiry_date,
        location,
        description,
        status
      `)
      .eq('status', 'pending')
      .eq('firebase_uid', firebaseUid);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch pending coupons.' });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const stateMap = {
  'alabama': 'AL',
  'alaska': 'AK',
  'arizona': 'AZ',
  'arkansas': 'AR',
  'california': 'CA',
  'colorado': 'CO',
  'connecticut': 'CT',
  'delaware': 'DE',
  'florida': 'FL',
  'georgia': 'GA',
  'hawaii': 'HI',
  'idaho': 'ID',
  'illinois': 'IL',
  'indiana': 'IN',
  'iowa': 'IA',
  'kansas': 'KS',
  'kentucky': 'KY',
  'louisiana': 'LA',
  'maine': 'ME',
  'maryland': 'MD',
  'massachusetts': 'MA',
  'michigan': 'MI',
  'minnesota': 'MN',
  'mississippi': 'MS',
  'missouri': 'MO',
  'montana': 'MT',
  'nebraska': 'NE',
  'nevada': 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  'ohio': 'OH',
  'oklahoma': 'OK',
  'oregon': 'OR',
  'pennsylvania': 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  'tennessee': 'TN',
  'texas': 'TX',
  'utah': 'UT',
  'vermont': 'VT',
  'virginia': 'VA',
  'washington': 'WA',
  'west virginia': 'WV',
  'wisconsin': 'WI',
  'wyoming': 'WY'
  }
router.get('/approved', async (req, res) => {
  try {
    const { location } = req.query;
    console.log('Fetching approved coupons', { location });

    let query = supabase
      .from('coupons')
      .select(`
        coupon_id,
        code,
        discount_type,
        discount_value,
        start_date,
        expiry_date,
        location,
        description,
        status
      `)
      .eq('status', 'approved');

    if (location) {
      const searchTerm = location.toLowerCase();
      const fullState = stateMap[searchTerm] || searchTerm;
      query = query.ilike('location', `%${fullState}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch approved coupons.' });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const firebaseUid = req.user.uid;

    const { data: coupon, error: fetchError } = await supabase
      .from('coupons')
      .select('firebase_uid')
      .eq('coupon_id', id)
      .single();

    if (fetchError || !coupon) {
      console.error('Error fetching coupon:', fetchError);
      return res.status(404).json({ error: 'Coupon not found.' });
    }

    if (coupon.firebase_uid !== firebaseUid) {
      return res.status(403).json({ error: 'Unauthorized action.' });
    }

    const { data, error } = await supabase
      .from('coupons')
      .update({ status: 'approved' })
      .eq('coupon_id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to approve coupon.' });
    }

    res.json(data);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const firebaseUid = req.user.uid;

    const { data: coupon, error: fetchError } = await supabase
      .from('coupons')
      .select('firebase_uid')
      .eq('coupon_id', id)
      .single();

    if (fetchError || !coupon) {
      console.error('Error fetching coupon:', fetchError);
      return res.status(404).json({ error: 'Coupon not found.' });
    }

    if (coupon.firebase_uid !== firebaseUid) {
      return res.status(403).json({ error: 'Unauthorized action.' });
    }

    const { data, error } = await supabase
      .from('coupons')
      .update({ status: 'rejected' })
      .eq('coupon_id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to reject coupon.' });
    }

    res.json(data);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;