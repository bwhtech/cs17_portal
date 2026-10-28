<template>
	<div class="group flex items-center gap-3">
		<h2 :id="labelId" class="min-w-0 flex-1">
			<button
				type="button"
				class="flex w-full items-center gap-2 rounded-2 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
				:aria-expanded="expanded"
				:aria-controls="controls"
				@click="emit('toggle')"
			>
				<span
					class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5 transition-transform duration-200 group-hover:text-ink-gray-8"
					:class="!expanded && '-rotate-90'"
				/>
				<span class="truncate text-base-medium text-ink-gray-8">{{ label }}</span>
				<span class="shrink-0 text-base text-ink-gray-5">{{ count }}</span>
			</button>
		</h2>
		<slot />
	</div>
</template>

<script setup lang="ts">
defineProps<{
	label: string
	count: number
	expanded: boolean
	labelId: string
	controls: string
}>()

const emit = defineEmits<{ toggle: [] }>()
</script>
