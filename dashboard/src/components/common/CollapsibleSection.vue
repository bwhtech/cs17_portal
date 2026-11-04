<template>
	<div>
		<div class="flex flex-wrap items-center justify-end gap-x-3">
			<GroupHeader
				class="min-w-[10rem] flex-1"
				:label="label"
				:count="count"
				:expanded="expanded"
				:label-id="`${id}-label`"
				:controls="`${id}-body`"
				@toggle="expanded = !expanded"
			/>
			<div v-if="$slots.actions" class="flex items-center gap-3 pb-2 sm:pb-0">
				<slot name="actions" />
			</div>
		</div>
		<Transition
			enter-active-class="overflow-hidden transition-[height] duration-300 ease-in-out motion-reduce:transition-none"
			leave-active-class="overflow-hidden transition-[height] duration-300 ease-in-out motion-reduce:transition-none"
			@enter="growToContent"
			@after-enter="releaseHeight"
			@leave="shrinkToZero"
			@after-leave="releaseHeight"
		>
			<div v-show="expanded" :id="`${id}-body`">
				<slot />
			</div>
		</Transition>
	</div>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import GroupHeader from '@/components/common/GroupHeader.vue'
import { growToContent, releaseHeight, shrinkToZero } from '@/lib/collapse'

defineProps<{ label: string; count: number }>()

const id = useId()
const expanded = ref(false)
</script>
