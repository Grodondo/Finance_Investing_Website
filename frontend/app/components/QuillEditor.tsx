import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  modules?: any; // Not used with TipTap but kept for API compatibility
  formats?: string[]; // Not used with TipTap but kept for API compatibility
  theme?: string; // Not used with TipTap but kept for API compatibility
  className?: string;
}

// Add CSS for the placeholder and dark mode
const editorStyles = `
  .tiptap-editor .ProseMirror {
    min-height: 200px;
    outline: none;
    padding: 1rem;
  }
  
  .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
    color: #adb5bd;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  
  /* Dark mode styles */
  .dark .tiptap-editor .ProseMirror {
    color: #f3f4f6;
    background-color: #1f2937;
  }
  
  .dark .tiptap-editor .menu-bar {
    background-color: #374151;
    border-color: #4b5563;
  }
  
  .dark .tiptap-editor button {
    color: #e5e7eb;
  }
  
  .dark .tiptap-editor button.is-active,
  .dark .tiptap-editor button[class*="bg-gray-200"] {
    background-color: #4b5563;
  }
  
  .dark .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
    color: #9ca3af;
  }
`;

const QuillEditor: React.FC<QuillEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your post content here...',
  readOnly = false,
  className,
}) => {
  // Add CSS to the document
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = editorStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none',
      },
    },
  });

  // Set the placeholder attribute on the first paragraph element
  useEffect(() => {
    if (editor) {
      // Get the editor element
      const editorElement = editor.view.dom;
      
      // This is where the "is-editor-empty" class is toggled based on content
      const updatePlaceholder = () => {
        const isEmpty = editor.isEmpty;
        
        // Find the first paragraph, create one if it doesn't exist
        let firstParagraph = editorElement.querySelector('p:first-child');
        if (!firstParagraph && isEmpty) {
          // If there's no paragraph and editor is empty, create one
          firstParagraph = document.createElement('p');
          editorElement.appendChild(firstParagraph);
        }
        
        if (firstParagraph) {
          if (isEmpty) {
            firstParagraph.setAttribute('data-placeholder', placeholder);
            firstParagraph.classList.add('is-editor-empty');
          } else {
            firstParagraph.classList.remove('is-editor-empty');
          }
        }
      };
      
      // Initial setup
      updatePlaceholder();
      
      // Add transaction handler to check content changes
      editor.on('transaction', updatePlaceholder);
      editor.on('focus', updatePlaceholder);
      editor.on('blur', updatePlaceholder);
      
      return () => {
        editor.off('transaction', updatePlaceholder);
        editor.off('focus', updatePlaceholder);
        editor.off('blur', updatePlaceholder);
      };
    }
  }, [editor, placeholder]);

  // Toolbar component
  const MenuBar = () => {
    if (!editor) {
      return null;
    }

    return (
      <div className="menu-bar flex flex-wrap gap-1 p-1 border-b border-gray-300 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 rounded-t">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1 rounded ${editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
          title="Bold"
          type="button"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1 rounded ${editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
          title="Italic"
          type="button"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1 rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
          title="Heading 1"
          type="button"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
          title="Heading 2"
          type="button"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1 rounded ${editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
          title="Bullet List"
          type="button"
        >
          • List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1 rounded ${editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
          title="Numbered List"
          type="button"
        >
          1. List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1 rounded ${editor.isActive('codeBlock') ? 'bg-gray-200 dark:bg-gray-600' : ''}`}
          title="Code Block"
          type="button"
        >
          &lt;/&gt;
        </button>
        <button
          onClick={() => editor.chain().focus().undo().run()}
          className="p-1 rounded"
          title="Undo"
          disabled={!editor.can().undo()}
          type="button"
        >
          ↩
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          className="p-1 rounded"
          title="Redo"
          disabled={!editor.can().redo()}
          type="button"
        >
          ↪
        </button>
      </div>
    );
  };

  return (
    <div className={`tiptap-editor ${className || ''}`}>
      {!readOnly && <MenuBar />}
      <EditorContent editor={editor} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-b" />
    </div>
  );
};

export default QuillEditor; 