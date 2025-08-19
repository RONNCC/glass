const sqliteRepository = require('./sqlite.repository');
const firebaseRepository = require('./firebase.repository');
const authService = require('../../services/authService');

function getBaseRepository() {
    const user = authService.getCurrentUser();
    if (user && user.isLoggedIn) return firebaseRepository;
    return sqliteRepository;
}

module.exports = {
    list: async () => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().list(uid);
    },
    create: async (data) => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().create(uid, data);
    },
    update: async (id, data) => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().update(id, uid, data);
    },
    delete: async (id) => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().delete(id, uid);
    },
}; 