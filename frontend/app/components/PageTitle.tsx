import React, { ReactNode } from 'react';

interface PageTitleProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

const PageTitle: React.FC<PageTitleProps> = ({ title, subtitle, icon, actions }) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        {icon && <div className="text-indigo-600 dark:text-indigo-400">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
};

export default PageTitle; 