import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForum } from '../../contexts/ForumContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ChevronLeftIcon, 
  DocumentTextIcon,
  PhotoIcon,
  TagIcon,
  PaperClipIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  CheckIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import PageTitle from '../../components/PageTitle';
import Loader from '../../components/Loader';

// Add TypeScript declaration for react-quill
declare module 'react-quill';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

interface ImageFile {
  file: File;
  preview: string;
  error?: string;
}

const ForumNewPost: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { 
    sections, 
    tags,
    loadSections, 
    loadTags,
    createPost,
    isAdmin, 
    loading 
  } = useForum();
  const { user } = useAuth();
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sectionId, setSectionId] = useState<number | string>(searchParams.get('section') || '');
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isOfficial, setIsOfficial] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Check if this is an announcement post
  const isAnnouncement = searchParams.get('isAnnouncement') === 'true';
  
  // If this is an announcement, set isOfficial to true
  useEffect(() => {
    if (isAnnouncement && isAdmin) {
      setIsOfficial(true);
    }
  }, [isAnnouncement, isAdmin]);
  
  // Load sections and tags
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (sections.length === 0) {
          await loadSections();
        }
        
        if (tags.length === 0) {
          await loadTags();
        }
        
        // Set default section from URL parameter if provided
        const sectionParam = searchParams.get('section');
        if (sectionParam) {
          setSectionId(Number(sectionParam));
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setFormError('Failed to load necessary data. Please try again later.');
      }
    };
    
    fetchData();
  }, [loadSections, loadTags, sections, tags, searchParams]);
  
  // Reset form errors when inputs change
  useEffect(() => {
    if (formError) setFormError('');
  }, [title, content, sectionId, selectedTags]);
  
  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Process each selected file
    Array.from(files).forEach(file => {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setImages(prev => [...prev, {
          file,
          preview: URL.createObjectURL(file),
          error: `File ${file.name} exceeds the 5MB limit`
        }]);
        return;
      }
      
      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setImages(prev => [...prev, {
          file,
          preview: URL.createObjectURL(file),
          error: `File ${file.name} is not a supported image type`
        }]);
        return;
      }
      
      // Add valid file
      setImages(prev => [...prev, {
        file,
        preview: URL.createObjectURL(file)
      }]);
    });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Remove an image
  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      // Revoke the object URL to avoid memory leaks
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };
  
  // Toggle tag selection
  const toggleTag = (tagId: number) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!title.trim()) {
      setFormError('Please enter a title for your post');
      return;
    }
    
    if (!content.trim()) {
      setFormError('Please enter content for your post');
      return;
    }
    
    if (!sectionId) {
      setFormError('Please select a section for your post');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Check if any images have errors and filter them out
      const validImages = images.filter(img => !img.error).map(img => img.file);
      
      // Create form data
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', content);
      formData.append('section_id', String(sectionId));
      
      // Add tags if selected
      if (selectedTags.length > 0) {
        selectedTags.forEach(tag => {
          formData.append('tag_ids', String(tag));
        });
      }
      
      // Add images if any
      if (validImages.length > 0) {
        validImages.forEach(file => {
          formData.append('files', file);
        });
      }
      
      // Add official flag if admin and isOfficial is true
      if (isAdmin && isOfficial) {
        formData.append('is_official', 'true');
      }
      
      // Submit the post
      const newPost = await createPost(formData);
      
      // Navigate to the new post
      navigate(`/forum/post/${newPost.id}`);
    } catch (error) {
      console.error('Error creating post:', error);
      setFormError('An error occurred while creating your post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Rich text editor modules configuration
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link'],
      ['clean']
    ],
  };
  
  // Rich text editor formats configuration
  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'link'
  ];
  
  if (loading && sections.length === 0) {
    return <Loader />;
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
        
        <PageTitle 
          title={isAnnouncement ? "Create New Announcement" : "Create New Post"} 
          icon={<DocumentTextIcon className="h-7 w-7" />}
        />
      </div>
      
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden p-6">
        {formError && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-md text-red-700 dark:text-red-400 flex items-start">
            <ExclamationCircleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <p>{formError}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter a title for your post"
              disabled={isSubmitting}
            />
          </div>
          
          {/* Section Selection */}
          <div className="mb-6">
            <label htmlFor="section" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Section
            </label>
            <select
              id="section"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              disabled={isSubmitting || isAnnouncement}
            >
              <option value="">Select a section</option>
              {sections.map(section => (
                // Only show sections the user has access to
                (!section.is_restricted || isAdmin) && (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                )
              ))}
            </select>
          </div>
          
          {/* Tags */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <div className="flex items-center">
                <TagIcon className="h-4 w-4 mr-1" />
                Tags
              </div>
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedTags.includes(tag.id)
                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 border-2 border-indigo-500'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={isSubmitting}
                >
                  {selectedTags.includes(tag.id) && (
                    <CheckIcon className="inline-block h-3 w-3 mr-1" />
                  )}
                  {tag.name}
                </button>
              ))}
              
              {tags.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No tags available</p>
              )}
            </div>
          </div>
          
          {/* Rich Text Editor */}
          <div className="mb-6">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <div className="rich-text-editor dark:text-white">
              <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Write your post content here..."
                className={`h-64 mb-12 ${isSubmitting ? 'opacity-75 pointer-events-none' : ''}`}
                readOnly={isSubmitting}
              />
            </div>
          </div>
          
          {/* Image Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <div className="flex items-center">
                <PhotoIcon className="h-4 w-4 mr-1" />
                Images
              </div>
            </label>
            
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md">
              <div className="space-y-1 text-center">
                <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                  <label
                    htmlFor="image-upload"
                    className="relative cursor-pointer rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none"
                  >
                    <span>Upload images</span>
                    <input
                      id="image-upload"
                      name="image-upload"
                      type="file"
                      ref={fileInputRef}
                      className="sr-only"
                      multiple
                      accept="image/png, image/jpeg, image/gif"
                      onChange={handleImageUpload}
                      disabled={isSubmitting}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG, GIF up to 5MB
                </p>
              </div>
            </div>
            
            {/* Image Previews */}
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div 
                    key={index} 
                    className={`relative border rounded-lg overflow-hidden ${
                      image.error ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <img 
                      src={image.preview} 
                      alt={`Preview ${index}`}
                      className="w-full h-24 object-cover"
                    />
                    {image.error && (
                      <div className="absolute inset-0 bg-red-100 dark:bg-red-900/50 bg-opacity-70 flex items-center justify-center p-2">
                        <p className="text-xs text-red-700 dark:text-red-400 text-center">
                          {image.error}
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-gray-800 bg-opacity-70 text-white rounded-full p-1"
                      disabled={isSubmitting}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Official Post toggle for admins */}
          {isAdmin && (
            <div className="mb-6">
              <div className="flex items-center">
                <input
                  id="official"
                  type="checkbox"
                  checked={isOfficial}
                  onChange={(e) => setIsOfficial(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  disabled={isSubmitting || isAnnouncement}
                />
                <label htmlFor="official" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Mark as Official {isAnnouncement ? '(Announcement)' : 'Post'}
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Official posts are highlighted and trusted by users.
              </p>
            </div>
          )}
          
          {/* Submit Button */}
          <div className="flex justify-end mt-8">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mr-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader size="small" />
                  <span className="ml-2">Posting...</span>
                </>
              ) : (
                <>
                  <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                  {isAnnouncement ? 'Publish Announcement' : 'Post'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForumNewPost; 