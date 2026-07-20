import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import Admin from './Admin.tsx';
import './index.css';

const path = window.location.pathname;

let Component = App;
if (path.startsWith('/admin')) {
  Component = Admin;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Component />
  </StrictMode>,
);
