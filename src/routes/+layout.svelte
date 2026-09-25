<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { children } = $props();
</script>

<header class="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
	<nav class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6" aria-label="Main navigation">
		<a href={resolve('/task-app')} class="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-800 transition-colors hover:text-blue-600">
			<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
				<svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75h6M9 12h6m-6 5.25h6M5.25 4.5A2.25 2.25 0 0 1 7.5 2.25h9a2.25 2.25 0 0 1 2.25 2.25v15A2.25 2.25 0 0 1 16.5 21.75h-9a2.25 2.25 0 0 1-2.25-2.25v-15Z" />
				</svg>
			</span>
			<span>Task App</span>
		</a>

		<div class="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
			<a
				href={resolve('/task-app')}
				class={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-4 ${page.url.pathname === '/task-app' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
				aria-current={page.url.pathname === '/task-app' ? 'page' : undefined}
			>
				<svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="m5 12 2 2 4-4m-6-5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
				</svg>
				Tasks
			</a>
			<a
				href={resolve('/routines')}
				class={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-4 ${page.url.pathname === '/routines' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
				aria-current={page.url.pathname === '/routines' ? 'page' : undefined}
			>
				<svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 9.75A7.5 7.5 0 0 1 17.25 5.1L19.5 7.5m0-4.5v4.5H15m4.5 6.75A7.5 7.5 0 0 1 6.75 18.9L4.5 16.5m0 4.5v-4.5H9" />
				</svg>
				Routines
			</a>
		</div>
	</nav>
</header>

{@render children()}
