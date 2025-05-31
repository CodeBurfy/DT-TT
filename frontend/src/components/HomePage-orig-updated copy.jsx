import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';
import { Link, useNavigate } from 'react-router-dom';

const HomePagecopy = () => {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
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
    // Initialize from localStorage
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [actionError, setActionError] = useState(null);
  const limit = 6;

  // Update localStorage whenever favorites change
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
      console.log('Fetching favorites from:', apiUrl);
      const response = await axios.get(apiUrl, {
        params: { user_id: currentUser.uid },
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Favorites response:', response.data);
      const favoriteIds = response.data.map((listing) => listing.listing_id);
      setFavorites(favoriteIds);
      localStorage.setItem('favorites', JSON.stringify(favoriteIds));
    } catch (err) {
      console.error('Error fetching favorites:', err);
      console.error('Error details:', err.response?.status, err.response?.data);
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
      // Sync with server state
      await fetchFavorites(user);
    }
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
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <div className="bg-blue-600 text-white p-8 rounded-lg text-center">
          <h1 className="text-4xl font-bold mb-4">Discover Indian Events, Temples, and Vendors</h1>
          <p className="text-lg">Find cultural experiences near you!</p>
        </div>
        <div className="relative flex space-x-4 items-center">
          {user ? (
            <div>
              <button
                onClick={() => setShowSignOutMenu(!showSignOutMenu)}
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded flex items-center"
              >
                {username}
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="flex space-x-4">
              <Link
                to="/login"
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Sign In
              </Link>
              <button
                onClick={handleGoogleLogin}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Sign In with Google
              </button>
            </div>
          )}
        </div>
      </div>
      {authError && <p className="text-red-500 mb-4">{authError}</p>}
      {actionError && <p className="text-red-500 mb-4">{actionError}</p>}
      <form onSubmit={handleSearch} className="bg-white shadow-md rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">Type</label>
            <select
              name="type"
              value={searchParams.type}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
            >
              <option value="">All Types</option>
              <option value="event">Event</option>
              <option value="vendor">Vendor</option>
              <option value="temple">Temple</option>
              <option value="activity">Activity</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Category</label>
            <select
              name="category"
              value={searchParams.category}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.category_id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Location</label>
            <input
              type="text"
              name="location"
              value={searchParams.location}
              onChange={handleInputChange}
              placeholder="City or State"
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Date</label>
            <input
              type="date"
              name="date"
              value={searchParams.date}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              disabled={searchParams.type && searchParams.type !== 'event'}
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full md:w-auto"
        >
          Search
        </button>
      </form>
      <h2 className="text-2xl font-bold mb-4">Featured Listings</h2>
      {loading && page === 1 && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && !error && listings.length === 0 && <p>No listings found</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.isArray(listings) &&
          listings.map((listing) => (
            <div key={listing.listing_id || Math.random()} className="relative">
              <Link to={`/listing/${listing.listing_id}`} className="block">
                <div className="bg-white shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {Array.isArray(listing.media) && listing.media.length > 0 && listing.media[0]?.url ? (
                    <img
                      src={listing.media[0].url}
                      alt={listing.media[0].caption || 'Listing image'}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        console.log(`Image failed to load for listing ${listing.listing_id}: ${listing.media[0].url}`);
                        e.target.src = fallbackImage;
                      }}
                    />
                  ) : (
                    <img
                      src={fallbackImage}
                      alt="Fallback image"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="text-xl font-semibold">{listing.title || 'Untitled'}</h3>
                    <p className="text-gray-600 text-sm mt-1">
                      {listing.description?.substring(0, 100) + '...' || 'No description'}
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
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
                </div>
              </Link>
              {user && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleFavoriteToggle(listing.listing_id);
                  }}
                  className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100"
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
        <button
          onClick={handleViewMore}
          className="mt-6 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'View More Listings'}
        </button>
      )}
    </div>
  );
};

export default HomePagecopy;