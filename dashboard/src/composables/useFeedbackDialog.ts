import { ref } from 'vue'

const isOpen = ref(false)

export function useFeedbackDialog(): {
	isOpen: typeof isOpen
	open(): void
} {
	return {
		isOpen,
		open: () => {
			isOpen.value = true
		},
	}
}
