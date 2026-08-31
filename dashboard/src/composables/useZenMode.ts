import { onMounted, onUnmounted, ref, type Ref } from 'vue'

/**
 * Zen mode hides the sidebar and header so the Scratch editor and the grading
 * workspace get the whole viewport. A module singleton: the shell reads the
 * same ref the page writes.
 */
const isZen: Ref<boolean> = ref(false)

export function useZenMode(): { isZen: Ref<boolean>; toggle: () => void } {
	return {
		isZen,
		toggle: () => {
			isZen.value = !isZen.value
		},
	}
}

/** For a page that opens in zen mode and gives it back when it unmounts. */
export function useZenOnMount(): void {
	onMounted(() => {
		isZen.value = true
	})
	onUnmounted(() => {
		isZen.value = false
	})
}
