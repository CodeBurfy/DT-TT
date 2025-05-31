const { getAuth } = require('firebase-admin/auth');
const { admin } = require('../server'); // Import initialized admin
const supabase = require('../supabaseClient');

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decodedToken = await getAuth(admin).verifyIdToken(token); // Verify Firebase token
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, is_admin')
      .eq('firebase_uid', decodedToken.uid)
      .single();

    if (error || !user) {
      // Insert new user if not found
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          firebase_uid: decodedToken.uid,
          email: decodedToken.email,
          first_name: decodedToken.name?.split(' ')[0] || '',
          last_name: decodedToken.name?.split(' ')[1] || '',
          is_admin: false // Set default to non-admin
        })
        .select('user_id, is_admin')
        .single();
      if (insertError) {
        console.error('Error inserting new user:', insertError);
        throw insertError;
      }
      req.user = { ...decodedToken, supabase_user_id: newUser.user_id, is_admin: newUser.is_admin };
    } else {
      req.user = { ...decodedToken, supabase_user_id: user.user_id, is_admin: user.is_admin };
    }
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decodedToken = await getAuth(admin).verifyIdToken(token); // Verify Firebase token
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, is_admin')
      .eq('firebase_uid', decodedToken.uid)
      .single();

    if (error || !user || !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = { ...decodedToken, supabase_user_id: user.user_id, is_admin: user.is_admin };
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(401).json({ error: 'Invalid token or not an admin' });
  }
};

module.exports = { authMiddleware, adminMiddleware };