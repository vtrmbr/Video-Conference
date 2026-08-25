import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@livekit/components-styles';
import './styles/index.css';
import { App } from './app/App.js';

const root = document.getElementById('root');
if (!root) throw new Error('Application root was not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
