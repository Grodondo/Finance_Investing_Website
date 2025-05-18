import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface TwoFactorSetupProps {
  onSetupComplete: () => void;
}

export default function TwoFactorSetup({ onSetupComplete }: TwoFactorSetupProps) {
  const { setup2FA, enable2FA } = useAuth();
  const [step, setStep] = useState<'initial' | 'verify'>('initial');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await setup2FA();
      setSecret(response.secret);
      setQrCode(response.qr_code);
      setRecoveryCodes(response.recovery_codes);
      setStep('verify');
    } catch (err) {
      setError('Failed to set up 2FA. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      await enable2FA(verificationCode);
      onSetupComplete();
    } catch (err) {
      setError('Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
  };

  return (
    <div className="bg-white dark:bg-dark-surface shadow sm:rounded-lg p-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-dark-text">
        Two-Factor Authentication Setup
      </h3>
      
      {step === 'initial' ? (
        <div className="mt-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Two-factor authentication adds an extra layer of security to your account. 
            Once enabled, you'll need to provide a verification code from your authenticator app 
            in addition to your password when signing in.
          </p>
          
          <div className="mt-5">
            <button
              type="button"
              onClick={handleSetup}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Setting up...' : 'Set up two-factor authentication'}
            </button>
          </div>
          
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          <div>
            <h4 className="text-base font-medium text-gray-900 dark:text-dark-text">
              1. Scan this QR code with your authenticator app
            </h4>
            <div className="mt-3 flex justify-center">
              {qrCode && (
                <div className="p-2 bg-white rounded-lg">
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                </div>
              )}
            </div>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              If you can't scan the QR code, you can manually add this secret key to your authenticator app:
            </p>
            <div className="mt-1 flex items-center">
              <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                {secret}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(secret)}
                className="ml-2 text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm"
              >
                Copy
              </button>
            </div>
          </div>
          
          <div>
            <h4 className="text-base font-medium text-gray-900 dark:text-dark-text">
              2. Save these recovery codes
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Recovery codes can be used to access your account if you lose your device. Each code can only be used once.
              Keep these somewhere safe but accessible.
            </p>
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((code, index) => (
                  <code key={index} className="font-mono text-sm">
                    {code}
                  </code>
                ))}
              </div>
              <button
                type="button"
                onClick={copyRecoveryCodes}
                className="mt-3 text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm"
              >
                Copy all codes
              </button>
            </div>
          </div>
          
          <div>
            <h4 className="text-base font-medium text-gray-900 dark:text-dark-text">
              3. Enter verification code from your app
            </h4>
            <div className="mt-2">
              <input
                type="text"
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
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleVerify}
              disabled={isLoading || verificationCode.length !== 6}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Verify and enable'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 