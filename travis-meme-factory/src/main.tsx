import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/anton/400.css';
import '@fontsource/bangers/400.css';
import '@fontsource/permanent-marker/400.css';
import '@fontsource/comic-neue/700.css';
import '@fontsource/oswald/700.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
