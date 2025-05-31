import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { auth } from '../firebaseConfig';

const FavoritesPage = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) {
        navigate('/login');
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/favorites`, {
          params: { user_id: user.uid },
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        });
        setFavorites(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Error fetching favorites:', err);
        setError(err.response?.data?.error || 'Failed to load favorites');
        setFavorites([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [user]);

  const fallbackImage = 'https://picsum.photos/300/300?random=1';

  if (!user) return <p className="text-center">Loading...</p>;
  if (loading) return <p className="text-center">Loading favorites...</p>;
  if (error) return <p className="text-red-500 text-center">{error}</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">My Favorite Listings</h1>
      {favorites.length === 0 ? (
        <p className="text-center">You have no favorite listings.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((listing) => (
            <Link
              to={`/listing/${listing.listing_id}`}
              key={listing.listing_id}
              className="block"
            >
              <div className="bg-white shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                {listing.media?.length > 0 && listing.media[0]?.url ? (
                  <img
                    src={listing.media[0].url}
                    alt={listing.media[0].caption || 'Listing image'}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
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
                      Vendors: {listing.vendors.map(v => v.title).join(', ')}
                    </p>
                  )}
                  {listing.type === 'temple' && Array.isArray(listing.activities) && listing.activities.length > 0 && (
                    <p className="text-gray-500 text-sm mt-1">
                      Activities: {listing.activities.map(a => a.title).join(', ')}
                    </p>
                  )}
                  <p className="text-gray-500 text-sm mt-1">
                    Category: {listing.categories?.map((c) => c.name).join(', ') || 'None'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Link
        to="/"
        className="mt-6 inline-block text-blue-500 hover:underline"
      >
        Back to Home
      </Link>
    </div>
  );
};

export default FavoritesPage;