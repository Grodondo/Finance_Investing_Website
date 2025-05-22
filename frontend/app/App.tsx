import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ThemeProvider from './contexts/ThemeContext';
import { router } from './routes.tsx';
import './i18n/i18n'; // Import i18n configuration

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 