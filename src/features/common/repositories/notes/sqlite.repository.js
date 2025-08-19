const sqliteClient = require('../../services/sqliteClient');
const crypto = require('crypto');

function list(uid) {
    const db = sqliteClient.getDb();
    const sql = `SELECT * FROM notes WHERE uid = ? ORDER BY updated_at DESC`;
    return db.prepare(sql).all(uid);
}

function create(uid, { title, content }) {
    const db = sqliteClient.getDb();
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const sql = `INSERT INTO notes (id, uid, title, content, created_at, updated_at, sync_state) VALUES (?, ?, ?, ?, ?, ?, 'dirty')`;
    db.prepare(sql).run(id, uid, title, content, now, now);
    return { id };
}

function update(id, uid, { title, content }) {
    const db = sqliteClient.getDb();
    const now = Math.floor(Date.now() / 1000);
    const sql = `UPDATE notes SET title = ?, content = ?, updated_at = ?, sync_state = 'dirty' WHERE id = ? AND uid = ?`;
    const res = db.prepare(sql).run(title, content, now, id, uid);
    if (res.changes === 0) throw new Error('Note not found or permission denied');
    return { changes: res.changes };
}

function del(id, uid) {
    const db = sqliteClient.getDb();
    const sql = `DELETE FROM notes WHERE id = ? AND uid = ?`;
    const res = db.prepare(sql).run(id, uid);
    if (res.changes === 0) throw new Error('Note not found or permission denied');
    return { changes: res.changes };
}

module.exports = { list, create, update, delete: del }; 