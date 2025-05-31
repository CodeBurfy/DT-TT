// src/UserOnboarding.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebaseConfig';

const UserOnboarding = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    termsAccepted: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    const checkUserData = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/check`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const { profileComplete, user: userData } = response.data;
        if (profileComplete) {
          navigate('/');
        } else {
          setFormData({
            firstName: userData?.first_name || '',
            lastName: userData?.last_name || '',
            email: userData?.email || user.email || '',
            phoneNumber: userData?.phone_number || '',
            termsAccepted: userData?.terms_accepted || false,
          });
        }
      } catch (err) {
        console.error('Error checking user data:', err);
        setError(err.response?.data?.error || 'Failed to load user data.');
      }
    };
    checkUserData();
  }, [user, navigate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      setError('First name, last name, and email are required.');
      return;
    }
    if (!formData.termsAccepted) {
      setError('You must accept the terms and conditions.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const payload = {
        firebase_uid: user.uid,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        terms_accepted: formData.termsAccepted,
      };
      if (formData.phoneNumber.trim()) {
        payload.phone_number = formData.phoneNumber;
      }
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/listings/users/update`,
        payload,
        {
          headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        }
      );
      console.log('User data upserted:', response.data);
      navigate('/');
    } catch (err) {
      console.error('Error upserting user data:', err);
      setError(err.response?.data?.error || 'Failed to save user data.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h2 className="text-2xl font-bold mb-4">Complete Your Profile</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="firstName">
            First Name
          </label>
          <input
            type="text"
            name="firstName"
            id="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            placeholder="Enter your first name"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="lastName">
            Last Name
          </label>
          <input
            type="text"
            name="lastName"
            id="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            placeholder="Enter your last name"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="email">
            Email
          </label>
          <input
            type="email"
            name="email"
            id="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            placeholder="Enter your email"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="phoneNumber">
            Phone Number (Optional)
          </label>
          <input
            type="tel"
            name="phoneNumber"
            id="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            placeholder="Enter your phone number"
          />
        </div>
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="termsAccepted"
              checked={formData.termsAccepted}
              onChange={handleInputChange}
              className="mr-2"
              required
            />
            <span className="text-gray-700">
              I accept the{' '}
              <a href="/terms" target="_blank" className="text-blue-500 hover:underline">
                Terms and Conditions
              </a>
            </span>
          </label>
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
};

export default UserOnboarding;