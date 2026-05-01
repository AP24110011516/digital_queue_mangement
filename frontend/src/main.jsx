import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { API_URL } from './config';
import emailjs from '@emailjs/browser';

// Initialize EmailJS with Public Key
emailjs.init("2_jx7fcUMJZXTsUT9");

axios.defaults.baseURL = API_URL;
axios.defaults.headers.common.Accept = 'application/json';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SocketProvider>
        <App />
      </SocketProvider>
    </AuthProvider>
  </React.StrictMode>,
);
