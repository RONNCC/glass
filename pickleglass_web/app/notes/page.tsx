"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/utils/auth";
import { getNotes as apiGetNotes, createNote as apiCreateNote, updateNote as apiUpdateNote, deleteNote as apiDeleteNote, NoteItem } from "@/utils/api";

type UiNote = { id: string; title: string; content: string };

export default function NotesPage() {
  const { user, mode } = useAuth();
  const isCloud = mode === 'firebase' && (user?.uid || 'default_user') !== 'default_user';

  const [notes, setNotes] = useState<UiNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [seeded, setSeeded] = useState(false);

  const ensureSeedIfEmpty = async (current: UiNote[]) => {
    if (current.length > 0 || seeded) return current;
    const sample: { title: string; content: string } = {
      title: 'Sample note',
      content: '# Welcome to Notes\n\nUse this page to manage notes.\n\n- Markdown supported (lists, code blocks, links)\n- Click a note to edit; press Save to keep changes.'
    };
    await apiCreateNote(sample);
    setSeeded(true);
    const refreshed = await apiGetNotes();
    return refreshed.map((n: NoteItem) => ({ id: n.id, title: n.title, content: n.content }));
  };

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const data = await apiGetNotes();
      let mapped = data.map((n: NoteItem) => ({ id: n.id, title: n.title, content: n.content }));
      mapped = await ensureSeedIfEmpty(mapped);
      setNotes(mapped);
    } catch (e: any) {
      setError(e?.message || "Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadNotes(); }, [user?.uid, mode]);

  const onCreate = async () => {
    if (!title.trim()) return;
    try {
      await apiCreateNote({ title, content });
      setTitle(""); setContent(""); setEditingId(null);
      await loadNotes();
    } catch (e: any) { setError(e?.message || "Failed to create note"); }
  };

  const onUpdate = async () => {
    if (!editingId) return;
    try {
      await apiUpdateNote(editingId, { title, content });
      await loadNotes();
    } catch (e: any) { setError(e?.message || "Failed to update note"); }
  };

  const onDelete = async (id: string) => {
    try {
      await apiDeleteNote(id);
      if (editingId === id) { setEditingId(null); setTitle(""); setContent(""); }
      await loadNotes();
    } catch (e: any) { setError(e?.message || "Failed to delete note"); }
  };

  const startEdit = (id: string) => { const n = notes.find(n => n.id === id); if (!n) return; setEditingId(id); setTitle(n.title); setContent(n.content); };
  const cancelEdit = () => { setEditingId(null); setTitle(""); setContent(""); };
  const startNew = () => { setEditingId(null); setTitle(''); setContent(''); };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#282828]">Notes</h1>
        <span className={`text-xs px-2 py-1 rounded-full ${isCloud ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>{isCloud ? 'Cloud' : 'Local'}</span>
      </div>

      {error && (<div className="mb-4 text-red-600 text-sm">{error}</div>)}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <div className="border rounded-lg p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-[#282828]">Your Notes</h2>
              <div className="flex items-center gap-2">
                <button className="text-xs px-2 py-1 rounded bg-[#f2f2f2] hover:bg-[#e9e9e9]" onClick={() => loadNotes()}>Refresh</button>
                <button className="text-xs px-2 py-1 rounded bg-black text-white hover:opacity-90" onClick={startNew}>New</button>
              </div>
            </div>
            {isLoading ? (
              <div className="text-gray-500 text-sm">Loading…</div>
            ) : notes.length === 0 ? (
              <div className="text-gray-500 text-sm">No notes yet</div>
            ) : (
              <ul className="space-y-1">
                {notes.map(n => (
                  <li key={n.id} className={`flex items-center justify-between rounded px-2 py-1 ${editingId === n.id ? 'bg-[#f7f7f7]' : ''}`}>
                    <button className="text-left text-sm truncate flex-1 mr-2 text-[#282828]" onClick={() => startEdit(n.id)}>
                      {n.title || '(untitled)'}
                    </button>
                    <button className="text-xs text-red-600 hover:text-red-700" onClick={() => onDelete(n.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="border rounded-lg p-3 bg-white">
            <h2 className="text-sm font-medium mb-2 text-[#282828]">{editingId ? 'Edit Note' : 'New Note'}</h2>
            <div className="space-y-2">
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full border rounded px-2 py-1 text-sm" />
              <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write markdown here…" rows={14} className="w-full border rounded px-2 py-1 text-sm font-mono" />
              <div className="flex gap-2 justify-end">
                {editingId && (<button className="px-3 py-1 text-sm rounded bg-[#f2f2f2] hover:bg-[#e9e9e9]" onClick={cancelEdit}>Cancel</button>)}
                {editingId ? (
                  <button className="px-3 py-1 text-sm rounded bg-black text-white hover:opacity-90" onClick={onUpdate}>Save</button>
                ) : (
                  <button className="px-3 py-1 text-sm rounded bg-black text-white hover:opacity-90" onClick={onCreate}>Create</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 