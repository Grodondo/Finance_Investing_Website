import React from 'react';

interface ChartPlaceholderProps {
  message?: string;
  isError?: boolean;
  errorMessage?: string;
  height?: string;
}

const ChartPlaceholder: React.FC<ChartPlaceholderProps> = ({
  message = "Loading chart...",
  isError = false,
  errorMessage = "Failed to load chart data",
  height = "100%"
}) => {
  return (
    <div 
      className={`flex items-center justify-center ${height} p-4 rounded-lg border-2 border-dashed ${
        isError 
          ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20' 
          : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
      }`}
    >
      <div className="text-center">
        {isError ? (
          <>
            <svg 
              className="mx-auto h-12 w-12 text-red-500 dark:text-red-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="mt-2 text-red-700 dark:text-red-300 font-medium">{errorMessage}</p>
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">Try refreshing the page or changing filters</p>
          </>
        ) : (
          <>
            <svg 
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="mt-2 text-gray-600 dark:text-gray-300">{message}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default ChartPlaceholder; 