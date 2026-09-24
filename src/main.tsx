import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './CounterGame';
import RushGame from './RushGame';
import './base.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).get('mode') === 'rush' ? <RushGame /> : <App />}
  </StrictMode>,
);
