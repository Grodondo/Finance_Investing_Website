import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface TwoFactorDisableProps {
  onDisableComplete: () => void;
}

export default function TwoFactorDisable({ onDisableComplete }: TwoFactorDisableProps) {
  const { disable2FA } = useAuth();
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDisable = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      await disable2FA(verificationCode);
      onDisableComplete();
    } catch (err) {
      setError('Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-surface shadow sm:rounded-lg p-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-dark-text">
        Disable Two-Factor Authentication
      </h3>
      
      <div className="mt-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          To disable two-factor authentication, please enter the verification code from your authenticator app.
          This will remove the extra security layer from your account.
        </p>
        
        <div className="mt-4">
          <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Verification Code
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="verification-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit code"
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm p-2"
            />
          </div>
        </div>
        
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        
        <div className="mt-5">
          <button
            type="button"
            onClick={handleDisable}
            disabled={isLoading || verificationCode.length !== 6}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isLoading ? 'Disabling...' : 'Disable two-factor authentication'}
          </button>
        </div>
      </div>
    </div>
  );
} 