import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/orbitron';
import './styles.css';
import { getRouter, queryClient } from './router';

const router = getRouter();

const rootElement = document.getElementById('app')!;

if (!rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
