import React, { useContext, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false, operatorAllowed = false }) => {
  const { token, isOperator, user, loading } = useContext(AuthContext);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user is loaded and is an operator
  if (user && isOperator) {
    // If route requires admin or is not explicitly operator allowed, redirect to /distributions
    if (adminOnly || !operatorAllowed) {
      return <Navigate to="/distributions" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
