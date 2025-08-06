import React, { useRef, useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import Delta from 'quill-delta';

const NoteEditor = ({ value, onChange, noteId }) => {
  const quillRef = useRef(null);
  const [editorInitialized, setEditorInitialized] = useState(false);
  const previousValue = useRef(null); // 🧠 Track previous value to prevent overwriting

  const safeValue = value instanceof Delta ? value : new Delta();

  // 🟢 Set initial content once on first mount
  useEffect(() => {
    if (quillRef.current && !editorInitialized) {
      const editor = quillRef.current.getEditor();
      editor.setContents(safeValue, 'api');
      previousValue.current = safeValue;
      setEditorInitialized(true);
    }
  }, [safeValue, editorInitialized]);

  // 🟢 Update editor only if value came from server and has changed
  useEffect(() => {
    if (quillRef.current && editorInitialized) {
      const editor = quillRef.current.getEditor();

      let currentEditorContent;
      try {
        currentEditorContent = new Delta(editor.getContents());
      } catch (e) {
        console.warn('Invalid editor content. Using empty Delta.', e);
        currentEditorContent = new Delta();
      }

      const isNewContent = (
        safeValue instanceof Delta &&
        typeof currentEditorContent.equals === 'function' &&
        !currentEditorContent.equals(safeValue) &&
        !safeValue.equals(previousValue.current)
      );

      if (isNewContent) {
        editor.setContents(safeValue, 'api');
        previousValue.current = safeValue;
      }
    }
  }, [safeValue, editorInitialized]);

  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image'
  ];

  return (
    <div className="rounded-lg shadow-md overflow-hidden">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={safeValue}
        onChange={onChange}
        modules={modules}
        formats={formats}
        className="bg-white"
      />
    </div>
  );
};

export default NoteEditor;
