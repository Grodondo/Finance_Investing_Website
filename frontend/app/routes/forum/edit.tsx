import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import QuillEditor from '../../components/QuillEditor';
import { ForumPost, ForumTag, ForumImage as ForumImageType } from '../../contexts/ForumContext'; // Assuming ForumImage type is exported

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

interface ImageFile {
  file: File;
  preview: string;
  error?: string;
  isExisting?: boolean;
  id?: number; // For existing images
}

const ForumEditPost: React.FC = () => {
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const { 
    sections, 
    tags: availableTags, // Renamed to avoid conflict
    loadSections, 
    loadTags,
    loadPost, 
    updatePost,
    isAdmin, 
    loading: forumLoading, // Renamed to avoid conflict with internal loading
    error: forumError // Renamed
  } = useForum();
  const { user } = useAuth();

  // Form state
  const [initialPostData, setInitialPostData] = useState<ForumPost | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sectionId, setSectionId] = useState<number | string>('');
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isOfficial, setIsOfficial] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true); // For initial post load

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sections and tags if not already loaded
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (sections.length === 0) {
          await loadSections();
        }
        if (availableTags.length === 0) {
          await loadTags();
        }
      } catch (error) {
        console.error('Error loading sections/tags:', error);
        setFormError('Failed to load necessary data. Please try again later.');
      }
    };
    fetchData();
  }, [loadSections, loadTags, sections.length, availableTags.length]);
  
  useEffect(() => {
    const fetchPost = async () => {
      setPageLoading(true);
      setFormError('');
      try {
        if (postId) {
          const post = await loadPost(Number(postId));
          setInitialPostData(post);
          setTitle(post.title);
          setContent(post.content);
          setSectionId(post.section_id);
          setSelectedTags(post.tags.map(tag => tag.id));
          setIsOfficial(post.is_official || false);
          // Map existing images to ImageFile format
          const existingImages: ImageFile[] = post.images.map(img => ({
            file: new File([], img.filename, { type: img.mime_type }), // Placeholder file
            preview: img.filepath, // Assuming filepath is the URL
            isExisting: true,
            id: img.id
          }));
          setImages(existingImages);
        }
      } catch (err: any) {
        console.error('Error loading post for editing:', err);
        setFormError(err.message || 'Failed to load post data.');
      } finally {
        setPageLoading(false);
      }
    };
    
    if (postId) {
      fetchPost();
    }
  }, [postId, loadPost]);
  
  // Reset form errors when inputs change
  useEffect(() => {
    if (formError) setFormError('');
  }, [title, content, sectionId, selectedTags]);
  
  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        setImages(prev => [...prev, {
          file,
          preview: URL.createObjectURL(file),
          error: `File ${file.name} exceeds 5MB`
        }]);
        return;
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setImages(prev => [...prev, {
          file,
          preview: URL.createObjectURL(file),
          error: `File ${file.name} has unsupported type`
        }]);
        return;
      }
      setImages(prev => [...prev, {
        file,
        preview: URL.createObjectURL(file)
      }]);
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      const removedImage = newImages[index];
      // Revoke URL only if it's a new, non-existing image preview
      if (!removedImage.isExisting) {
        URL.revokeObjectURL(removedImage.preview);
      }
      newImages.splice(index, 1);
      return newImages;
    });
  };
  
  const toggleTag = (tagId: number) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId || !initialPostData) {
      setFormError('Post data is not available. Cannot update.');
      return;
    }

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
    
    setIsSubmitting(true);
    setFormError('');
    
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', content);
      formData.append('section_id', String(sectionId));
      
      // Compare current tags with initial tags to determine if changed
      const initialTagIds = initialPostData.tags.map(t => t.id).sort();
      const currentTagIds = [...selectedTags].sort();
      const tagsChanged = JSON.stringify(initialTagIds) !== JSON.stringify(currentTagIds);

      if (tagsChanged) {
          selectedTags.forEach(tagId => formData.append('tag_ids', String(tagId)));
          if (selectedTags.length === 0) { // Handle case where all tags are removed
            formData.append('tag_ids', ''); 
          }
      }
      // Only append tag_ids if they have changed to avoid sending empty array if no change and no tags initially.
      // The backend should handle an empty tag_ids list as "remove all tags".

      // Handle images:
      // Backend needs to know which images to keep, remove, and which are new.
      // For simplicity here, we send all "new" images.
      // A more robust solution would involve sending IDs of images to keep/remove.
      // This current implementation assumes backend `updatePost` can handle new `files`
      // and potentially replaces all existing images or merges intelligently.
      // For now, only new images are sent. Existing images are assumed to remain unless removed by a separate mechanism.
      images.forEach(img => {
        if (!img.isExisting && !img.error) { // only send new, valid files
          formData.append('files', img.file);
        }
      });
      
      if (isAdmin) {
        formData.append('is_official', String(isOfficial));
      }

      await updatePost(Number(postId), formData);
      navigate(`/forum/post/${postId}`);
    } catch (err: any) {
      console.error('Error updating post:', err);
      setFormError(err.message || 'An error occurred while updating your post.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'link'
  ];

  if (pageLoading || (forumLoading && !initialPostData)) {
    return <Loader text="Loading post data..." />;
  }
  
  if (forumError && !initialPostData) { // If initial load failed
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-4 text-red-700 dark:text-red-400">
          <p>Error loading post: {forumError}</p>
        </div>
      </div>
    );
  }
  
  if (!initialPostData) {
     return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Post not found or could not be loaded.</p>
         <button
          onClick={() => navigate('/forum')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back to Forum
        </button>
      </div>
    );
  }

  // Find the current section object to check its type for disabling
  const currentPostSection = sections.find(s => s.id === initialPostData.section_id);

  // Filter sections based on admin status and announcement type
  const filteredSections = sections.filter(section => 
    isAdmin || (!section.is_restricted && section.section_type !== 'admin_announcements')
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/forum/post/${postId}`)}
          className="mb-4 inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back to Post
        </button>
        <PageTitle title="Edit Post" />
      </div>
      
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden p-6 space-y-6">
        {formError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-4 text-red-700 dark:text-red-400 flex items-center">
            <ExclamationCircleIcon className="h-5 w-5 mr-2" />
            <p>{formError}</p>
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title
          </label>
          <input
            type="text"
            name="title"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Content
          </label>
          <QuillEditor
            value={content}
            onChange={setContent}
            modules={quillModules}
            formats={quillFormats}
            placeholder="Write your post content here..."
            className="mt-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 quill-container-edit"
          />
        </div>

        <div>
          <label htmlFor="section" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Section
          </label>
          <select
            id="section"
            name="section"
            value={sectionId}
            onChange={(e) => setSectionId(Number(e.target.value))}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
            disabled={currentPostSection?.section_type === 'admin_announcements' && !isAdmin}
          >
            <option value="" disabled>Select a section</option>
            {filteredSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </div>

        {availableTags.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  type="button"
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors duration-150 ease-in-out
                    ${selectedTags.includes(tag.id)
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  <TagIcon className="h-4 w-4 mr-1.5 inline-block" />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {isAdmin && currentPostSection?.section_type === 'admin_announcements' && (
           <div className="flex items-center">
            <input
              id="isOfficialUpdate"
              name="isOfficialUpdate"
              type="checkbox"
              checked={isOfficial}
              onChange={(e) => setIsOfficial(e.target.checked)}
              className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 bg-white dark:bg-gray-700"
            />
            <label htmlFor="isOfficialUpdate" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
              Mark as Official Announcement (Admin)
            </label>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Images (Optional)
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <PhotoIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
              <div className="flex text-sm text-gray-600 dark:text-gray-400">
                <label
                  htmlFor="file-upload-edit"
                  className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800 focus-within:ring-indigo-500"
                >
                  <span>Upload new files</span>
                  <input id="file-upload-edit" name="file-upload-edit" type="file" className="sr-only" multiple onChange={handleImageUpload} ref={fileInputRef} accept={ALLOWED_FILE_TYPES.join(',')} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF up to 5MB each</p>
            </div>
          </div>
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <div key={image.id || index} className="relative group p-2 border rounded-lg dark:border-gray-700">
                  <img
                    src={image.preview}
                    alt={`preview ${index}`}
                    className="h-32 w-full object-cover rounded-md"
                  />
                  {image.error && (
                    <p className="text-xs text-red-500 mt-1">{image.error}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-75 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                  {image.isExisting && (
                    <span className="absolute bottom-1 left-1 bg-gray-700 text-white text-xs px-1.5 py-0.5 rounded">
                      Existing
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(`/forum/post/${postId}`)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50"
            disabled={isSubmitting || !!formError || pageLoading || (forumLoading && !initialPostData) || images.some(img => !!img.error)}
          >
            {isSubmitting ? (
              <Loader size="small" />
            ) : (
              <CheckIcon className="h-5 w-5 mr-1.5" />
            )}
            Update Post
          </button>
        </div>
      </form>
    </div>
  );
};

export default ForumEditPost; 