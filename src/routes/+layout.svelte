<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import {taskItems, tasks, type TASK, type TASK_ITEM} from '$lib/state.svelte'
	import { collection, getDocs } from 'firebase/firestore';
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase/firebase.app';

	let { children } = $props();
	let today = new Date().toDateString()
    let loading = $state(true)

    onMount(async () => {

		const [tasksSnapshot, taskItemsSnapshot] = await Promise.all([
				getDocs(collection(db!, 'Tasks')),
				getDocs(collection(db!, 'Task Items')),
		])

        const loadedTasks = tasksSnapshot.docs.map(doc => ({id:doc.id, ...(doc.data() as Omit<TASK, 'id'>) }))
        tasks.data = loadedTasks
        const loadedTaskItems = taskItemsSnapshot.docs.map(doc => ({id:doc.id, ...(doc.data() as Omit<TASK_ITEM, 'id'>) }))
        taskItems.data = loadedTaskItems
        loading = false

    })
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="bg-gray-100 h-dvh w-full">
	<div class="w-full flex justify-center p-2">
		<span class="text-xl font-semibold text-slate-400">{today}</span>
	</div>
	<div class="flex w-full h-full">
		<div class="w-50 flex flex-col gap-4 p-3">
			<div class="bg-white rounded-lg gap-2 flex justify-center items-center shadow-lg p-2 transition-all hover:bg-slate-200 hover:shadow-xl hover:cursor-pointer">
				<span class="text-xl flex text-center font-semibold">+</span>
				<span class="">
					Create

				</span>

			</div>
			<div class="flex flex-col ">
				<div class="flex justify-between items-center">
					<span class="text-sm font-semibold text-slate-500">
						Lists
					</span>
					<div class="rounded-full w-8 h-8 transition-colors hover:cursor-pointer hover:bg-gray-200 flex items-center justify-center">

						<svg width="25px" height="25px" viewBox="0 0 24 24" class="text-slate-400" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M7 10L12 15L17 10" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
					</div>

				</div>
			</div>
		</div>
		<div class="flex-1 h-full justify-center w-full flex">
			{@render children()}

		</div>
	</div>

</div>
