import React from 'react';

interface LoadingPlaceholderProps {
  type?: 'card' | 'chart' | 'list' | 'table';
  height?: string;
  width?: string;
  className?: string;
}

const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({
  type = 'card',
  height = '100%',
  width = '100%',
  className = ''
}) => {
  const getPlaceholderContent = () => {
    switch (type) {
      case 'chart':
        return (
          <div className="space-y-4">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-[300px] bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        );
      case 'list':
        return (
          <div className="space-y-4">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4"></div>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                  <div className="ml-3">
                    <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1"></div>
                  </div>
                </div>
                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        );
      case 'table':
        return (
          <div className="space-y-4">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid grid-cols-4 gap-4">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'card':
      default:
        return (
          <div className="space-y-4">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 ${className}`}
      style={{ height, width }}
    >
      {getPlaceholderContent()}
    </div>
  );
};

export default LoadingPlaceholder; 