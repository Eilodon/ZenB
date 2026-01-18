import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { EngineProvider } from './src/engine/EngineProvider';
import { KernelProvider } from './src/kernel/KernelProvider';
import { installDisplaySystem } from './src/platform/display';
import './src/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

console.log('[ZenB] Booting full application...');

installDisplaySystem();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <KernelProvider>
        <EngineProvider>
          <App />
        </EngineProvider>
      </KernelProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
