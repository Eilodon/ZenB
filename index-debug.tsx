
import React from 'react';
import ReactDOM from 'react-dom/client';

console.log("DEBUG: index-debug.tsx executing");
console.log("DEBUG: React version", React.version);

const rootElement = document.getElementById('root');
if (rootElement) {
    rootElement.innerHTML = '<div style="color: white; padding: 20px;"><h1>DEBUG: JS EXECUTION SUCCESS</h1></div>';
    console.log("DEBUG: DOM updated");
} else {
    console.error("DEBUG: Root element not found");
}
