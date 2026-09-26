import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AdminPortal } from './components/AdminPortal';
import './index.css';

// Routing: Only allow secret owner URLs or hidden trigger to open Admin Portal
// If curious users try /admin, they get the regular game!
const pathname = window.location.pathname.toLowerCase();
const search = window.location.search.toLowerCase();
const hash = window.location.hash.toLowerCase();

const isSecretAdminRoute =
  pathname.includes('cwp-master-786') ||
  pathname.includes('cwp-owner-portal') ||
  pathname.includes('admin-secret') ||
  search.includes('key=cwp786') ||
  search.includes('secret=786') ||
  hash.includes('cwp786');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSecretAdminRoute ? <AdminPortal /> : <App />}
  </StrictMode>,
);
