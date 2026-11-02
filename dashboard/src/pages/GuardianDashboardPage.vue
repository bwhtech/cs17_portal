<template>
	<AppHeader title="Dashboard" />

	<PageBody width="narrow" class="space-y-6">
		<div>
			<h1 class="break-words text-2xl text-ink-gray-9">Welcome back, {{ firstName }}.</h1>
			<p class="mt-1 text-sm text-ink-gray-5">{{ today }}</p>
		</div>

		<LoadError
			v-if="failed"
			title="Could not load your children's work"
			:loading="children.loading"
			@retry="children.reload()"
		/>

		<PageSkeleton v-else-if="children.loading && !children.data" />

		<EmptyState
			v-else-if="!children.data?.length"
			icon="lucide-users"
			title="No students linked yet"
			description="Ask your child's teacher to add you as their guardian."
		/>

		<template v-else>
			<ChildCard v-for="child in children.data" :key="child.student" :child="child" />
		</template>
	</PageBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCall } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageBody from '@/components/common/PageBody.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import ChildCard, { type GuardianChildSummary } from '@/components/guardian/ChildCard.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { useSession } from '@/composables/useSession'
import { formatLongDate } from '@/lib/dates'

const { profile } = useSession()

const firstName = computed(() => profile.value?.first_name || 'Guardian')
const today = formatLongDate()

const children = useCall<GuardianChildSummary[]>({
	url: '/api/v2/method/cs17_portal.guardian.get_my_children',
})
const failed = useLoadFailed(children)
</script>
