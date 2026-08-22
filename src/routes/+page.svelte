<script lang="ts">
import {
	db
} from "$lib/firebase/firebase.app";
import {
	taskItems,
	tasks,
	user,
	type TASK_ITEM
} from "$lib/state.svelte";
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	updateDoc
} from "firebase/firestore"
// TODO: UNCOMMENT WHEN READY TO ADD EDRA
import { createEditor, Edra } from '$lib/components/edra/shadcn/index';
import StarterKit from '@tiptap/starter-kit';
import { SvelteDate, SvelteMap } from "svelte/reactivity";

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
let newTask = $state <TASK_ITEM > ({
    id: '',
    task_id: '',
    title: '',
    description: '',
    date: '',
    time: '',
    order: null,
    completed: false,
    userId: ''
})



let completedItemsShowMap = $state(new Map < string, boolean > ())
let swipeOffsets = $state(new Map<string, number>())
let swipeStartX = $state<number | null>(null)
let activeSwipeId = $state<string | null>(null)
let today = $state<Date>(new Date())

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

<div class="p-4 h-full flex flex-col gap-8 flex-1 items-center mx-auto container ">

    {#each tasks.data as task, index (index) }
    {#if task.show}

    <div style={`background-color: ${task.color}`} class=" rounded-lg w-full mx-4 shadow-sm   hover:shadow-lg hover:border hover:border-slate-400 ">
        <div class="text-lg ml-4 mt-2">{task.Name}</div>
        <div class="flex flex-col gap-3 p-2">
            <button type="button" onclick={() => openAddNewTaskItemModal(task.id)} class="flex justify-start gap-4 items-center px-2 py-1 hover:cursor-pointer hover:bg-blue-100 text-blue-600 font-semibold text-sm rounded-full">
                <svg enable-background="new 0 0 24 24" focusable="false" height="24" viewBox="0 0 24 24" width="24" class="text-blue-600"><rect fill="none" height="24" width="24"></rect><path d="M22,5.18L10.59,16.6l-4.24-4.24l1.41-1.41l2.83,2.83l10-10L22,5.18z M12,20c-4.41,0-8-3.59-8-8s3.59-8,8-8 c1.57,0,3.04,0.46,4.28,1.25l1.45-1.45C16.1,2.67,14.13,2,12,2C6.48,2,2,6.48,2,12s4.48,10,10,10c1.73,0,3.36-0.44,4.78-1.22 l-1.5-1.5C14.28,19.74,13.17,20,12,20z M19,15h-3v2h3v3h2v-3h3v-2h-3v-3h-2V15z"></path></svg>
                <span class="">Add a Task</span>
            </button>
            <div class="max-h-[400px] overflow-y-auto">
                {#each taskItemsMap().get(task.id) ?? [] as item, index (index)}
                <div class="relative mb-2 overflow-hidden rounded-lg animate-[fadeInUp_220ms_ease-out] ">
                    <button type="button" class="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 px-4 text-sm font-semibold text-white" onclick={(event) => { event.stopPropagation(); openDeleteModal(item.id) }}>
                        Delete
                    </button>
                    <div
                        class="relative z-10 border-b flex items-start justify-between gap-3 bg-white px-1 pt-2 transition-transform duration-200 hover:bg-gray-200"
                        style={`transform: translateX(${swipeOffsets.get(item.id) ?? 0}px);`}
                        onpointerdown={(event) => startSwipe(event, item.id)}
                        onpointermove={(event) => moveSwipe(event, item.id)}
                        onpointerup={() => endSwipe(item.id)}
                        onpointerleave={() => endSwipe(item.id)}
                        onpointercancel={() => endSwipe(item.id)}
                    >
                    <div class="flex items-start gap-3">

                        <input onchange={() => markCompleted(item.id)} bind:checked={item.completed} type="checkbox" name="completed" class="form-checkbox mt-1 ml-3 rounded-full" id="completed-{index}">
                        <dl class="pr-10">
                            <dt class="font-semibold text-sm">{item.title}</dt>
                            <dd class="flex flex-col pb-2 text-xs text-gray-600">
                                <span >
                                    {@html item.description}
                                </span>
                                <div class="flex items-center gap-2">
                                    {#if item.date}
                                        <span  class="mt-1 {todayWithZeroTime().getTime() > getItemDate(item.date).getTime() ? 'text-red-600' : today.getTime() <= getItemDate(item.date).getTime() ? 'text-green-600' : 'text-blue-600'} rounded-full pointer-events-none border border-gray-300 px-2 py-1 ">
                                            {formatDate(item.date)}
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
                    <button class="hover:cursor-pointer rounded-full px-2 py-1 border border-gray-300" onclick={() => openEditTaskItemModal(item)}>
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
                        <div class="flex flex-col gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                            <div class="flex items-center gap-2">
                                <span class="font-semibold text-slate-600 text-sm">Completed ({completedTakItemsMap().get(task.id)?.length})</span>
                                <button aria-label="Toggle completed show   items" type="button" onclick={() => toggleCompletedShow(task.id)} class="p-1 hover:bg-gray-200 rounded transition-colors">
                                    <svg class:rotate-180={completedItemsShowMap.get(task.id)} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-gray-600 transition-transform">
                                        <path d="M19 9l-7 7-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                                    </svg>
                                </button>
                            </div>
                            {#if completedItemsShowMap.get(task.id) == true}
                            <div class="flex flex-col max-h-48 overflow-y-auto">
                                {#each completedTakItemsMap().get(task.id) ?? [] as item, index (index)}
                                <div class="flex items-start pt-2 gap-3 mb-2  hover:bg-gray-200">
                                    <input onchange={() => markNotCompleted(item.id)} bind:checked={item.completed} type="checkbox" name="completed" class="form-checkbox mt-1 ml-3 rounded-full" id="completed-{index}">
                                    <dl class="">
                                        <dt class="font-semibold text-sm line-through">{item.title}</dt>
                                        <dd class="text-gray-600 pb-2 text-xs">{@html item.description}</dd>
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
