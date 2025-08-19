const express = require('express');
const router = express.Router();
const { ipcRequest } = require('../ipcBridge');

router.get('/status', async (req, res) => {
    try {
        const user = await ipcRequest(req, 'get-user-profile');
        if (!user) {
            return res.status(500).json({ error: 'Default user not initialized' });
        }
        res.json({ 
            authenticated: true, 
            user: {
                id: user.uid,
                name: user.display_name
            }
        });
    } catch (error) {
        console.error('Failed to get auth status via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve auth status' });
    }
});

router.post('/signin', async (req, res) => {
    try {
        const { idToken } = req.body || {};
        if (!idToken) return res.status(400).json({ error: 'Missing idToken' });
        await ipcRequest(req, 'auth:sign-in-idtoken', { idToken });
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to sign in via IPC:', error);
        res.status(500).json({ error: 'Failed to sign in' });
    }
});

router.post('/signout', async (_req, res) => {
    try {
        await ipcRequest(_req, 'auth:sign-out');
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to sign out via IPC:', error);
        res.status(500).json({ error: 'Failed to sign out' });
    }
});

module.exports = router;
