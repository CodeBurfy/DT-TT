import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { auth } from '../firebaseConfig';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ListingDetailsPage = () => {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isNotified, setIsNotified] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchListingAndCheckPermissions = async () => {
      try {
        // Fetch the listing
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/${id}`);
        const data = response.data;
        if (!data) {
          throw new Error('Listing not found');
        }

        setListing(data);

        // Check favorite and notification status if user is logged in
        if (user) {
          // Check if the listing is favorited
          const { data: favoriteData, error: favoriteError } = await supabase
            .from('favorites')
            .select('listing_id')
            .eq('user_id', (await supabase.from('users').select('user_id').eq('firebase_uid', user.uid).single()).data.user_id)
            .eq('listing_id', id);

          if (favoriteError) {
            console.error('Error checking favorite status:', favoriteError);
          } else {
            setIsFavorite(favoriteData.length > 0);
          }

          // Check if the user has opted into notifications
          const { data: notificationData, error: notificationError } = await supabase
            .from('notification_preferences')
            .select('opted_in')
            .eq('user_id', (await supabase.from('users').select('user_id').eq('firebase_uid', user.uid).single()).data.user_id)
            .eq('listing_id', id);

          if (notificationError) {
            console.error('Error checking notification status:', notificationError);
          } else {
            setIsNotified(notificationData.length > 0 && notificationData[0].opted_in);
          }

          // Check if the user can edit
          const isOwner = data.user_id === user.uid;
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('is_admin')
            .eq('firebase_uid', user.uid)
            .single();

          if (userError) {
            console.error('Error fetching user admin status:', userError);
            setCanEdit(isOwner);
          } else {
            const isAdmin = userData?.is_admin || false;
            setCanEdit(isOwner || isAdmin);
          }
        } else {
          setCanEdit(false);
          setIsFavorite(false);
          setIsNotified(false);
        }
      } catch (err) {
        console.error('Error fetching listing:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load listing');
      } finally {
        setLoading(false);
      }
    };

    fetchListingAndCheckPermissions();
  }, [id, user]);

 const handleFavoriteToggle = async () => {
  if (!user) {
    setActionError('Please log in to favorite a listing.');
    return;
  }
  // Validate that id is a number
    const listingId = parseInt(id, 10);
    if (isNaN(listingId)) {
      setActionError('Invalid listing ID');
      return;
    }
  setActionError(null);
  try {
    if (isFavorite) {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/listings/favorites/${id}`, {
        data: { user_id: user.uid },
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      setIsFavorite(false);
    } else {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/listings/favorites`, {
        listing_id: id,
        user_id: user.uid,
      }, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      setIsFavorite(true);
    }
  } catch (err) {
    console.error('Error toggling favorite:', err);
    setActionError(err.response?.data?.error || 'Failed to update favorite status');
    const { data: favoriteData, error: favoriteError } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('firebase_uid', user.uid)
      .eq('listing_id', id);

    if (favoriteError) {
      console.error('Error checking favorite status:', favoriteError);
    } else {
      setIsFavorite(favoriteData.length > 0);
    }
  }
};

  const handleNotificationToggle = async () => {
    if (!user) {
      setActionError('Please log in to manage notifications.');
      return;
    }

    setActionError(null);
    try {
      if (isNotified) {
        // Opt-out of notifications
        await axios.post(`${import.meta.env.VITE_API_URL}/api/listings/notifications/opt-out`, {
          listing_id: id,
          user_id: user.uid,
        }, {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        });
        setIsNotified(false);
      } else {
        // Opt-in to notifications
        await axios.post(`${import.meta.env.VITE_API_URL}/api/listings/notifications/opt-in`, {
          listing_id: id,
          user_id: user.uid,
        }, {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        });
        setIsNotified(true);
      }
    } catch (err) {
      console.error('Error toggling notifications:', err);
      setActionError(err.response?.data?.error || 'Failed to update notification preferences');
    }
  };

  if (loading) return <p className="text-center">Loading...</p>;
  if (error) return <p className="text-red-500 text-center">{error}</p>;
  if (!listing) return <p className="text-center">Listing not found</p>;

  const fallbackImage = 'https://picsum.photos/300/300?random=1';

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 text-center">{listing.title}</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        {listing.media?.length > 0 && listing.media[0]?.url ? (
          <img
            src={listing.media[0].url}
            alt={listing.media[0].caption || 'Listing image'}
            className="w-full h-64 object-cover rounded mb-4"
            onError={(e) => {
              e.target.src = fallbackImage;
            }}
          />
        ) : (
          <img
            src={fallbackImage}
            alt="Fallback image"
            className="w-full h-64 object-cover rounded mb-4"
          />
        )}
        <p className="text-gray-600 mb-2"><strong>Description:</strong> {listing.description || 'No description'}</p>
        <p className="text-gray-600 mb-2"><strong>Address:</strong> {listing.address}</p>
        <p className="text-gray-600 mb-2"><strong>Location:</strong> {listing.city}, {listing.state} {listing.zip_code}</p>
        <p className="text-gray-600 mb-2"><strong>Contact Email:</strong> {listing.contact_email || 'N/A'}</p>
        <p className="text-gray-600 mb-2"><strong>Contact Phone:</strong> {listing.contact_phone || 'N/A'}</p>
        <p className="text-gray-600 mb-2"><strong>Website:</strong> {listing.website_url ? <a href={listing.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{listing.website_url}</a> : 'N/A'}</p>
        <p className="text-gray-600 mb-2"><strong>Category:</strong> {listing.categories?.map(c => c.name).join(', ') || 'None'}</p>
        {listing.type === 'event' && (
          <>
            <p className="text-gray-600 mb-2"><strong>Event Date:</strong> {listing.event_details?.start_date_time ? new Date(listing.event_details.start_date_time).toLocaleString() : 'N/A'}</p>
            <p className="text-gray-600 mb-2"><strong>Is Free:</strong> {listing.event_details?.is_free ? 'Yes' : 'No'}</p>
            <p className="text-gray-600 mb-2"><strong>Vendors:</strong> {listing.vendors?.map(v => v.title).join(', ') || 'None'}</p>
          </>
        )}
        {listing.type === 'temple' && (
          <>
            <p className="text-gray-600 mb-2"><strong>Deity:</strong> {listing.temple_details?.deity || 'N/A'}</p>
            <p className="text-gray-600 mb-2"><strong>Denomination:</strong> {listing.temple_details?.denomination || 'N/A'}</p>
            <p className="text-gray-600 mb-2"><strong>Activities:</strong> {listing.activities?.map(a => a.title).join(', ') || 'None'}</p>
          </>
        )}
        {listing.type === 'vendor' && (
          <>
            <p className="text-gray-600 mb-2"><strong>Business Type:</strong> {listing.vendor_details?.business_type || 'N/A'}</p>
            <p className="text-gray-600 mb-2"><strong>Specialty:</strong> {listing.vendor_details?.specialty || 'N/A'}</p>
            <p className="text-gray-600 mb-2"><strong>Years in Business:</strong> {listing.vendor_details?.years_in_business || 'N/A'}</p>
          </>
        )}
        {listing.type === 'activity' && (
          <>
            <p className="text-gray-600 mb-2"><strong>Activity Type:</strong> {listing.activity_details?.activity_type || 'N/A'}</p>
            <p className="text-gray-600 mb-2"><strong>Schedule:</strong> {listing.activity_details?.schedule || 'N/A'}</p>
          </>
        )}
        <p className="text-gray-600 mb-4"><strong>Status:</strong> {listing.status}</p>

        {actionError && <p className="text-red-500 mb-4">{actionError}</p>}

        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <Link
              to="/"
              className="text-blue-500 hover:underline"
            >
              Back to Home
            </Link>
            <div className="space-x-2">
              {user && (
                <button
                  onClick={handleFavoriteToggle}
                  className={`px-4 py-2 rounded ${isFavorite ? 'bg-red-500 hover:bg-red-700' : 'bg-green-500 hover:bg-green-700'} text-white font-bold`}
                >
                  {isFavorite ? 'Unfavorite' : 'Favorite'}
                </button>
              )}
              {canEdit && (
                <Link
                  to={`/edit-listing/${id}`}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Edit Listing
                </Link>
              )}
            </div>
          </div>
          {user && (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isNotified}
                onChange={handleNotificationToggle}
                className="mr-2"
              />
              <label className="text-gray-700">Receive notifications for this listing</label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingDetailsPage;