const { collection, addDoc, updateDoc, deleteDoc, getDocs, doc, orderBy, query, serverTimestamp } = require('firebase/firestore');
const { getFirestoreInstance } = require('../../services/firebaseClient');

function col(uid) {
    const db = getFirestoreInstance();
    return collection(db, 'users', uid, 'notes');
}

async function list(uid) {
    const q = query(col(uid), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function create(uid, { title, content }) {
    const now = serverTimestamp();
    const docRef = await addDoc(col(uid), { title, content, createdAt: now, updatedAt: now });
    return { id: docRef.id };
}

async function update(id, uid, { title, content }) {
    const ref = doc(col(uid), id);
    await updateDoc(ref, { title, content, updatedAt: serverTimestamp() });
    return { changes: 1 };
}

async function del(id, uid) {
    const ref = doc(col(uid), id);
    await deleteDoc(ref);
    return { changes: 1 };
}

module.exports = { list, create, update, delete: del }; 