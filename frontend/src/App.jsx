import { useState } from 'react'

function App() {
  const [greeting, setGreeting] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState([])
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [dbStatus, setDbStatus] = useState(null)

  const fetchGreeting = async () => {
    try {
      const res = await fetch(`/api/greet?name=${name || 'world'}`)
      const data = await res.json()
      setGreeting(data.message)
    } catch (err) {
      setGreeting('Error connecting to backend')
    }
  }

  const checkHealth = async () => {
    try {
      const res = await fetch('/health')
      const data = await res.json()
      setDbStatus(data)
    } catch (err) {
      setDbStatus({ status: 'error', database: 'unreachable' })
    }
  }

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes')
      const data = await res.json()
      setNotes(data)
    } catch (err) {
      console.error('Failed to fetch notes')
    }
  }

  const createNote = async () => {
    if (!noteTitle.trim()) return
    try {
      await fetch(`/api/notes?title=${encodeURIComponent(noteTitle)}&content=${encodeURIComponent(noteContent)}`, {
        method: 'POST'
      })
      setNoteTitle('')
      setNoteContent('')
      fetchNotes()
    } catch (err) {
      console.error('Failed to create note')
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '700px', margin: '0 auto' }}>
      <h1>🎓 Learn Assist</h1>
      <p>Docker Compose Demo — Python FastAPI + PostgreSQL + React</p>

      {/* Health Check */}
      <section style={{ marginTop: '2rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px' }}>
        <h3>🔍 System Health</h3>
        <button onClick={checkHealth} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Check Health
        </button>
        {dbStatus && (
          <pre style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {JSON.stringify(dbStatus, null, 2)}
          </pre>
        )}
      </section>

      {/* Greeting */}
      <section style={{ marginTop: '2rem' }}>
        <h3>👋 Greeting API</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          style={{ padding: '0.5rem', marginRight: '0.5rem' }}
        />
        <button onClick={fetchGreeting} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Get Greeting
        </button>
        {greeting && (
          <p style={{ marginTop: '0.5rem', fontSize: '1.1rem', color: '#2563eb' }}>
            {greeting}
          </p>
        )}
      </section>

      {/* Notes (PostgreSQL) */}
      <section style={{ marginTop: '2rem', padding: '1rem', background: '#eff6ff', borderRadius: '8px' }}>
        <h3>📝 Notes (PostgreSQL)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Note title"
            style={{ padding: '0.5rem' }}
          />
          <input
            type="text"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Note content (optional)"
            style={{ padding: '0.5rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={createNote} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
              Add Note
            </button>
            <button onClick={fetchNotes} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
              Refresh
            </button>
          </div>
        </div>
        {notes.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {notes.map((note) => (
              <li key={note.id} style={{ padding: '0.5rem', borderBottom: '1px solid #ddd' }}>
                <strong>{note.title}</strong>
                {note.content && <span> — {note.content}</span>}
                <br />
                <small style={{ color: '#888' }}>{note.created_at}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default App
