import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { FirebaseProvider } from './FirebaseProvider';
import { ThemeProvider } from './ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <FirebaseProvider>
        <App />
      </FirebaseProvider>
    </ThemeProvider>
  </StrictMode>,
);
