<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { auth, db } from '$lib/firebase/firebase.app';
	import { taskItems, tasks, user, type TASK, type TASK_ITEM } from '$lib/state.svelte';
	import { browserLocalPersistence, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup } from 'firebase/auth';
	import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where, } from 'firebase/firestore';
	import { onMount } from 'svelte';
	import './layout.css';



	let { children } = $props();
    let loading = $state(true)
	let showList = $state<boolean>(true)
	let newListModal:HTMLDialogElement
	let newTaskTitle = $state('')
	let newTaskColor = $state('#ffffff')

	let createModal:HTMLDialogElement

	let newTask = $state < TASK_ITEM > ({
    id: '',
    task_id: '',
    title: '',
    description: '',
    date: '',
    order: null,
    completed: false,
	userId: '',
	time: ''
})


let loggedIn = $state<boolean>(false)

	async function logIn() {
		const provider = new GoogleAuthProvider()

		await setPersistence(auth, browserLocalPersistence).then(() => {

			return signInWithPopup(auth, provider).then((result) => {
				user!.data = result.user
				loggedIn = true})
		});


	}

	async function getData() {

		const taskQ = query(collection(db!, 'Tasks'),  where('userId', '==', user.data?.uid), orderBy('dateCreated', 'asc'))
		const taskItemsQ = query(collection(db!, 'Task Items'), where('userId', '==', user.data?.uid), orderBy('order', 'asc'))



		const [tasksSnapshot, taskItemsSnapshot] = await Promise.all([
				getDocs(taskQ),
				getDocs(taskItemsQ),
		])

        const loadedTasks = tasksSnapshot.docs.map(doc => ({id:doc.id, ...(doc.data() as Omit<TASK, 'id'>) }))
        tasks.data = loadedTasks
		tasks.data.forEach(task => task.show = true)
		const todayTask = tasks.data.find(task => task.Name === 'Today')
		const todayDate = new Date().toLocaleDateString()
        const loadedTaskItems = taskItemsSnapshot.docs.map(doc => ({id:doc.id, ...(doc.data() as Omit<TASK_ITEM, 'id'>) }))
        taskItems.data = loadedTaskItems
		if (todayTask) {

			taskItems.data.forEach(item => {
				   const [year, month, day] = item.date.split("-").map(Number);
    				const itemsDate = new Date(year, month - 1, day).toLocaleDateString();
					console.log('item date', itemsDate)
					console.log('todays date', todayDate)
				if (itemsDate === todayDate && item.task_id !== todayTask?.id) {
					const itemsTask = tasks.data.find(task => task.id === item.task_id)
					const todayTaskItemsCount = taskItems.data.filter(i => i.task_id === todayTask?.id).length
					item.task_id = todayTask.id
					item.title = item.title + `(${itemsTask?.Name})`
					const itemDocRef = doc(db!, 'Task Items', item.id)
					updateDoc(itemDocRef, {task_id: todayTask.id, title: item.title , order: todayTaskItemsCount})
				}
			})
		}
		//if todayTask does not exist, create
		else {
		const taskQ = query(collection(db!, 'Tasks'),  where('userId', '==', user.data?.uid), orderBy('dateCreated', 'asc'))
		tasks.data.push({id: '', Name: 'Today', show: true, color: '#ffffff', userId: user.data!.uid!})
		try {
			await addDoc(collection(db!, 'Tasks'), {Name: 'Today', dateCreated: serverTimestamp(), color: '#ffffff' , userId: user.data!.uid!})
			const tasksSnapshot = await getDocs(taskQ)
			const loadedTasks = tasksSnapshot.docs.map(doc => ({id:doc.id, ...(doc.data() as Omit<TASK, 'id'>) }))
			tasks.data = loadedTasks
			tasks.data.forEach(task => task.show = true)
			newTaskTitle = ''
			newTaskColor = '#ffffff'

		} catch (error) {
			console.error(error);
		}
		}
        loading = false
	}



    onMount(async () => {

		onAuthStateChanged(auth, (result) => {
			console.log(result)
		if (result) {
			user.data = result;
			loggedIn = true;
			getData()
		} else {
			user.data = null;
			loggedIn = false;
		}
});


    })

	async function addTask(e:Event) {
		e.preventDefault()
		const taskQ = query(collection(db!, 'Tasks'),  where('userId', '==', user.data?.uid), orderBy('dateCreated', 'asc'))
		tasks.data.push({id: '', Name: newTaskTitle, show: true, color: newTaskColor, userId: user.data!.uid!})
		newListModal.close()
		try {
			await addDoc(collection(db!, 'Tasks'), {Name: newTaskTitle, dateCreated: serverTimestamp(), color: newTaskColor, userId: user.data!.uid!})
			const tasksSnapshot = await getDocs(taskQ)
			const loadedTasks = tasksSnapshot.docs.map(doc => ({id:doc.id, ...(doc.data() as Omit<TASK, 'id'>) }))
			tasks.data = loadedTasks
			tasks.data.forEach(task => task.show = true)
			newTaskTitle = ''
			newTaskColor = '#ffffff'

		} catch (error) {
			console.error(error);
		}

	}

	async function addNewTaskItem() {
    if (db) {
        createModal.close()
		taskItems.data.push({
			...newTask,
		});
        try {
            const docRef = await addDoc(collection(db, "Task Items"), {
                task_id: newTask.task_id,
                title: newTask.title,
                description: newTask.description,
                date: newTask.date,
				time: newTask.time,
                order: tasks.data.filter(item => item.id ===  newTask.task_id).length,
                completed: newTask.completed,
				userId: user.data!.uid!
            });
			taskItems.data[taskItems.data.length -1].id = docRef.id
            newTask = {
                id: '',
                task_id: '',
                title: '',
                description: '',
                date: '',
				time: '',
                order: null,
                completed: false,
				userId: user.data!.uid
            }

        } catch (error) {
            console.error(error);
        }
    }
}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<dialog bind:this={createModal} class="rounded-lg m-auto shadow-2xl backdrop:bg-black/50">
	<div class="w-96 p-6">
	<form method="post" onsubmit={(e) => {addNewTaskItem(); e.preventDefault();}}>
		<div class="flex flex-col gap-2">
			<input required bind:value={newTask.title} type="text" name="title" id="title" placeholder="Enter title..." class="bg-gray-200 rounded-lg border-none">
			<textarea required bind:value={newTask.description} name="description" id="description" placeholder="Enter description..." class="bg-gray-200 rounded-lg border-none"></textarea>
			<div class="flex flex-col gap-1">
				<label for="date">Date</label>
				<input bind:value={newTask.date} type="date" name="date" id="date" class="bg-gray-200 rounded-lg border-none">
			</div>
			<div class="flex flex-col gap-1">
				<label for="time">Time</label>
				<input bind:value={newTask.time} type="time" name="time" id="time" class="bg-gray-200 rounded-lg border-none">
			</div>
			<div class="flex flex-col gap-1">
				<label for="task">Task</label>
				<select required bind:value={newTask.task_id} name="task" id="task" class="bg-gray-200 rounded-lg border-none">
					{#each tasks.data as task (task.id)}
						<option value={task.id}>{task.Name}</option>
					{/each}
				</select>
			</div>
			<div class="flex justify-end p-2 gap-1">
				<button type="button" onclick={() => createModal.close()} class="bg-gray-300 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors">
					Cancel
				</button>
				<button type="submit" class="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
					Save
				</button>

			</div>
		</div>
	</form>
	</div>
</dialog>

<dialog bind:this={newListModal} class="rounded-lg m-auto shadow-2xl backdrop:bg-black/50">
	<div class="w-96 p-6">
		<h2 class="text-xl font-semibold text-slate-800 mb-4">Create New List</h2>
		<form onsubmit={addTask} method="post" class="flex flex-col gap-4">
			<div class="flex flex-col gap-2">
				<label for="listName" class="text-sm font-medium text-slate-700">List Name</label>
				<input required
					type="text"
					id="listName"
					bind:value={newTaskTitle}
					placeholder="Enter list name..."
					class="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>
			<div class="flex flex-col gap-2">
				<label for="color" class="text-sm font-medium text-slate-700">Color</label>
				<input bind:value={newTaskColor}
					type="color"
					id="color"
					class=" border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>
			<div class="flex gap-3 justify-end mt-4">
				<button
					type="button"
					onclick={() => {
						newTaskTitle = '';
						newListModal.close();
					}}
					class="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
				>
					Cancel
				</button>
				<button
					type="submit"
					class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors"
				>
					Done
				</button>
			</div>
		</form>
	</div>
</dialog>
<div class="bg-gray-100 min-h-dvh w-full flex flex-col">

	<div class="flex w-full h-full flex-1">
		<div class="w-50 flex flex-col gap-4 p-3">
			<button onclick={() => createModal.showModal()} class="bg-white rounded-lg gap-2 flex justify-center items-center shadow-lg p-2 transition-all hover:bg-slate-200 hover:shadow-xl hover:cursor-pointer">
				<span class="text-xl flex text-center font-semibold">+</span>
				<span class="">
					Create

				</span>

			</button>
			<div class="flex flex-col ">
				<div class="flex justify-between items-center">
					<span class="text-sm font-semibold text-slate-500">
						Lists
					</span>
					<button type="button" onclick={() => showList = !showList} class="rounded-full w-8 h-8 transition-colors hover:cursor-pointer hover:bg-gray-200 flex items-center justify-center">

						<svg class:rotate-180={showList} width="25px" height="25px" viewBox="0 0 24 24" class="text-slate-400" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M7 10L12 15L17 10" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
					</button>

				</div>
				{#if showList}
				{#each tasks.data as task (task.id) }
				<div class="flex gap-3 items-center">
					<input bind:checked={task.show} type="checkbox" name="task-{task.id}" id="task-{task.id}" class="form-checkbox checked:bg-gray-500">
					<label class="text-sm" for="task-{task.id}">{task.Name}</label>
					<div class="text-end flex-1 me-3 text-gray-600 text-sm">
						{taskItems.data.filter(item => item.task_id === task.id).length}
					</div>
				</div>
				{/each}

				{/if}
				<button onclick={() => newListModal.showModal()} type="button" class="flex items-center gap-2 mt-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-gray-200 transition-colors hover:cursor-pointer">
					<svg width="25px" height="25px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
					</svg>
					<span class="text-sm">Create New List</span>
				</button>
			</div>
		</div>
		<div class="flex-1  justify-center w-full flex ">
		{#if loggedIn}
			{#if loading}
			<div class="flex flex-col p-4 gap-8 mt-15">

				<div class=" h-70 rounded-lg  bg-white min-w-100 shadow-sm   hover:shadow-lg hover:border hover:border-slate-400 ">
								<div class="w-40 mt-4 ms-2 rounded h-5 bg-gray-300 animate-pulse"></div>
				 <div class="flex flex-col gap-3 p-2 mt-4">
				 <div class="flex items-center gap-2">
								<div class="rounded-full w-5 h-5 bg-gray-300 animate-pulse"></div>

								<div class="w-40 rounded h-5 bg-gray-300 animate-pulse"></div>
				 </div>
				 <div class="flex items-center gap-2">
								<div class="rounded-full w-5 h-5 bg-gray-300 animate-pulse"></div>

								<div class="w-40 rounded h-5 bg-gray-300 animate-pulse"></div>
				 </div>
				 <div class="flex items-center gap-2">
								<div class="rounded-full  w-5 h-5 bg-gray-300 animate-pulse"></div>

								<div class="w-40 rounded h-5 bg-gray-300 animate-pulse"></div>
				 </div>
				 <div class="flex items-center gap-2">
								<div class="rounded-full w-5 h-5 bg-gray-300 animate-pulse"></div>

								<div class="w-40 rounded h-5 bg-gray-300 animate-pulse"></div>
				 </div>

				 </div>

				</div>
				<div class=" h-70 rounded-lg  bg-white min-w-100 shadow-sm   hover:shadow-lg hover:border hover:border-slate-400 ">
								<div class="w-40 mt-4 ms-2 rounded h-5 bg-gray-300 animate-pulse"></div>
				 <div class="flex flex-col gap-3 p-2 mt-4">
				 <div class="flex items-center gap-2">
								<div class="rounded-full w-5 h-5 bg-gray-300 animate-pulse"></div>

								<div class="w-40 rounded h-5 bg-gray-300 animate-pulse"></div>
				 </div>
				 <div class="flex items-center gap-2">
								<div class="rounded-full w-5 h-5 bg-gray-300 animate-pulse"></div>

								<div class="w-40 rounded h-5 bg-gray-300 animate-pulse"></div>
				 </div>
				 <div class="flex items-center gap-2">
								<div class="rounded-full  w-5 h-5 bg-gray-300 animate-pulse"></div>

								<div class="w-40 rounded h-5 bg-gray-300 animate-pulse"></div>
				 </div>
				 <div class="flex items-center gap-2">
								<div class="rounded-full w-5 h-5 bg-gray-300 animate-pulse"></div>

								<div class="w-40 rounded h-5 bg-gray-300 animate-pulse"></div>
				 </div>

				 </div>

				</div>
			</div>

			{:else}
				{@render children()}
			{/if}

	{:else}
	<div class="w-full  flex-1 flex items-center justify-center">

		<button onclick={logIn} class="bg-blue-600 px-2 py-1 rounded shadow text-white font-semibold">
			Log in
		</button>
	</div>
	{/if}
		</div>
	</div>


</div>
