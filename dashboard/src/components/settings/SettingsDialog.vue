<template>
	<Dialog v-model:open="isOpen" title="Settings" size="lg">
		<div class="space-y-8">
			<section class="space-y-3">
				<h3 class="text-sm font-medium text-ink-gray-5">Profile</h3>
				<div class="flex items-center gap-3">
					<Avatar
						size="2xl"
						:image="profile?.profile_picture ?? undefined"
						:label="profile?.full_name ?? ''"
					/>
					<div class="min-w-0">
						<p class="truncate text-base font-medium text-ink-gray-8">
							{{ profile?.full_name ?? '—' }}
						</p>
						<p class="mt-1 truncate text-p-sm text-ink-gray-5">{{ roleLine }}</p>
					</div>
				</div>
			</section>

			<section class="space-y-3">
				<h3 class="text-sm font-medium text-ink-gray-5">Appearance</h3>
				<Switch
					v-model="isDark"
					size="md"
					label="Dark mode"
					description="Switch between light and dark theme"
				/>
			</section>

			<section class="space-y-3">
				<h3 class="text-sm font-medium text-ink-gray-5">Account</h3>
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="min-w-0">
						<p class="text-base font-medium text-ink-gray-8">Log out</p>
						<p class="mt-1 text-p-sm text-ink-gray-5">
							End this session and return to the login page.
						</p>
					</div>
					<Button theme="red" variant="subtle" label="Log out" @click="confirmLogout" />
				</div>
			</section>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
	Avatar,
	Button,
	Dialog,
	Switch,
	dialog,
	resolvedColorScheme,
	useColorScheme,
} from 'frappe-ui'
import { useSession } from '@/composables/useSession'
import { useSettingsDialog } from '@/composables/useSettingsDialog'

// One dialog for both roles: the only thing that differs is the line under
// the name, so there is nothing to branch on beyond it.
const { profile, isFaculty, cohort, logout } = useSession()
const roleLine = computed(() => (isFaculty.value ? 'Faculty' : `cohort '${cohort.value ?? '—'}'`))

const { isOpen } = useSettingsDialog()
const { colorScheme, setColorScheme } = useColorScheme()

/**
 * The switch is a light/dark toggle, but the stored preference has a third
 * value (`system`, the default until someone picks). Reading through the
 * resolved scheme is what keeps the switch showing what the app is actually
 * painted in; flipping it commits to an explicit choice.
 */
const isDark = computed({
	get: () =>
		colorScheme.value === 'system'
			? resolvedColorScheme() === 'dark'
			: colorScheme.value === 'dark',
	set: (next: boolean) => setColorScheme(next ? 'dark' : 'light'),
})

function confirmLogout(): void {
	dialog.danger({
		title: 'Log out',
		message: 'Are you sure you want to log out?',
		confirmLabel: 'Log out',
		// `logout()` navigates to /login, so the dialog never has to close
		// itself — the promise stays pending until the page unloads.
		onConfirm: () => logout(),
	})
}
</script>
