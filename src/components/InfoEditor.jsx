import RichTextEditor from './RichTextEditor'

export default function InfoEditor({ draft, onChange }) {
  return <RichTextEditor value={draft} onChange={onChange} />
}
