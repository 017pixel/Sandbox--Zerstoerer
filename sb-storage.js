/**
 * CodeX Storage Module - IndexedDB for Sandbox Zerstörer
 * Stores: 
 * - User Worlds (Grid blocks)
 * - App Settings (Colors, Speed, Brush size)
 * - UI State (Selected tools, Active extra tools)
 */

const DB_NAME = 'SandboxZerstörerDB';
const DB_VERSION = 1;

class SandboxStorage {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Worlds: { id: string, name: string, data: Uint8Array, timestamp: number }
                if (!db.objectStoreNames.contains('worlds')) {
                    db.createObjectStore('worlds', { keyPath: 'id' });
                }
                // Settings: { key: string, value: any }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    // --- WORLDS ---
    async saveWorld(id, name, gridData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['worlds'], 'readwrite');
            const store = transaction.objectStore('worlds');
            const world = {
                id,
                name,
                data: gridData,
                timestamp: Date.now()
            };
            const request = store.put(world);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllWorlds() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['worlds'], 'readonly');
            const store = transaction.objectStore('worlds');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteWorld(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['worlds'], 'readwrite');
            const store = transaction.objectStore('worlds');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // --- SETTINGS / STATE ---
    async saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    }
}

// Global instance
const dbStorage = new SandboxStorage();
dbStorage.init().catch(err => console.error("Database failed to initialize", err));
