
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element');
}

// Get production URL for Clerk configuration
const getProductionUrl = () => {
  return import.meta.env.VITE_APP_URL || import.meta.env.NEXT_PUBLIC_APP_URL || 'https://helpyfam.com';
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={clerkPubKey}
      domain={typeof window !== 'undefined' && window.location.hostname.includes('helpyfam.com') ? 'helpyfam.com' : undefined}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
