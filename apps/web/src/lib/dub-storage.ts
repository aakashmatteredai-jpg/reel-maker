const DB_NAME = "dub-storage";
const DB_VERSION = 1;

export async function initDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains("audio-blobs")) {
				db.createObjectStore("audio-blobs");
			}
			if (!db.objectStoreNames.contains("dub-data")) {
				db.createObjectStore("dub-data");
			}
		};
	});
}

export async function saveAudioBlob(key: string, blob: Blob): Promise<void> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction("audio-blobs", "readwrite");
		const store = transaction.objectStore("audio-blobs");
		const request = store.put(blob, key);

		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function getAudioBlob(key: string): Promise<Blob | null> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction("audio-blobs", "readonly");
		const store = transaction.objectStore("audio-blobs");
		const request = store.get(key);

		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(request.error);
	});
}

export async function saveDubData(key: string, data: unknown): Promise<void> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction("dub-data", "readwrite");
		const store = transaction.objectStore("dub-data");
		const request = store.put(data, key);

		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function getDubData(key: string): Promise<unknown> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction("dub-data", "readonly");
		const store = transaction.objectStore("dub-data");
		const request = store.get(key);

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function clearDubData(): Promise<void> {
	const db = await initDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(["audio-blobs", "dub-data"], "readwrite");
		transaction.objectStore("audio-blobs").clear();
		transaction.objectStore("dub-data").clear();

		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
	});
}
