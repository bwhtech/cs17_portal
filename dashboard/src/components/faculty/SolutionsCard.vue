<template>
	<section class="space-y-3 rounded-4 border border-outline-gray-1 bg-surface-base p-4">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0 space-y-1">
				<h2 class="text-base font-medium text-ink-gray-8">Solutions</h2>
				<p v-if="!solutions.length" class="text-p-sm text-ink-gray-5">
					Add one or more ways to solve this program.
				</p>
			</div>

			<div class="flex shrink-0 flex-wrap items-center gap-3">
				<Switch
					v-if="solutions.length"
					label="Show to students"
					:model-value="Boolean(assignment.show_solutions)"
					@update:model-value="setShown"
				/>
				<Button
					:icon-left="solutions.length ? 'lucide-pencil' : 'lucide-plus'"
					:label="solutions.length ? 'Edit' : 'Add solutions'"
					@click="editOpen = true"
				/>
			</div>
		</div>

		<SolutionTabs v-if="solutions.length" :solutions="solutions" />

		<SolutionsDialog
			v-if="editOpen"
			v-model:open="editOpen"
			:assignment="assignment"
			@saved="emit('changed')"
		/>
	</section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Switch, toast, useCall } from 'frappe-ui'
import SolutionsDialog from '@/components/faculty/SolutionsDialog.vue'
import SolutionTabs from '@/components/python/SolutionTabs.vue'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Assignment } from '@/types'

const props = defineProps<{ assignment: CS17Assignment }>()

const emit = defineEmits<{ changed: [] }>()

const editOpen = ref(false)

const solutions = computed(() => props.assignment.solutions ?? [])

const show = useCall<null, { assignment: string; show: boolean }>({
	url: '/api/v2/method/cs17_portal.api.show_solutions',
	method: 'POST',
	immediate: false,
})

async function setShown(value: boolean) {
	await trySubmit(show, { assignment: props.assignment.name, show: value })
	if (show.error) toast.error(frappeErrorMessage(show.error, 'Could not change that.'))
	emit('changed')
}
</script>
