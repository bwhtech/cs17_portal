<template>
	<Sidebar width="14rem" class="border-r border-outline-gray-1">
		<div class="flex items-center gap-2 px-4 py-3.5">
			<img :src="logoUrl" alt="CS17" class="h-5 dark:invert" />
			<Badge label="Beta" theme="blue" variant="subtle" size="sm" />
		</div>

		<div class="flex items-center gap-2.5 px-4 pb-3 pt-1">
			<Avatar
				size="lg"
				:image="profile?.profile_picture ?? undefined"
				:label="profile?.full_name ?? ''"
			/>
			<div class="min-w-0">
				<p class="truncate text-base font-medium text-ink-gray-8">
					{{ profile?.full_name ?? '—' }}
				</p>
				<p class="mt-0.5 truncate text-xs text-ink-gray-5">{{ roleLine }}</p>
			</div>
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
import { Avatar, Badge, Divider, ScrollArea, Sidebar, SidebarItem, SidebarSection } from 'frappe-ui'
import logoUrl from '@/assets/CS17.svg'
import { isNavItemActive, navConfig } from '@/components/shell/nav'
import { useSession } from '@/composables/useSession'

const route = useRoute()
const { profile, isFaculty, cohort } = useSession()

const nav = computed(() => navConfig(isFaculty.value))
// Students are identified by their cohort, faculty simply by the role.
const roleLine = computed(() => (isFaculty.value ? 'Faculty' : `cohort '${cohort.value ?? '—'}`))

function openExternal(href: string) {
	window.open(href, '_blank', 'noopener')
}
</script>
