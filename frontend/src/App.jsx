import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ClinicProvider } from './context/ClinicContext';
import { ToastProvider } from './context/ToastContext';
import AppRoutes from './routes/AppRoutes';
import './styles/variables.css';
import './styles/global.css';
import './styles/responsive.css';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ClinicProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ClinicProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
