const express = require('express');
const router = express.Router();
const { ipcRequest } = require('../ipcBridge');

router.get('/', async (req, res) => {
  try {
    const notes = await ipcRequest(req, 'notes:list');
    res.json(notes);
  } catch (error) {
    console.error('Failed to get notes via IPC:', error);
    res.status(500).json({ error: 'Failed to retrieve notes' });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await ipcRequest(req, 'notes:create', req.body);
    res.status(201).json({ ...result, message: 'Note created successfully' });
  } catch (error) {
    console.error('Failed to create note via IPC:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await ipcRequest(req, 'notes:update', { id: req.params.id, ...req.body });
    res.json({ message: 'Note updated successfully' });
  } catch (error) {
    console.error('Failed to update note via IPC:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await ipcRequest(req, 'notes:delete', { id: req.params.id });
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Failed to delete note via IPC:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router; 