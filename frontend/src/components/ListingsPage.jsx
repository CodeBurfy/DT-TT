import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import axios from 'axios';
import { auth, googleProvider } from '../firebaseConfig';

const LoginPage = () => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Sync user with Supabase
      await axios.post(`${import.meta.env.VITE_API_URL}/api/users/sync`, {
        firebase_uid: user.uid,
        email: user.email,
        first_name: user.displayName ? user.displayName.split(' ')[0] : '',
        last_name: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : ''
      });

      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-3xl font-bold mb-6 text-center">Sign In</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center"
          disabled={loading}
        >
          {loading ? 'Signing In...' : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.854H12.545z"
                />
              </svg>
              Sign In with Google
            </>
          )}
        </button>
      </div>
      <Link
        to="/"
        className="mt-4 inline-block text-blue-500 hover:underline"
      >
        Back to Home
      </Link>
    </div>
  );
};

export default LoginPage;