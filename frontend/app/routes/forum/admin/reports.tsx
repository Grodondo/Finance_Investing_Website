import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForum, ForumReport } from '../../../contexts/ForumContext';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  ChevronLeftIcon, 
  FlagIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import PageTitle from '../../../components/PageTitle';
import Loader from '../../../components/Loader';

const ForumAdminReports: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loadReports, resolveReport, isAdmin, loading, error } = useForum();
  
  const [reports, setReports] = useState<ForumReport[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  
  useEffect(() => {
    // Redirect if not an admin
    if (user && !isAdmin) {
      navigate('/forum');
    }
  }, [user, isAdmin, navigate]);
  
  useEffect(() => {
    const fetchReports = async () => {
      try {
        if (filter === 'all') {
          const reportData = await loadReports();
          setReports(reportData);
        } else {
          const isResolved = filter === 'resolved';
          const reportData = await loadReports(isResolved);
          setReports(reportData);
        }
      } catch (error) {
        console.error('Error loading reports:', error);
      }
    };
    
    if (isAdmin) {
      fetchReports();
    }
  }, [filter, loadReports, isAdmin]);
  
  const handleResolveReport = async (reportId: number) => {
    try {
      await resolveReport(reportId);
      // Refresh the list
      if (filter === 'all') {
        const reportData = await loadReports();
        setReports(reportData);
      } else {
        const isResolved = filter === 'resolved';
        const reportData = await loadReports(isResolved);
        setReports(reportData);
      }
    } catch (error) {
      console.error('Error resolving report:', error);
    }
  };
  
  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (loading) {
    return <Loader />;
  }
  
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-4 text-red-700 dark:text-red-400">
          <p>Error loading reports: {error}</p>
        </div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 text-yellow-700 dark:text-yellow-400">
          <p>You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/forum')}
          className="mb-4 inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back to Forum
        </button>
        
        <PageTitle 
          title="Manage Reports" 
          icon={<FlagIcon className="h-7 w-7" />}
        />
      </div>
      
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setFilter('open')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'open'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              Open Reports
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'resolved'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              Resolved Reports
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              All Reports
            </button>
          </div>

          <p className="text-center text-gray-500 dark:text-gray-400 my-8">
            This is a placeholder for the admin reports list.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForumAdminReports; 