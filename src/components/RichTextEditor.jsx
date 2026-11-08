import { useState, useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const EMOJIS = [
  '💒','💍','🥂','🎊','🎉','💐','🌹','❤️','🎵','🍽️',
  '📸','🏨','✈️','🚗','📞','✉️','💌','🙏','👗','🤵',
  '✨','🌟','⭐','🎶','🕐','📍','🗓️','🌸','🎁','👶',
]

export default function RichTextEditor({ value, onChange }) {
  const [showEmoji, setShowEmoji] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Sync content when language switches (value prop changes externally)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || '', false)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const insertEmoji = useCallback((emoji) => {
    editor?.chain().focus().insertContent(emoji).run()
    setShowEmoji(false)
  }, [editor])

  if (!editor) return null

  const btn = (active) => ({ ...t.btn, background: active ? '#e0e0e0' : '#f5f5f5' })

  return (
    <div style={t.wrapper}>
      <div style={t.toolbar}>
        <button type="button" style={btn(editor.isActive('bold'))}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}>
          <strong>B</strong>
        </button>
        <button type="button" style={{ ...btn(editor.isActive('italic')), fontStyle: 'italic' }}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}>
          <em>I</em>
        </button>
        <div style={t.sep} />
        <button type="button" style={{ ...btn(editor.isActive('heading', { level: 2 })), fontSize: '0.75rem' }}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}>
          H2
        </button>
        <button type="button" style={{ ...btn(editor.isActive('heading', { level: 3 })), fontSize: '0.75rem' }}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run() }}>
          H3
        </button>
        <div style={t.sep} />
        <div style={{ position: 'relative' }}>
          <button type="button" style={btn(showEmoji)}
            onMouseDown={e => { e.preventDefault(); setShowEmoji(v => !v) }}>
            😊
          </button>
          {showEmoji && (
            <div style={t.emojiPanel}>
              {EMOJIS.map(emoji => (
                <button key={emoji} type="button" style={t.emojiBtn}
                  onMouseDown={e => { e.preventDefault(); insertEmoji(emoji) }}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <EditorContent editor={editor} style={t.content} />
    </div>
  )
}

const t = {
  wrapper:    { border: '1.5px solid #ddd', borderRadius: '0.4rem', overflow: 'visible' },
  toolbar:    { display: 'flex', gap: '0.25rem', alignItems: 'center', padding: '0.4rem 0.5rem', borderBottom: '1.5px solid #ddd', background: '#fafafa', borderRadius: '0.4rem 0.4rem 0 0' },
  btn:        { padding: '0.25rem 0.5rem', border: '1px solid #ddd', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.875rem', minWidth: '2rem', lineHeight: 1 },
  sep:        { width: 1, height: '1.2rem', background: '#ddd', margin: '0 0.15rem' },
  content:    { minHeight: '160px' },
  emojiPanel: { position: 'absolute', top: '110%', left: 0, zIndex: 100, background: '#fff', border: '1.5px solid #ddd', borderRadius: '0.5rem', padding: '0.4rem', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', width: '13rem' },
  emojiBtn:   { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0.2rem', borderRadius: '0.25rem', lineHeight: 1 },
}
