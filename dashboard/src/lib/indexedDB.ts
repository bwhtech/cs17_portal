import { del, get, set } from 'idb-keyval'

export async function readIndexedDB<T>(key: string): Promise<T | undefined> {
	try {
		return await get<T>(key)
	} catch {
		return undefined
	}
}

export async function writeIndexedDB(key: string, value: unknown): Promise<void> {
	try {
		await set(key, value)
	} catch {
		return
	}
}

export async function removeIndexedDB(key: string): Promise<void> {
	try {
		await del(key)
	} catch {
		return
	}
}
