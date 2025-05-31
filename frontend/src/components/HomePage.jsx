import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';
import { Link, useNavigate } from 'react-router-dom';

const HomePage = () => {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [couponSearchLocation, setCouponSearchLocation] = useState('');
  const [couponError, setCouponError] = useState(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    type: '',
    category: '',
    location: '',
    date: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/users/check`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setIsAdmin(response.data.user?.is_admin || false);
      if (!response.data.profileComplete) {
        navigate('/user-onboarding');
      }
    } catch (err) {
      console.error('Error checking profile status:', err);
      setError(err.response?.data?.error || 'Failed to check profile status.');
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
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/listings/fetchfavorites`;
      const response = await axios.get(apiUrl, {
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

  const fetchCoupons = async (location = '') => {
    try {
      const params = location ? { location } : {};
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/coupons`, { params });
      setCoupons(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching coupons:', err);
      setCouponError(err.response?.data?.error || 'Failed to load coupons.');
      setCoupons([]);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCouponSearch = (e) => {
    e.preventDefault();
    fetchCoupons(couponSearchLocation);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await checkProfileStatus();
        await fetchFavorites(currentUser);
      } else {
        setIsAdmin(false);
        setFavorites([]);
        localStorage.removeItem('favorites');
      }
    });
    return () => unsubscribe();
  }, []);

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
      setFavorites([]);
      localStorage.removeItem('favorites');
    } catch (err) {
      setAuthError(err.message);
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
        location: searchParams.location || undefined,
        date: searchParams.date || undefined,
      };
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/search`, { params });
      const newListings = Array.isArray(response.data) ? response.data : [];
      setListings((prev) => (append ? [...prev, ...newListings] : newListings));
      setHasMore(newListings.length === limit);
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError('Failed to load listings.');
      if (!append) setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchListings(1, false);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchListings(1, false);
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

  const fallbackImage = 'https://picsum.photos/300/300?random=1';
  const username = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-indigo-600">
            YourApp
          </Link>
          <nav className="flex items-center space-x-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowSignOutMenu(!showSignOutMenu)}
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
                    {isAdmin && (
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

      {/* Hero Section */}
      <section
        className="relative bg-cover bg-center h-[600px] flex items-center justify-center text-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80')`,
        }}
      >
        <div className="absolute inset-0 bg-black opacity-60"></div>
        <div className="relative z-10 text-white">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
            Discover Indian Events, Temples, and Vendors
          </h1>
          <p className="text-xl md:text-2xl mb-8">
            Find cultural experiences near you!
          </p>
        </div>
      </section>

      {/* Search Form */}
      <section className="container mx-auto px-4 -mt-16 relative z-10">
        <form
          onSubmit={handleSearch}
          className="bg-white shadow-lg rounded-lg p-6 flex flex-col md:flex-row gap-4 items-center justify-center"
        >
          <div className="w-full md:w-1/5">
            <select
              name="type"
              value={searchParams.type}
              onChange={handleInputChange}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.category_id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-1/5">
            <input
              type="text"
              name="location"
              value={searchParams.location}
              onChange={handleInputChange}
              placeholder="City or State"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="w-full md:w-1/5">
            <input
              type="date"
              name="date"
              value={searchParams.date}
              onChange={handleInputChange}
              disabled={searchParams.type && searchParams.type !== 'event'}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            className="w-full md:w-auto bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
        </form>
      </section>

      {/* Errors */}
      <section className="container mx-auto px-4 py-6">
        {authError && <p className="text-red-500 mb-4 text-center">{authError}</p>}
        {actionError && <p className="text-red-500 mb-4 text-center">{actionError}</p>}
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
        {couponError && <p className="text-red-500 mb-4 text-center">{couponError}</p>}
      </section>

      {/* Coupons Section */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8 text-gray-800 text-center">Available Coupons</h2>
        <form onSubmit={handleCouponSearch} className="mb-8 flex justify-center gap-4">
          <input
            type="text"
            value={couponSearchLocation}
            onChange={(e) => setCouponSearchLocation(e.target.value)}
            placeholder="Search coupons by location (e.g., New York, NY)"
            className="w-full md:w-1/3 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setCouponSearchLocation('');
              fetchCoupons();
            }}
            className="bg-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Clear
          </button>
        </form>
        {coupons.length === 0 && !couponError && (
          <p className="text-gray-500 text-center">No coupons available.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coupons.map((coupon) => (
            <div
              key={coupon.coupon_id}
              className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow duration-300"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-2">{coupon.code}</h3>
              <p className="text-gray-600 text-sm mb-2">{coupon.description}</p>
              <p className="text-gray-500 text-sm">
                Discount: {coupon.discount_percentage ? `${coupon.discount_percentage}% off` : coupon.discount_amount ? `$${coupon.discount_amount} off` : 'N/A'}
              </p>
              <p className="text-gray-500 text-sm">Location: {coupon.location}</p>
              <p className="text-gray-500 text-sm">
                Valid Until: {new Date(coupon.valid_until).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Listings Section */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8 text-gray-800 text-center">Featured Listings</h2>
        {loading && page === 1 && <p className="text-gray-500 text-center">Loading...</p>}
        {!loading && !error && listings.length === 0 && <p className="text-gray-500 text-center">No listings found</p>}
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
              className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'View More Listings'}
            </button>
          </div>
        )}
      </section>

      {/* Footer */}
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