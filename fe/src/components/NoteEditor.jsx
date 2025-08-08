import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import Delta from 'quill-delta';
import 'quill/dist/quill.snow.css';

const NoteEditor = ({ value, onChange, noteId }) => {
  const quillRef = useRef(null);
  const quillInstance = useRef(null);
  const suppressChange = useRef(false);

  console.log('🔄 NoteEditor render - noteId:', noteId, 'value:', value);

  // Initialize Quill editor once
  useEffect(() => {
    if (quillInstance.current) {
      return; // Already initialized
    }

    if (!quillRef.current) {
      console.error('❌ Quill ref not available');
      return;
    }

    console.log('🖊️ Initializing Quill editor...');

    try {
      quillInstance.current = new Quill(quillRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['clean']
          ],
        },
        placeholder: 'Start typing your note here...',
      });

      // Handle text changes
      quillInstance.current.on('text-change', (delta, oldDelta, source) => {
        console.log('📝 Quill text-change event:', {
          source,
          deltaOps: delta?.ops,
          suppressChange: suppressChange.current
        });

        if (source === 'user' && !suppressChange.current && onChange) {
          const content = quillInstance.current.getContents();
          console.log('📤 Calling onChange with:', {
            contentOps: content?.ops,
            deltaOps: delta?.ops
          });
          onChange(content, delta, source, quillInstance.current);
        }
      });

      console.log('✅ Quill editor initialized successfully');

    } catch (error) {
      console.error('❌ Error initializing Quill:', error);
    }

    return () => {
      if (quillInstance.current) {
        console.log('🧹 Cleaning up Quill editor');
        quillInstance.current = null;
      }
    };
  }, []); // Only run once

  // Update content when value prop changes
  useEffect(() => {
    if (!quillInstance.current || !value) {
      console.log('⏸️ Skipping content update - no editor or value');
      return;
    }

    console.log('🔄 Updating editor content:', {
      hasValue: !!value,
      valueType: typeof value,
      isValueDelta: value instanceof Delta,
      hasOps: !!(value?.ops),
      opsLength: value?.ops?.length || 0
    });

    try {
      let deltaToSet;

      // Handle different value formats
      if (value instanceof Delta) {
        deltaToSet = value;
      } else if (value && typeof value === 'object' && Array.isArray(value.ops)) {
        deltaToSet = new Delta(value.ops);
      } else if (Array.isArray(value)) {
        deltaToSet = new Delta(value);
      } else {
        console.warn('⚠️ Unexpected value format, creating empty delta');
        deltaToSet = new Delta();
      }

      // Get current content to compare
      const currentContent = quillInstance.current.getContents();
      const currentOps = currentContent?.ops || [];
      const newOps = deltaToSet?.ops || [];

      // Only update if content is actually different
      const contentChanged = JSON.stringify(currentOps) !== JSON.stringify(newOps);

      if (contentChanged) {
        console.log('📥 Setting new content:', {
          currentOpsLength: currentOps.length,
          newOpsLength: newOps.length,
          newOpsPreview: newOps.slice(0, 2)
        });

        suppressChange.current = true;
        quillInstance.current.setContents(deltaToSet, 'silent');
        
        // Reset suppression after a short delay
        setTimeout(() => {
          suppressChange.current = false;
        }, 50);

        console.log('✅ Content updated successfully');
      } else {
        console.log('⏭️ Content unchanged, skipping update');
      }

    } catch (error) {
      console.error('❌ Error updating content:', error);
      console.error('Value was:', value);
    }
  }, [value]);

  // Add debug utilities
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.debugEditor = {
        getQuillInstance: () => quillInstance.current,
        getCurrentContent: () => quillInstance.current?.getContents(),
        setText: (text) => {
          if (quillInstance.current) {
            suppressChange.current = true;
            quillInstance.current.setText(text);
            setTimeout(() => {
              suppressChange.current = false;
            }, 50);
          }
        },
        getValue: () => value,
        noteId: noteId
      };
    }
  }, [value, noteId]);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div 
        ref={quillRef} 
        className="min-h-[300px]"
        style={{
          fontSize: '16px',
          lineHeight: '1.6'
        }}
      />
      
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 px-3 py-2 text-xs border-t">
          <div className="font-mono text-gray-600">
            Debug: Editor {quillInstance.current ? '✅' : '❌'} | 
            Value: {value?.ops?.length || 0} ops | 
            Suppress: {suppressChange.current ? 'Yes' : 'No'}
          </div>
          <button
            onClick={() => {
              const content = quillInstance.current?.getContents();
              console.log('Current editor content:', content);
              alert(`Content: ${JSON.stringify(content?.ops || [], null, 2)}`);
            }}
            className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
          >
            Show Content
          </button>
        </div>
      )}
    </div>
  );
};

export default NoteEditor;