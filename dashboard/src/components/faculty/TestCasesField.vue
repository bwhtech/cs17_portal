<template>
	<div class="space-y-2">
		<FormLabel label="Tests" />
		<p class="text-p-sm text-ink-gray-5">
			Each test gives the program some input and checks what it prints. Students see the tests
			that are not hidden as examples.
		</p>

		<div
			v-for="(test, index) in tests"
			:key="index"
			class="space-y-3 rounded-4 border border-outline-gray-1 p-3"
		>
			<div class="flex items-center gap-3">
				<p class="text-base text-ink-gray-8">Test {{ index + 1 }}</p>
				<Checkbox
					class="ml-auto"
					label="Hidden"
					:model-value="test.is_hidden ?? 0"
					@update:model-value="update(index, { is_hidden: $event ? 1 : 0 })"
				/>
				<Button
					variant="ghost"
					icon="lucide-trash-2"
					class="hover:!bg-surface-red-3 hover:!text-ink-red-7"
					:aria-label="`Remove test ${index + 1}`"
					tooltip="Remove"
					@click="tests = tests.filter((_, position) => position !== index)"
				/>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<Textarea
					class="[&_textarea]:font-mono"
					label="Input"
					:rows="3"
					:model-value="test.input"
					spellcheck="false"
					@update:model-value="update(index, { input: String($event ?? '') })"
				/>
				<Textarea
					class="[&_textarea]:font-mono"
					label="Expected output"
					:rows="3"
					:model-value="test.expected_output"
					spellcheck="false"
					@update:model-value="update(index, { expected_output: String($event ?? '') })"
				/>
			</div>
		</div>

		<Button
			icon-left="lucide-plus"
			label="Add test"
			@click="tests = [...tests, { input: '', expected_output: '', is_hidden: 0 }]"
		/>
	</div>
</template>

<script setup lang="ts">
import { Button, Checkbox, FormLabel, Textarea } from 'frappe-ui'
import type { PythonTestCase } from '@/types'

const tests = defineModel<PythonTestCase[]>({ required: true })

function update(index: number, change: Partial<PythonTestCase>) {
	tests.value = tests.value.map((test, position) =>
		position === index ? { ...test, ...change } : test,
	)
}
</script>
