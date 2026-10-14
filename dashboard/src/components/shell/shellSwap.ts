import { onScopeDispose } from 'vue'

const swapGuards = new Set<() => unknown>()

export function onBeforeShellSwap(guard: () => unknown): void {
	swapGuards.add(guard)
	onScopeDispose(() => swapGuards.delete(guard))
}

export async function beforeShellSwap(): Promise<void> {
	for (const guard of swapGuards) await guard()
}
