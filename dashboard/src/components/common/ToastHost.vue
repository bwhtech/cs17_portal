<template>
	<div
		class="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex justify-center px-4 md:bottom-6"
		role="status"
		aria-live="polite"
	>
		<Transition
			mode="out-in"
			enter-active-class="transition duration-[400ms] ease-[--toast-spring]"
			leave-active-class="transition duration-[400ms] ease-[--toast-spring]"
			enter-from-class="translate-y-1.5 scale-95 opacity-0"
			leave-to-class="translate-y-1.5 scale-95 opacity-0"
		>
			<PillToast
				v-if="currentToast"
				:key="currentToast.id"
				class="pointer-events-auto w-[360px] max-w-full"
				:toast="currentToast"
				:expanded="expanded"
				@action="runAction"
				@mouseenter="pause"
				@mouseleave="resume"
			/>
		</Transition>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import PillToast from '@/components/common/PillToast.vue'
import { currentToast } from '@/lib/toast'

const EXPAND_DELAY_MS = 150
const COLLAPSE_BEFORE_END_MS = 1500

const expanded = ref(false)

let timers: number[] = []

function later(ms: number, run: () => void) {
	timers.push(window.setTimeout(run, ms))
}

function clearTimers() {
	timers.forEach((timer) => window.clearTimeout(timer))
	timers = []
}

function dismiss() {
	currentToast.value = null
}

function schedule(expandAfter: number, duration: number) {
	if (expandAfter >= 0) later(expandAfter, () => (expanded.value = true))
	later(duration - COLLAPSE_BEFORE_END_MS, () => (expanded.value = false))
	later(duration, dismiss)
}

function pause() {
	clearTimers()
	expanded.value = true
}

function resume() {
	clearTimers()
	schedule(-1, COLLAPSE_BEFORE_END_MS * 2)
}

function runAction() {
	const action = currentToast.value?.action
	dismiss()
	action?.onClick()
}

watch(currentToast, (toast) => {
	clearTimers()
	expanded.value = false
	if (toast) schedule(EXPAND_DELAY_MS, toast.duration)
})

onBeforeUnmount(clearTimers)
</script>
