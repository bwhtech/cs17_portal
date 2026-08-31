<template>
	<Sidebar width="14rem" class="border-r border-outline-gray-1">
		<div class="flex items-center gap-2 px-4 py-3.5">
			<img :src="logoUrl" alt="CS17" class="h-5 dark:invert" />
			<Badge label="Beta" theme="blue" variant="subtle" size="sm" />
		</div>

		<div class="px-2 pb-3 pt-1">
			<Dropdown :options="accountOptions" align="start" match-trigger-width>
				<template #trigger="{ open }">
					<button
						class="flex w-full items-center gap-2.5 rounded-4 px-2 py-1.5 text-left hover:bg-surface-gray-2"
						:class="open && 'bg-surface-gray-2'"
					>
						<Avatar
							size="lg"
							:image="profile?.profile_picture ?? undefined"
							:label="profile?.full_name ?? ''"
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate text-base font-medium text-ink-gray-8">
								{{ profile?.full_name ?? '—' }}
							</p>
							<p class="mt-0.5 truncate text-xs text-ink-gray-5">{{ roleLine }}</p>
						</div>
						<span
							class="lucide-chevrons-up-down size-3.5 shrink-0 text-ink-gray-5"
							aria-hidden="true"
						/>
					</button>
				</template>
			</Dropdown>
		</div>

		<ScrollArea class="min-h-0 flex-1" viewport-class="px-1 pb-10 pt-2">
			<SidebarSection
				v-for="section in nav.sections"
				:key="section.label"
				:label="section.label"
			>
				<SidebarItem
					v-for="item in section.items"
					:key="item.label"
					:icon="item.icon"
					:label="item.label"
					:to="item.to"
					:active="isNavItemActive(item, route.path)"
					@click="item.href && openExternal(item.href)"
				>
					<template v-if="item.href" #suffix>
						<span
							class="lucide-external-link mr-1 size-3 text-ink-gray-4"
							aria-hidden="true"
						/>
					</template>
				</SidebarItem>
			</SidebarSection>

			<Divider class="my-2" />

			<SidebarSection>
				<SidebarItem
					:icon="nav.announcements.icon"
					:label="nav.announcements.label"
					:to="nav.announcements.to"
					:active="isNavItemActive(nav.announcements, route.path)"
				/>
			</SidebarSection>
		</ScrollArea>
	</Sidebar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
	Avatar,
	Badge,
	Divider,
	Dropdown,
	ScrollArea,
	Sidebar,
	SidebarItem,
	SidebarSection,
	dialog,
} from 'frappe-ui'
import logoUrl from '@/assets/CS17.svg'
import { isNavItemActive, navConfig } from '@/components/shell/nav'
import { useSession } from '@/composables/useSession'
import { useSettingsDialog } from '@/composables/useSettingsDialog'

const route = useRoute()
const { profile, isFaculty, cohort, logout } = useSession()
const settings = useSettingsDialog()

const nav = computed(() => navConfig(isFaculty.value))
// Students are identified by their cohort, faculty simply by the role.
const roleLine = computed(() => (isFaculty.value ? 'Faculty' : `cohort '${cohort.value ?? '—'}'`))

const accountOptions = [
	{ label: 'Settings', icon: 'lucide-settings', onClick: () => settings.open() },
	{
		label: 'Log out',
		icon: 'lucide-log-out',
		theme: 'red' as const,
		onClick: () =>
			dialog.danger({
				title: 'Log out',
				message: 'Are you sure you want to log out?',
				confirmLabel: 'Log out',
				onConfirm: () => logout(),
			}),
	},
]

function openExternal(href: string) {
	window.open(href, '_blank', 'noopener')
}
</script>
