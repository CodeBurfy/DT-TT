// src/HomePage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';
import { createClient } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const HomePage = () => {
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
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
  const limit = 6; // Listings per page

  // Monitor auth state and check admin status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const { data: userData, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('firebase_uid', currentUser.uid)
          .single();
        setIsAdmin(!error && userData?.is_admin);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/categories`);
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
      console.log('Fetching listings with params:', params);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/search`, {
        params,
      });
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

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setShowSignOutMenu(false);
    } catch (err) {
      setAuthError(err.message);
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
            <Link
              to="/login"
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
      {authError && <p className="text-red-500 mb-4">{authError}</p>}
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
            <div
              key={listing.listing_id || Math.random()}
              className="bg-white shadow-md rounded-lg overflow-hidden"
            >
              {Array.isArray(listing.media) && listing.media[0]?.url ? (
                <img
                  src={listing.media[0].url}
                  alt={listing.media[0].caption || 'Listing image'}
                  className="w-full h-48 object-cover"
                  onError={(e) => (e.target.src = 'https://picsum.photos/300/300?random=1')}
                />
              ) : (
                <img
                  src="https://picsum.photos/300/300?random=1"
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
                <p className="text-gray-500 text-sm mt-1">
                  Category: {listing.categories?.map((c) => c.name).join(', ') || 'None'}
                </p>
              </div>
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

export default HomePage;