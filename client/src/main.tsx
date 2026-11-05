import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = '282245482346-so9hlg9vfsijt9tchu5akjf3b5ndh0m5.apps.googleusercontent.com';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
