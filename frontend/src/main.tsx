import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { LoadingProvider } from './context/LoadingContext';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <LoadingProvider>
            <App />
        </LoadingProvider>
    </BrowserRouter>
);
