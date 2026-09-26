import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminPortal } from './components/AdminPortal';
import './index.css';

createRoot(document.getElementById('admin-root')!).render(
  <StrictMode>
    <AdminPortal />
  </StrictMode>,
);
