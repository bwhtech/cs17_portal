<template>
	<Combobox
		v-bind="$attrs"
		:model-value="modelValue || null"
		:options="options"
		@update:model-value="emit('update:modelValue', $event === null ? '' : String($event))"
		@update:open="$event && topicsCall.reload()"
	>
		<template v-if="$slots.trigger" #trigger>
			<slot name="trigger" />
		</template>
		<template #item-create="{ query }">Create “{{ query.trim() }}”</template>
	</Combobox>

	<Dialog v-model:open="dialogOpen" size="sm" title="New topic">
		<template #default>
			<FormControl
				v-model="newTopicName"
				type="text"
				label="Name"
				placeholder="Loops"
				maxlength="140"
				autofocus
				required
				:error="nameError"
				@keydown.enter="createFromDialog"
			/>
		</template>

		<template #actions="{ close }">
			<div class="flex justify-end gap-2">
				<Button label="Cancel" @click="close" />
				<Button
					variant="solid"
					theme="gray"
					label="Create"
					:loading="createCall.loading"
					@click="createFromDialog"
				/>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button, Combobox, Dialog, FormControl, toast, useCall } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

defineOptions({ inheritAttrs: false })

defineProps<{ modelValue: string }>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const dialogOpen = ref(false)
const newTopicName = ref('')
const nameError = ref('')

const topicsCall = useCall<string[]>({
	url: '/api/v2/method/cs17_portal.api.get_topics',
	method: 'GET',
})

const createCall = useCall<string, { topic_name: string }>({
	url: '/api/v2/method/cs17_portal.api.create_topic',
	method: 'POST',
	immediate: false,
})

const topics = computed(() => topicsCall.data ?? [])

const options = computed(() => [
	{ label: 'No topic', value: '' },
	...topics.value.map((topic) => ({ label: topic, value: topic })),
	{
		type: 'custom' as const,
		key: 'create',
		label: 'Create topic',
		slot: 'create',
		condition: ({ query }: { query: string }) => isNewTopic(query),
		onClick: ({ query }: { query: string }) => createFromSearch(query.trim()),
	},
	{
		type: 'custom' as const,
		key: 'new',
		label: 'New topic',
		icon: 'lucide-plus',
		condition: ({ query }: { query: string }) => !query.trim(),
		onClick: openDialog,
	},
])

function isNewTopic(query: string): boolean {
	const name = query.trim().toLowerCase()
	return Boolean(name) && !topics.value.some((topic) => topic.toLowerCase() === name)
}

async function createTopic(topicName: string) {
	const topic = await trySubmit(createCall, { topic_name: topicName })
	if (topic) {
		topicsCall.reload()
		emit('update:modelValue', topic)
	}
	return topic
}

async function createFromSearch(topicName: string) {
	if (!(await createTopic(topicName))) {
		toast.error(frappeErrorMessage(createCall.error, 'Could not create the topic.'))
	}
}

function openDialog() {
	newTopicName.value = ''
	nameError.value = ''
	dialogOpen.value = true
}

async function createFromDialog() {
	const name = newTopicName.value.trim()
	if (!name) {
		nameError.value = 'Name is required.'
		return
	}
	const existing = topics.value.find((topic) => topic.toLowerCase() === name.toLowerCase())
	if (existing) {
		nameError.value = `${existing} already exists.`
		return
	}
	if (await createTopic(name)) {
		dialogOpen.value = false
		return
	}
	nameError.value = frappeErrorMessage(createCall.error, 'Could not create the topic.')
}
</script>
