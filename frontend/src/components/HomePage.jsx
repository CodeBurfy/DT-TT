// src/HomePage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const HomePage = () => {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [couponError, setCouponError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useState({
    search: '',
    type: '',
    category: '',
    date: '',
  });
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPendingCoupons, setHasPendingCoupons] = useState(false);
  const [showSignOutMenu, setShowSignOutMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [actionError, setActionError] = useState(null);
  const limit = 6;

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const checkProfileStatus = async () => {
    if (!user) {
      console.log('No user authenticated, skipping profile check.');
      return;
    }
    try {
      const idToken = await user.getIdToken();
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const { is_admin, profile_complete } = response.data;
      console.log('User profile:', { is_admin, profile_complete });
      setIsAdmin(is_admin || false);
      if (!profile_complete) {
        navigate('/user-onboarding');
      }
    } catch (err) {
      console.error('Error checking profile status:', err);
      setError('Failed to check profile status.');
      setIsAdmin(false);
    }
  };

  const checkPendingCoupons = async () => {
    if (!user) {
      console.log('No user authenticated, skipping pending coupons check.');
      setHasPendingCoupons(false);
      return;
    }
    try {
      const idToken = await user.getIdToken();
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/coupons/has-pending`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      console.log('Pending coupons response:', response.data);
      setHasPendingCoupons(response.data.hasPending || false);
    } catch (err) {
      console.error('Error checking pending coupons:', err);
      setHasPendingCoupons(false);
    }
  };

  const fetchFavorites = async (currentUser) => {
    if (!currentUser) {
      setFavorites([]);
      localStorage.removeItem('favorites');
      return;
    }
    try {
      const token = await currentUser.getIdToken();
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/fetchfavorites`, {
        params: { user_id: currentUser.uid },
        headers: { Authorization: `Bearer ${token}` },
      });
      const favoriteIds = response.data.map((listing) => listing.listing_id);
      setFavorites(favoriteIds);
      localStorage.setItem('favorites', JSON.stringify(favoriteIds));
    } catch (err) {
      console.error('Error fetching favorites:', err);
      setActionError(err.response?.data?.error || 'Failed to load favorites.');
    }
  };

  const handleFavoriteToggle = async (listingId) => {
    if (!user) {
      setActionError('Please log in to favorite a listing.');
      return;
    }
    setActionError(null);
    try {
      const idToken = await user.getIdToken();
      if (favorites.includes(listingId)) {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/listings/favorites/${listingId}`, {
          data: { user_id: user.uid },
          headers: { Authorization: `Bearer ${idToken}` },
        });
        setFavorites((prev) => {
          const newFavorites = prev.filter((id) => id !== listingId);
          localStorage.setItem('favorites', JSON.stringify(newFavorites));
          return newFavorites;
        });
      } else {
        await axios.post(
          `${import.meta.env.VITE_API_URL}/api/listings/favorites`,
          { listing_id: listingId, user_id: user.uid },
          { headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' } }
        );
        setFavorites((prev) => {
          const newFavorites = [...prev, listingId];
          localStorage.setItem('favorites', JSON.stringify(newFavorites));
          return newFavorites;
        });
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setActionError(err.response?.data?.error || 'Failed to update favorite status.');
      await fetchFavorites(user);
    }
  };

  const fetchCoupons = async (search = '') => {
    try {
      const params = search ? { location: search } : {};
      console.log('Fetching coupons with params:', params);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/coupons/approved`, {
        params,
      });
      console.log('Fetched approved coupons:', response.data);
      setCoupons(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching coupons:', err);
      setCouponError('Failed to load coupons.');
      setCoupons([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/categories`);
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    }
  };

  const fetchListings = async (pageNum, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pageNum,
        limit,
        type: searchParams.type || undefined,
        category: searchParams.category || undefined,
        location: searchParams.search || undefined,
        date: searchParams.date || undefined,
      };
      console.log('Fetching listings with params:', params);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/search`, {
        params,
      });
      console.log('Listings response:', {
        status: response.status,
        data: response.data,
        count: Array.isArray(response.data) ? response.data.length : 0,
      });
      const newListings = Array.isArray(response.data) ? response.data : [];
      setListings((prev) => (append ? [...prev, ...newListings] : newListings));
      setHasMore(newListings.length === limit);
    } catch (err) {
      console.error('Error fetching listings:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      setError('Failed to load listings. Please try again.');
      if (!append) setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
    fetchListings(1, false);
    fetchCategories();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchListings(1, false);
    fetchCoupons(searchParams.search);
  };

  const handleClearSearch = () => {
    setSearchParams({
      search: '',
      type: '',
      category: '',
      date: '',
    });
    setPage(1);
    fetchListings(1, false);
    fetchCoupons();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleViewMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchListings(nextPage, true);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed:', currentUser?.uid);
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        await checkProfileStatus();
        await fetchFavorites(currentUser);
      } else {
        setIsAdmin(false);
        setHasPendingCoupons(false);
        setFavorites([]);
        localStorage.removeItem('favorites');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      checkPendingCoupons();
    }
  }, [user]);

  useEffect(() => {
    if (user && location.pathname === '/' && location.state?.couponSubmitted) {
      console.log('Coupon submitted, re-checking pending coupons');
      checkPendingCoupons();
    }
  }, [location, user]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setUser(result.user);
        const idToken = await result.user.getIdToken();
        await axios.post(
          `${import.meta.env.VITE_API_URL}/api/listings/users/insert`,
          {
            firebase_uid: result.user.uid,
            email: result.user.email,
          },
          {
            headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          }
        );
        await checkProfileStatus();
        await checkPendingCoupons();
        await fetchFavorites(result.user);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setShowSignOutMenu(false);
      setUser(null);
      setIsAdmin(false);
      setHasPendingCoupons(false);
      setFavorites([]);
      localStorage.removeItem('favorites');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleMenuToggle = () => {
    if (!showSignOutMenu && user) {
      console.log('Opening menu, checking pending coupons');
      checkPendingCoupons();
    }
    setShowSignOutMenu((prev) => {
      console.log('Toggling showSignOutMenu to:', !prev);
      return !prev;
    });
  };

  const fallbackImage = 'https://picsum.photos/300/300?random=1';
  const username = user?.displayName || user?.email?.split('@')[0] || 'User';

  console.log('Menu condition:', { isAdmin, hasPendingCoupons, showSignOutMenu });

  if (authLoading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-indigo-600">
            YourApp
          </Link>
          <nav className="flex items-center space-x-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={handleMenuToggle}
                  className="flex items-center space-x-2 text-gray-700 hover:text-indigo-600 transition-colors"
                  aria-expanded={showSignOutMenu}
                  aria-label="User menu"
                >
                  <span>{username}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSignOutMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg z-10">
                    <Link
                      to="/add-listing"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowSignOutMenu(false)}
                    >
                      Add Listing
                    </Link>
                    <Link
                      to="/favorites"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowSignOutMenu(false)}
                    >
                      My Favorites
                    </Link>
                    {(isAdmin || hasPendingCoupons) && (
                      <Link
                        to="/admin/dashboard"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setShowSignOutMenu(false)}
                      >
                        Admin Dashboard
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex space-x-3">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-indigo-600 transition-colors"
                >
                  Sign In
                </Link>
                <button
                  onClick={handleGoogleLogin}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Sign In with Google
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <section
        className="relative bg-cover bg-center h-[600px] flex items-center justify-center text-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80')`,
        }}
      >
        <div className="absolute inset-0 bg-gray-900 opacity-60"></div>
        <div className="relative z-10 text-white">
          <h1 className="text-5xl font-bold mb-4 tracking-tight">
            Discover Indian Events, Temples, and Vendors
          </h1>
          <p className="text-xl mb-6">Find cultural experiences and promotions near you!</p>
        </div>
      </section>

      <section className="container mx-auto px-4 -mt-20 relative z-10">
        <form
          onSubmit={handleSearch}
          className="bg-white shadow-md rounded-lg p-6 flex flex-wrap gap-4 items-center justify-center"
        >
          <div className="w-full md:w-1/4">
            <input
              type="text"
              name="search"
              value={searchParams.search}
              onChange={handleInputChange}
              placeholder="Search by location (e.g., MD or Maryland)"
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="w-full md:w-1/5">
            <select
              name="type"
              value={searchParams.type}
              onChange={handleInputChange}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">All Types</option>
              <option value="event">Event</option>
              <option value="vendor">Vendor</option>
              <option value="temple">Temple</option>
              <option value="activity">Activity</option>
            </select>
          </div>
          <div className="w-full md:w-1/5">
            <select
              name="category"
              value={searchParams.category}
              onChange={handleInputChange}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.category_id || Math.random()} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-1/5">
            <input
              type="date"
              name="date"
              value={searchParams.date}
              onChange={handleInputChange}
              disabled={searchParams.type && searchParams.type !== 'event'}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="bg-indigo-600 text-white font-semibold py-3 px-6 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleClearSearch}
              className="bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-md hover:bg-gray-400 transition-colors"
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      <section className="container mx-auto px-4 py-6">
        {authError && <p className="text-red-500 text-center mb-4">{authError}</p>}
        {actionError && <p className="text-red-500 text-center mb-4">{actionError}</p>}
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {couponError && <p className="text-red-500 text-center mb-4">{couponError}</p>}
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">Available Coupons</h2>
        {coupons.length === 0 && !couponError ? (
          <p className="text-gray-600 text-center">
            {searchParams.search ? `No coupons found for "${searchParams.search}".` : 'No approved coupons available.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coupons.map((coupon) => (
              <div
                key={coupon.coupon_id}
                className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow duration-300"
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{coupon.code}</h3>
                <p className="text-gray-600 text-sm mb-2">{coupon.description || 'No description'}</p>
                <p className="text-gray-500 text-sm">
                  Discount:{' '}
                  {coupon.discount_type === 'percentage'
                    ? `${coupon.discount_value}% off`
                    : `$${coupon.discount_value} off`}
                </p>
                <p className="text-gray-500 text-sm">Location: {coupon.location || 'N/A'}</p>
                <p className="text-gray-500 text-sm">
                  Valid Until: {new Date(coupon.expiry_date).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">Featured Listings</h2>
        {loading && page === 1 && <p className="text-gray-600 text-center">Loading...</p>}
        {!loading && !error && listings.length === 0 && (
          <p className="text-gray-600 text-center">
            {searchParams.search ? `No listings found for "${searchParams.search}".` : 'No listings found.'}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.isArray(listings) &&
            listings.map((listing) => (
              <div
                key={listing.listing_id || Math.random()}
                className="relative bg-white shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300"
              >
                <Link to={`/listing/${listing.listing_id}`} className="block">
                  <div className="relative h-48">
                    {Array.isArray(listing.media) && listing.media.length > 0 && listing.media[0]?.url ? (
                      <img
                        src={listing.media[0].url}
                        alt={listing.media[0].caption || 'Listing image'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          console.log(`Image failed to load for listing ${listing.listing_id}`);
                          e.target.src = fallbackImage;
                        }}
                      />
                    ) : (
                      <img
                        src={fallbackImage}
                        alt="Fallback image"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">{listing.title || 'Untitled'}</h3>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {listing.description?.substring(0, 100) + '...' || 'No description'}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {listing.city && listing.state ? `${listing.city}, ${listing.state}` : 'No location'}
                    </p>
                    {listing.event_details?.start_date_time && (
                      <p className="text-gray-500 text-sm mt-1">
                        Event: {new Date(listing.event_details.start_date_time).toLocaleDateString()}
                      </p>
                    )}
                    {listing.temple_details?.deity && (
                      <p className="text-gray-500 text-sm mt-1">Deity: {listing.temple_details.deity}</p>
                    )}
                    {listing.vendor_details?.business_type && (
                      <p className="text-gray-500 text-sm mt-1">
                        Type: {listing.vendor_details.business_type}
                      </p>
                    )}
                    {listing.activity_details?.activity_type && (
                      <p className="text-gray-500 text-sm mt-1">
                        Activity Type: {listing.activity_details.activity_type}
                      </p>
                    )}
                    {listing.activity_details?.schedule && (
                      <p className="text-gray-500 text-sm mt-1">
                        Schedule: {listing.activity_details.schedule}
                      </p>
                    )}
                    {listing.type === 'event' && Array.isArray(listing.vendors) && listing.vendors.length > 0 && (
                      <p className="text-gray-500 text-sm mt-1">
                        Vendors: {listing.vendors.map((v) => v.title).join(', ')}
                      </p>
                    )}
                    {listing.type === 'temple' && Array.isArray(listing.activities) && listing.activities.length > 0 && (
                      <p className="text-gray-500 text-sm mt-1">
                        Activities: {listing.activities.map((a) => a.title).join(', ')}
                      </p>
                    )}
                    <p className="text-gray-500 text-sm mt-1">
                      Category: {listing.categories?.map((c) => c.name).join(', ') || 'None'}
                    </p>
                  </div>
                </Link>
                {user && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleFavoriteToggle(listing.listing_id);
                    }}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                    aria-label={favorites.includes(listing.listing_id) ? 'Unfavorite listing' : 'Favorite listing'}
                  >
                    <svg
                      className={`w-6 h-6 ${favorites.includes(listing.listing_id) ? 'fill-red-500 stroke-red-500' : 'fill-none stroke-gray-500'} stroke-2`}
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
        </div>
        {hasMore && (
          <div className="text-center mt-10">
            <button
              onClick={handleViewMore}
              className="bg-indigo-600 text-white font-semibold py-3 px-6 rounded-md hover:bg-indigo-700 transition-colors"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'View More Listings'}
            </button>
          </div>
        )}
      </section>

      <footer className="bg-indigo-800 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p>© {new Date().getFullYear()} YourApp. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <Link to="/about" className="hover:underline">About</Link>
            <Link to="/contact" className="hover:underline">Contact</Link>
            <Link to="/terms" className="hover:underline">Terms</Link>
            <Link to="/privacy" className="hover:underline">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;