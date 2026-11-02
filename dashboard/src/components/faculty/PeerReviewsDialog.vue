<template>
	<Dialog
		:open="open"
		title="Peer review"
		:size="started ? '2xl' : 'md'"
		@update:open="emit('update:open', $event)"
	>
		<div class="space-y-4">
			<LoadError
				v-if="failed"
				title="Could not load the reviews"
				:loading="reviews.loading"
				@retry="reviews.reload()"
			/>

			<div v-else-if="!reviews.data" class="cs17-delay-in">
				<Skeleton class="h-24 w-full rounded-4" />
			</div>

			<ul v-else-if="started" class="space-y-5">
				<li v-for="group in groups" :key="group.submission">
					<h3 class="text-base font-medium text-ink-gray-8">{{ group.studentName }}</h3>
					<ul class="mt-2 space-y-2">
						<li
							v-for="review in group.reviews"
							:key="review.name"
							class="rounded-4 border border-outline-gray-1 p-3"
						>
							<div class="flex items-center gap-2">
								<span class="min-w-0 flex-1 truncate text-base text-ink-gray-8">
									{{ review.reviewer_name }}
								</span>
								<Badge v-bind="reviewState(review)" variant="subtle" />
								<Button
									class="hover:!bg-surface-red-3 hover:!text-ink-red-7"
									variant="ghost"
									icon="lucide-trash-2"
									tooltip="Remove review"
									:aria-label="`Remove review by ${review.reviewer_name}`"
									@click="confirmRemove(review)"
								/>
							</div>
							<dl v-if="review.submitted_on" class="mt-2 space-y-2">
								<div>
									<dt class="text-xs text-ink-gray-5">What works well</dt>
									<dd
										class="whitespace-pre-line text-p-sm text-ink-gray-8"
										dir="auto"
									>
										{{ review.strengths }}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-ink-gray-5">One thing to improve</dt>
									<dd
										class="whitespace-pre-line text-p-sm text-ink-gray-8"
										dir="auto"
									>
										{{ review.improvement }}
									</dd>
								</div>
							</dl>
						</li>
					</ul>
				</li>
			</ul>

			<template v-else>
				<p class="text-p-sm text-ink-gray-5">
					Each student reads classmates' code and says what works well and one thing to
					improve. Students never see who wrote the code or the review.
				</p>
				<FormControl
					v-model="reviewersPerSubmission"
					type="select"
					label="Reviewers per submission"
					:options="REVIEWER_OPTIONS"
				/>
			</template>

			<ErrorMessage :message="error" />
		</div>

		<template v-if="reviews.data" #actions>
			<Button
				v-if="started"
				class="w-full"
				variant="solid"
				theme="gray"
				label="Share reviews with students"
				:loading="share.loading"
				@click="shareReviews"
			/>
			<Button
				v-else
				class="w-full"
				variant="solid"
				theme="gray"
				label="Start"
				:loading="start.loading"
				@click="startReview"
			/>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
	Badge,
	Button,
	Dialog,
	ErrorMessage,
	FormControl,
	Skeleton,
	dialog,
	toast,
	useCall,
} from 'frappe-ui'
import LoadError from '@/components/common/LoadError.vue'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'

interface PeerReview {
	name: string
	submission: string
	student_name: string | null
	reviewer_name: string | null
	strengths: string | null
	improvement: string | null
	submitted_on: string | null
	shared_on: string | null
}

const REVIEWER_OPTIONS = ['1', '2', '3']

const props = defineProps<{ open: boolean; assignment: string }>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const reviews = useCall<PeerReview[], { assignment: string }>({
	url: '/api/v2/method/cs17_portal.peer_review.get_peer_reviews',
	params: () => ({ assignment: props.assignment }),
})

const failed = useLoadFailed(reviews)
const started = computed(() => Boolean(reviews.data?.length))

const groups = computed(() => {
	const bySubmission = new Map<
		string,
		{ submission: string; studentName: string; reviews: PeerReview[] }
	>()
	for (const review of reviews.data ?? []) {
		const group = bySubmission.get(review.submission) ?? {
			submission: review.submission,
			studentName: review.student_name ?? '',
			reviews: [],
		}
		group.reviews.push(review)
		bySubmission.set(review.submission, group)
	}
	return [...bySubmission.values()]
})

function reviewState(review: PeerReview) {
	if (review.shared_on) return { label: 'Shared', theme: 'green' } as const
	if (review.submitted_on) return { label: 'Written', theme: 'blue' } as const
	return { label: 'Not written', theme: 'gray' } as const
}

const reviewersPerSubmission = ref('2')
const error = ref('')

const start = useCall<null, { assignment: string; reviewers_per_submission: number }>({
	url: '/api/v2/method/cs17_portal.peer_review.start_peer_review',
	method: 'POST',
	immediate: false,
})

const share = useCall<null, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.peer_review.share_peer_reviews',
	method: 'POST',
	immediate: false,
})

const remove = useCall<null, { review: string }>({
	url: '/api/v2/method/cs17_portal.peer_review.remove_peer_review',
	method: 'POST',
	immediate: false,
})

async function startReview() {
	error.value = ''
	await trySubmit(start, {
		assignment: props.assignment,
		reviewers_per_submission: Number(reviewersPerSubmission.value),
	})
	if (start.error) {
		error.value = frappeErrorMessage(start.error, 'Could not start peer review.')
		return
	}
	toast.success('Peer review started')
	reviews.reload()
}

async function shareReviews() {
	error.value = ''
	await trySubmit(share, { assignment: props.assignment })
	if (share.error) {
		error.value = frappeErrorMessage(share.error, 'Could not share the reviews.')
		return
	}
	toast.success('Reviews shared')
	reviews.reload()
}

function confirmRemove(review: PeerReview) {
	dialog.danger({
		title: 'Remove this review?',
		message: `${review.reviewer_name} stops seeing it, and anything written in it is lost.`,
		onConfirm: async () => {
			await trySubmit(remove, { review: review.name })
			if (remove.error) {
				toast.error(frappeErrorMessage(remove.error, 'Could not remove the review.'))
				return
			}
			toast.success('Review removed')
			reviews.reload()
		},
	})
}
</script>
