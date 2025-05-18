import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForum } from '../../contexts/ForumContext';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import PageTitle from '../../components/PageTitle';
import Loader from '../../components/Loader';

const ForumEditPost: React.FC = () => {
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const { loadPost, loading, error } = useForum();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sectionId, setSectionId] = useState<number>(0);
  
  useEffect(() => {
    const fetchPost = async () => {
      try {
        if (postId) {
          const post = await loadPost(Number(postId));
          setTitle(post.title);
          setContent(post.content);
          setSectionId(post.section_id);
        }
      } catch (error) {
        console.error('Error loading post for editing:', error);
      }
    };
    
    fetchPost();
  }, [postId, loadPost]);
  
  if (loading) {
    return <Loader />;
  }
  
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-4 text-red-700 dark:text-red-400">
          <p>Error loading post: {error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back
        </button>
        
        <PageTitle title="Edit Post" />
      </div>
      
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden p-6">
        <p className="text-center text-gray-500 dark:text-gray-400 my-8">
          This is a placeholder for the edit post form.
        </p>
      </div>
    </div>
  );
};

export default ForumEditPost; 