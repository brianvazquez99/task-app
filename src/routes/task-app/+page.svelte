<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { auth, db } from '$lib/firebase/firebase.app';
	import { taskItems, tasks, user, type TASK, type TASK_ITEM, type USER_SETTING } from '$lib/state.svelte';
	import DOMPurify from 'dompurify';
	import { browserLocalPersistence, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup } from 'firebase/auth';
	import { addDoc, collection, deleteDoc, doc, DocumentReference, getDocs, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
	import { onMount } from 'svelte';
	import '../layout.css' 
// TODO: UNCOMMENT WHEN READY TO ADD EDRA
	import { createEditor, Edra } from '$lib/components/edra/shadcn/index';
	import StarterKit from '@tiptap/starter-kit';
	import { SvelteDate, SvelteMap } from "svelte/reactivity";



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
let today = $state<Date>(new Date())

setInterval(() => today = new Date(), 1000)


let backgroundColor = $state<string>("#f3f4f6")
let backgroundColorRef : DocumentReference



let userInitials = $derived(() => {
    const userInfo = user
    if (userInfo.data) {
        const name = userInfo.data.displayName
        const seperatedName = name?.split(' ')
        if (seperatedName) {
            const firstInitial = seperatedName[0][0]
            const lastInitial = seperatedName[1][0]
            return `${firstInitial}${lastInitial}`
        }
        return ''
    }
    return ''
})

	async function logIn() {
		const provider = new GoogleAuthProvider()

		await setPersistence(auth, browserLocalPersistence).then(() => {

			return signInWithPopup(auth, provider).then((result) => {
				user!.data = result.user
				loggedIn = true})
		});


	}



	async function getData() {
		const uid = user.data?.uid
		if (!uid || !db) return

		const taskQ = query(collection(db, 'Tasks'), where('userId', '==', uid), orderBy('dateCreated', 'asc'))
		const taskItemsQ = query(collection(db, 'Task Items'), where('userId', '==', uid), orderBy('order', 'asc'))
		const userQ = query(collection(db, 'User Settings'), where('userId', '==', uid))
		const [tasksSnapshot, taskItemsSnapshot, userSnapshot] = await Promise.all([
			getDocs(taskQ),
			getDocs(taskItemsQ),
			getDocs(userQ)
		])

		tasks.data = tasksSnapshot.docs.map(snapshot => ({
			id: snapshot.id,
			...(snapshot.data() as Omit<TASK, 'id'>),
			show: true
		}))
		taskItems.data = taskItemsSnapshot.docs.map(snapshot => {
			const data = snapshot.data() as Omit<TASK_ITEM, 'id'>
			return { id: snapshot.id, ...data, description: DOMPurify.sanitize(data.description ?? '') }
		})

		const userSetting = userSnapshot.docs[0]
		const settingData = userSetting?.data() as Omit<USER_SETTING, 'id'> | undefined
		if (settingData?.backgroundColor) {
			backgroundColor = settingData.backgroundColor
			backgroundColorRef = userSetting.ref
		}

		// Create missing system lists in one write and keep the generated IDs locally.
		const systemListNames = ['Today', 'This Week', 'This Month'] as const
		const missingSystemLists = systemListNames.filter(name => !tasks.data.some(task => task.Name === name))
		if (missingSystemLists.length) {
			const batch = writeBatch(db)
			for (const name of missingSystemLists) {
				const taskRef = doc(collection(db, 'Tasks'))
				batch.set(taskRef, { Name: name, dateCreated: serverTimestamp(), color: '#ffffff', userId: uid })
				tasks.data.push({ id: taskRef.id, Name: name, show: true, color: '#ffffff', userId: uid })
			}
			await batch.commit()
		}

		const taskById = new Map(tasks.data.map(task => [task.id, task]))
		const systemTasks = new Map<string, TASK>(
			tasks.data
				.filter(task => systemListNames.includes(task.Name as typeof systemListNames[number]))
				.map(task => [task.Name, task] as [string, TASK])
		)
		const todayTask = systemTasks.get('Today')
		const thisWeekTask = systemTasks.get('This Week')
		const thisMonthTask = systemTasks.get('This Month')
		const itemCounts = new Map<string, number>()
		for (const item of taskItems.data) itemCounts.set(item.task_id, (itemCounts.get(item.task_id) ?? 0) + 1)
		const nextOrder = new Map<string, number>()
		for (const systemTask of [todayTask, thisWeekTask, thisMonthTask]) {
			if (systemTask) nextOrder.set(systemTask.id, itemCounts.get(systemTask.id) ?? 0)
		}

		const now = new Date()
		const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
		const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
		const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6)
		const updates: Promise<void>[] = []
		for (const item of taskItems.data) {
			if (item.completed || !item.date) continue
			const [year, month, day] = item.date.split('-').map(Number)
			const itemDate = new Date(year, month - 1, day)
			const isToday = item.date === todayKey
			const inThisWeek = itemDate >= weekStart && itemDate <= weekEnd
			const inThisMonth = year === now.getFullYear() && month - 1 === now.getMonth()
			const targetTask = isToday ? todayTask : inThisWeek ? thisWeekTask : inThisMonth ? thisMonthTask : undefined
			if (!targetTask || item.task_id === targetTask.id) continue

			const sourceTaskName = taskById.get(item.task_id)?.Name
			item.task_id = targetTask.id
			if (sourceTaskName) item.title = `${item.title} (${sourceTaskName})`
			const order = nextOrder.get(targetTask.id) ?? 0
			nextOrder.set(targetTask.id, order + 1)
			updates.push(updateDoc(doc(db, 'Task Items', item.id), { task_id: targetTask.id, title: item.title, order }))
		}
		await Promise.all(updates)


        loading = false
	}



    onMount(async () => {

		onAuthStateChanged(auth, (result) => {
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

//TODO: INSTEAD OF ADDING NEW DOC, DO AN UPDATE IF EXISTS, ELSE CREATE
 function saveColor() {
	if (db) {
		//if background color ref already exists in db then update, else add
		if(backgroundColorRef) {
			try {
				updateDoc(backgroundColorRef, {
					backgroundColor: backgroundColor,
				userId: user.data?.uid
				})
			} catch (error) {
				console.error(error)
			}
		}
		else {
			try {
				 addDoc(collection(db, "User Settings"), {
					backgroundColor: backgroundColor,
					userId: user.data?.uid
				})

			} catch (error) {
				console.error(error)
			}

		}
	}
}

// Create editor instance
	const editor = createEditor({
		onUpdate: () => {
           newTask.description = editor?.getHTML() ?? ''
		}
	});


StarterKit.configure({
	orderedList: {
		HTMLAttributes: {
			class: 'list-decimal'
		}
	},
	bulletList: {
		HTMLAttributes: {
			class: 'list-disc'
		}
	},
	heading: {
		levels: [1, 2, 3, 4]
	},
	link: {
		openOnClick: false,
		autolink: true,
		linkOnPaste: true,
		HTMLAttributes: {
			target: '_blank',
			rel: 'noopener noreferrer nofollow'
		}
	},
	codeBlock: false
})

let addTaskModal: HTMLDialogElement
let deleteItemModal: HTMLDialogElement
let currentItemId: string



let completedItemsShowMap = $state(new Map < string, boolean > ())
let swipeOffsets = $state(new Map<string, number>())
let swipeStartX = $state<number | null>(null)
let activeSwipeId = $state<string | null>(null)

let isEditing = $state<boolean>(false)






let taskItemsMap = $derived(() => {
   const items = taskItems.data.filter(item => !item.completed)
   const itemMap = new SvelteMap< string,TASK_ITEM[] > ()
   items.forEach(item => {
       if (!itemMap.has(item.task_id)) {
           itemMap.set(item.task_id, [])
       }
       itemMap.get(item.task_id) !.push(item)
   })
   return itemMap
})

let completedTakItemsMap = $derived(() => {
   const items = taskItems.data.filter(item => item.completed)
   const itemMap = new SvelteMap< string,TASK_ITEM[] > ()
   items.forEach(item => {
       if (!itemMap.has(item.task_id)) {
           itemMap.set(item.task_id, [])
       }
       itemMap.get(item.task_id) !.push(item)
   })
   return itemMap
})

let dateFormatter = new Intl.DateTimeFormat("en-US", {
 month: "2-digit",
 day: "2-digit",
 year: "numeric",
});


function openAddNewTaskItemModal(taskId: string) {
   newTask.task_id = taskId
   const filtered = taskItems.data.filter((item) => item.task_id === newTask.task_id)
   newTask.order = filtered.length
   addTaskModal.showModal()

}
function openEditTaskItemModal(taskItem: TASK_ITEM) {
   // TODO: Find out why descirption is not populating in editor
   newTask = {...taskItem}
   editor?.commands.setContent(newTask.description)
   isEditing = true
   addTaskModal.showModal()

}

function closeModal() {
   if (isEditing) {
       isEditing = false
   }
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
           editor?.commands.clearContent()


}

function markCompleted(itemId: string) {
   const docRef = doc(db!, "Task Items", itemId)
    updateDoc(docRef, {
       completed: true
   })
}

function markNotCompleted(itemId: string) {
   const docRef = doc(db!, "Task Items", itemId)
    updateDoc(docRef, {
       completed: false
   })
}

function toggleCompletedShow(taskId: string) {
   completedItemsShowMap.set(taskId, !completedItemsShowMap.get(taskId))
   completedItemsShowMap = new SvelteMap(completedItemsShowMap)
}

function startSwipe(event: PointerEvent, itemId: string) {
   swipeStartX = event.clientX
   activeSwipeId = itemId
}

function moveSwipe(event: PointerEvent, itemId: string) {
   if (activeSwipeId !== itemId || swipeStartX === null) return

   const delta = event.clientX - swipeStartX
   const offset = Math.min(0, Math.max(-96, delta))
   const nextOffsets = new SvelteMap(swipeOffsets)
   nextOffsets.set(itemId, offset)
   swipeOffsets = nextOffsets
}

function endSwipe(itemId: string) {
   const offset = swipeOffsets.get(itemId) ?? 0
   const nextOffsets = new SvelteMap(swipeOffsets)
   nextOffsets.set(itemId, offset < -48 ? -96 : 0)
   swipeOffsets = nextOffsets
   swipeStartX = null
   activeSwipeId = null
}

function resetSwipe(itemId: string) {
   const nextOffsets = new SvelteMap(swipeOffsets)
   nextOffsets.set(itemId, 0)
   swipeOffsets = nextOffsets
}


async function addNewTask() {
   if (db) {
       addTaskModal.close()
       if (isEditing) {
           //UPDATE
           const docRef = doc(db, "Task Items", newTask.id);

           try {
               await updateDoc(docRef, {
                   task_id: newTask.task_id,
                   title: newTask.title,
                   description: newTask.description,
                   date: newTask.date,
                   order: newTask.order,
                   completed: newTask.completed,
                   userId: user.data!.uid,
                   time: newTask.time
               })
               let originalItemIndex = taskItems.data.findIndex(item => item.id === newTask.id)
               taskItems.data.splice(originalItemIndex, 1, $state.snapshot(newTask))
               editor?.commands.clearContent()
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
               console.error(error)
           }

           isEditing = false
       }
       else {
           taskItems.data.push({
               ...newTask
           });
           try {
               const docRef = await addDoc(collection(db, "Task Items"), {
                   task_id: newTask.task_id,
                   title: newTask.title,
                   description: newTask.description,
                   date: newTask.date,
                   order: newTask.order,
                   completed: newTask.completed,
                   userId: user.data!.uid,
                   time: newTask.time

               });
               taskItems.data[taskItems.data.length -1].id = docRef.id
               editor?.commands.clearContent()
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
}

function deleteTaskItem(itemId: string) {
   const docRef = doc(db!, "Task Items", itemId)
   deleteDoc(docRef)
   const index = taskItems.data.findIndex((item) => item.id === itemId)
   if (index !== -1) {
       taskItems.data.splice(index, 1)
   }
   deleteItemModal.close()

}

function formatDate(dateStr:string) :string {
   const [year, month, day] = dateStr.split("-").map(Number);
   const date = new Date(year, month - 1, day);
   return dateFormatter.format(date)
}

function getDateName(dateStr:string):string {
   const [year, month, day] = dateStr.split("-").map(Number);
   const date = new Date(year, month - 1, day);
   return date.toLocaleDateString('en-US', { weekday: 'short' })
}

function getItemDate(dateStr:string): Date {
   const [year, month, day] = dateStr.split("-").map(Number);
   const date = new SvelteDate(year, month - 1, day);
   date.setHours(0,0,0,0)
   return date
}

function todayWithZeroTime() : Date {
   const date = new SvelteDate()
   date.setHours(0,0,0,0)
   return date
}

function formatTime(time:string): string {
   const timeArr = time.split(":")
   const conversion = ((Number(timeArr[0]) + 11) % 12 + 1).toLocaleString()
   return `${conversion}:${timeArr[1]}` + (Number(timeArr[0]) <= 12 ? ' AM' : ' PM')
}



function openDeleteModal(itemId: string) {
   currentItemId = itemId
   resetSwipe(itemId)
   deleteItemModal.showModal()
}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<dialog bind:this={createModal} class="m-auto w-[min(calc(100%-2rem),32rem)] rounded-2xl border border-slate-200 p-0 shadow-2xl backdrop:bg-slate-900/40">
	<div class="p-6">
	<form method="post" onsubmit={(e) => {addNewTaskItem(); e.preventDefault();}}>
		<div class="flex flex-col gap-2">
			<input required bind:value={newTask.title} type="text" name="title" id="title" placeholder="Enter title..." class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
			<textarea bind:value={newTask.description} name="description" id="description" placeholder="Enter description..." class="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"></textarea>
			<div class="flex flex-col gap-1">
				<label for="date">Date</label>
				<input bind:value={newTask.date} type="date" name="date" id="date" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
			</div>
			<div class="flex flex-col gap-1">
				<label for="time">Time</label>
				<input bind:value={newTask.time} type="time" name="time" id="time" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
			</div>
			<div class="flex flex-col gap-1">
				<label for="task">Task</label>
				<select required bind:value={newTask.task_id} name="task" id="task" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
					{#each tasks.data as task (task.id)}
						<option value={task.id}>{task.Name}</option>
					{/each}
				</select>
			</div>
			<div class="flex justify-end gap-2 pt-3">
				<button type="button" onclick={() => createModal.close()} class="rounded-xl px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-100">
					Cancel
				</button>
				<button type="submit" class="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700">
					Save
				</button>

			</div>
		</div>
	</form>
	</div>
</dialog>

<dialog bind:this={newListModal} class="m-auto w-[min(calc(100%-2rem),28rem)] rounded-2xl border border-slate-200 p-0 shadow-2xl backdrop:bg-slate-900/40">
	<div class="p-6">
		<p class="text-sm font-semibold uppercase tracking-widest text-blue-600">Task planner</p>
				<h2 class="mt-1 text-2xl font-bold text-slate-900">Create new list</h2>
		<form onsubmit={addTask} method="post" class="flex flex-col gap-4">
			<div class="flex flex-col gap-2">
				<label for="listName" class="text-sm font-medium text-slate-700">List Name</label>
				<input required
					type="text"
					id="listName"
					bind:value={newTaskTitle}
					placeholder="Enter list name..."
					class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				/>
			</div>
			<div class="flex flex-col gap-2">
				<label for="color" class="text-sm font-medium text-slate-700">Color</label>
				<input bind:value={newTaskColor}
					type="color"
					id="color"
					class="h-11 w-full rounded-xl border border-slate-300 bg-white p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
			<div class="flex gap-3 justify-end mt-4">
				<button
					type="button"
					onclick={() => {
						newTaskTitle = '';
						newListModal.close();
					}}
					class="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
				>
					Cancel
				</button>
				<button
					type="submit"
					class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
				>
					Done
				</button>
			</div>
		</form>
	</div>
</dialog>
<div style={`background-color:${backgroundColor}`} class="min-h-dvh w-full bg-slate-50 text-slate-900">
	<div class="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
			<div>
				<p class="text-sm font-semibold uppercase tracking-widest text-blue-600">Task planner</p>
				<h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900">Your tasks</h1>
				<p class="mt-1 text-sm text-slate-500">{today.toLocaleString().replace(',', ' ')}</p>
			</div>
			<div class="flex items-center gap-3">
				<label class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm">
					<span>Background</span>
					<input aria-label="Choose background color" onchange={() => saveColor()} bind:value={backgroundColor} type="color" name="bg" id="bg" class="h-7 w-7 cursor-pointer rounded-md border-0 bg-transparent p-0">
				</label>
				<span class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">{userInitials()}</span>
			</div>
		</div>
	</div>
		<div class="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-start lg:gap-6 lg:p-8">
			<div class="w-full shrink-0 lg:w-64">
			<button type="button" onclick={() => createModal.showModal()} class="flex w-full my-3 items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
				<span class="text-xl leading-none">+</span>
				<span>Create task</span>

			</button>
			<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div class="flex items-center justify-between">
					<span class="text-sm font-semibold uppercase tracking-widest text-slate-500">
						Lists
					</span>
					<button type="button" aria-label="Toggle lists" onclick={() => showList = !showList} class="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100">

						<svg class:rotate-180={showList} width="25px" height="25px" viewBox="0 0 24 24" class="text-slate-400 transition-transform" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M7 10L12 15L17 10" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
					</button>

				</div>
				{#if showList}
				{#each tasks.data as task (task.id) }
				<div class="flex gap-3 items-center">
					<input bind:checked={task.show} type="checkbox" name="task-{task.id}" id="task-{task.id}" class="form-checkbox checked:bg-gray-500">
					<label class="text-sm" for="task-{task.id}">{task.Name}</label>
					<div class="text-end flex-1 me-3 text-gray-600 text-sm">
						{taskItems.data.filter(item => item.task_id === task.id && !item.completed).length}
					</div>
				</div>
				{/each}

				{/if}
				<button onclick={() => newListModal.showModal()} type="button" class="mt-4 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600">
					<svg width="25px" height="25px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
					</svg>
					<span class="text-sm">Create New List</span>
				</button>
			</div>
		</div>
		<div class="min-w-0 flex-1">
		{#if loggedIn}
			{#if loading}
			<div class="grid w-full gap-4 md:grid-cols-2">

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
				
			<dialog class="rounded-lg shadow-2xl p-4 m-auto backdrop:bg-black/50" bind:this={addTaskModal} onclick={() => closeModal()}>
    <div class="md:w-96 w-full p-6">
			
        <form method="post" onsubmit={(e) => {addNewTask(); e.preventDefault()}} onclick={(e) => e.stopPropagation()}>
            <div class="flex justify-end">
                <button type="button" class=" font-semibold text-gray-600 hover:cursor-pointer" onclick={() => addTaskModal.close()}>X</button>
            </div>
            <div class="flex flex-col">
                <label class="font-semibold" for="title"> Title</label>
                <input required bind:value={newTask.title} type="text" name="title" id="title" class="border border-gray-300 text-black rounded-md py-2 px-3 focus:outline-none form-input  focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="flex flex-col">
                <label class="font-semibold" for="description"> Description</label>
                <div class="border rounded-lg p-2">
			
                	<Edra {editor}>
					<Edra.Toolbar class="border-b p-1 overflow-x-auto" />
					<Edra.Content class="min-h-60 px-4 py-2" />
				    </Edra>
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <div class="flex flex-wrap items-center gap-2">
                    <div class="flex flex-col gap-3">
                        <label for="date" class="font-semibold">Date</label>
                           <input class="form-input text-black" type="date" id="date" bind:value={newTask.date}>
			
                    </div>
                    <div class="flex flex-col gap-3">
                    <label for="tiem" class="px-1">Time</label>
                    <input class="form-input text-black" type="time" bind:value={newTask.time} name="time" id="time">
                    </div>
                </div>
            </div>
            <div class="flex justify-end mt-3">
                <button type="submit" class="rounded-full bg-blue-500 text-white hover:shadow-xl hover:cursor-pointer font-semibold px-2 py-1">
                    Save
                </button>
            </div>
        </form>
    </div>
			
			</dialog>
			
			<dialog bind:this={deleteItemModal} class="m-auto rounded-2xl border border-gray-200  p-0 shadow-2xl backdrop:bg-black/50">
    <div class="md:w-80 w-full p-6">
        <div class="flex justify-center">
            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-red-500">
                    <path d="M10 11V17M14 11V17M4 7H20M6 7H18L17 19C17 19.5304 16.7893 20.0391 16.4142 20.4142C16.0391 20.7893 15.5304 21 15 21H9C8.46957 21 7.96086 20.7893 7.58579 20.4142C7.21071 20.0391 7 19.5304 7 19L6 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
            </div>
        </div>
        <div class="mt-4 text-center">
            <h2 class="text-lg font-semibold text-slate-800">Delete this task?</h2>
            <p class="mt-2 text-sm text-slate-600">This action cannot be undone. The item will be removed permanently.</p>
        </div>
        <div class="mt-6 flex justify-end gap-3">
            <button type="button" onclick={() => deleteItemModal.close()} class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200">
                Cancel
            </button>
            <button type="button" onclick={() => deleteTaskItem(currentItemId)} class="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600">
                Delete
            </button>
        </div>
    </div>
			</dialog>
			
			<div class="grid w-full gap-6">
			
    {#each tasks.data as task, index (index) }
    {#if task.show}
			
    <div style={`background-color: ${task.color}`} class="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
                <p class="text-xs font-semibold uppercase tracking-widest text-blue-600">Task list</p>
                <h2 class="mt-1 text-lg font-bold text-slate-900">{task.Name}</h2>
            </div>
            <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{taskItemsMap().get(task.id)?.length ?? 0}</span>
        </div>
        <div class="flex flex-col gap-3 p-4">
            <button type="button" onclick={() => openAddNewTaskItemModal(task.id)} class="flex w-fit items-center justify-start gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50">
                <svg enable-background="new 0 0 24 24" focusable="false" height="24" viewBox="0 0 24 24" width="24" class="text-blue-600"><rect fill="none" height="24" width="24"></rect><path d="M22,5.18L10.59,16.6l-4.24-4.24l1.41-1.41l2.83,2.83l10-10L22,5.18z M12,20c-4.41,0-8-3.59-8-8s3.59-8,8-8 c1.57,0,3.04,0.46,4.28,1.25l1.45-1.45C16.1,2.67,14.13,2,12,2C6.48,2,2,6.48,2,12s4.48,10,10,10c1.73,0,3.36-0.44,4.78-1.22 l-1.5-1.5C14.28,19.74,13.17,20,12,20z M19,15h-3v2h3v3h2v-3h3v-2h-3v-3h-2V15z"></path></svg>
                <span class="">Add a Task</span>
            </button>
            <div class="max-h-100 space-y-2 overflow-y-auto pr-1">
                {#each taskItemsMap().get(task.id) ?? [] as item, index (index)}
                <div class="relative overflow-hidden rounded-xl animate-[fadeInUp_220ms_ease-out]">
                    <button type="button" class="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 px-4 text-sm font-semibold text-white" onclick={(event) => { event.stopPropagation(); openDeleteModal(item.id) }}>
                        Delete
                    </button>
                    <div
                        class="relative z-10 flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition-transform duration-200 hover:bg-slate-50"
                        style={`transform: translateX(${swipeOffsets.get(item.id) ?? 0}px);`}
                        onpointerdown={(event) => startSwipe(event, item.id)}
                        onpointermove={(event) => moveSwipe(event, item.id)}
                        onpointerup={() => endSwipe(item.id)}
                        onpointerleave={() => endSwipe(item.id)}
                        onpointercancel={() => endSwipe(item.id)}
                    >
                    <div class="flex items-start gap-3">
			
                        <input onchange={() => markCompleted(item.id)} bind:checked={item.completed} type="checkbox" name="completed" class="mt-1 h-5 w-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500" id="completed-{index}">
                        <dl class="pr-10">
                            <dt class="font-semibold text-sm">{item.title}</dt>
                            <dd class="flex flex-col pb-2 text-xs text-slate-500">
                                <span >
                                    {@html item.description}
                                </span>
                                <div class="flex items-center gap-2">
                                    {#if item.date}
                                        <span  class="mt-1 {todayWithZeroTime().getTime() > getItemDate(item.date).getTime() ? 'text-red-600' : today.getTime() <= getItemDate(item.date).getTime() ? 'text-green-600' : 'text-blue-600'} rounded-full pointer-events-none border border-gray-300 px-2 py-1 ">
                                            {getDateName(item.date) + ' ' +formatDate(item.date)}
                                        </span>
                                    {/if}
                                    {#if item.time}
                                          <span class="mt-1 rounded-full pointer-events-none border border-gray-300 px-2 py-1 text-blue-600">
                                            {formatTime(item.time)}
                                        </span>
                                    {/if}
                                </div>
                            </dd>
                        </dl>
                    </div>
                    <button aria-label={`Edit ${item.title}`} class="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600" onclick={() => openEditTaskItemModal(item)}>
                        <svg width="15px" height="15px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M9.65661 17L6.99975 17L6.99975 14M6.10235 14.8974L17.4107 3.58902C18.1918 2.80797 19.4581 2.80797 20.2392 3.58902C21.0202 4.37007 21.0202 5.6364 20.2392 6.41745L8.764 17.8926C8.22794 18.4287 7.95992 18.6967 7.6632 18.9271C7.39965 19.1318 7.11947 19.3142 6.8256 19.4723C6.49475 19.6503 6.14115 19.7868 5.43395 20.0599L3 20.9998L3.78312 18.6501C4.05039 17.8483 4.18403 17.4473 4.3699 17.0729C4.53497 16.7404 4.73054 16.424 4.95409 16.1276C5.20582 15.7939 5.50466 15.4951 6.10235 14.8974Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                    </button>
                    </div>
                </div>
                {:else}
                <div class="flex flex-col items-center gap-1">
                        <span class="">All Items Complete!</span>
                        </div>
                        {/each}
                        </div>
                        </div>
                        {#if completedTakItemsMap().get(task.id)?.length}
                        <div class="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-semibold text-slate-600">Completed ({completedTakItemsMap().get(task.id)?.length})</span>
                                <button aria-label="Toggle completed items" type="button" onclick={() => toggleCompletedShow(task.id)} class="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-700">
                                    <svg class:rotate-180={completedItemsShowMap.get(task.id)} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-gray-600 transition-transform">
                                        <path d="M19 9l-7 7-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                                    </svg>
                                </button>
                            </div>
                            {#if completedItemsShowMap.get(task.id) == true}
                            <div class="flex flex-col max-h-48 overflow-y-auto">
                                {#each completedTakItemsMap().get(task.id) ?? [] as item, index (index)}
                                <div class="flex items-start gap-3 rounded-lg p-2 hover:bg-white">
                                    <input onchange={() => markNotCompleted(item.id)} bind:checked={item.completed} type="checkbox" name="completed" class="mt-1 h-5 w-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500" id="completed-{index}">
                                    <dl class="">
                                        <dt class="font-semibold text-sm line-through">{item.title}</dt>
                                        <dd class="pb-2 text-xs text-slate-500">{@html item.description}</dd>
                                    </dl>
                                </div>
                                {/each}
                            </div>
                            {/if}
                        </div>
                        {/if}
			
                        </div>
                        {/if}
			
                        {/each}
                        </div>

			{/if}

	{:else}
	<div class="flex min-h-96 w-full flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
		<div class="text-center">
			<p class="text-sm font-semibold uppercase tracking-widest text-blue-600">Welcome back</p>
			<h2 class="mt-2 text-2xl font-bold text-slate-900">Sign in to manage tasks</h2>
			<p class="mt-2 text-slate-500">Your lists and task items will be saved to your account.</p>
			<button type="button" onclick={logIn} class="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
				Sign in with Google
			</button>
		</div>
	</div>
	{/if}
		</div>
	</div>


</div>
