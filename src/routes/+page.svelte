<script lang="ts">
import {
    db
} from "$lib/firebase/firebase.app";
import {
    taskItems,
    tasks,
    type TASK_ITEM
} from "$lib/state.svelte";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    updateDoc
} from "firebase/firestore";

console.log(tasks)

let addTaskModal: HTMLDialogElement
let deleteItemModal: HTMLDialogElement
let currentItemId: string
let newTask = $state < TASK_ITEM > ({
    id: '',
    task_id: '',
    title: '',
    description: '',
    date: '',
    order: null,
    completed: false
})

let completedItemsShowMap = $state(new Map < string, boolean > ())
let swipeOffsets = $state(new Map<string, number>())
let swipeStartX = $state<number | null>(null)
let activeSwipeId = $state<string | null>(null)
let today = new Date().toDateString()

let dateOption = $state<'today' | 'tomorrow' | 'custom' | null>(null)

let taskItemsMap = $derived(() => {
    const items = taskItems.data.filter(item => !item.completed)
    const itemMap = new Map < string,
        TASK_ITEM[] > ()
    items.forEach(item => {
        if (!itemMap.has(item.task_id)) {
            itemMap.set(item.task_id, [])
        }
        itemMap.get(item.task_id) !.push(item)
    })
    console.log(itemMap)
    return itemMap
})

let completedTakItemsMap = $derived(() => {
    const items = taskItems.data.filter(item => item.completed)
    const itemMap = new Map < string,
        TASK_ITEM[] > ()
    items.forEach(item => {
        if (!itemMap.has(item.task_id)) {
            itemMap.set(item.task_id, [])
        }
        itemMap.get(item.task_id) !.push(item)
    })
    return itemMap
})

function openAddNewTaskItemModal(taskId: string) {
    newTask.task_id = taskId
    const filtered = taskItems.data.filter((item) => item.task_id === newTask.task_id)
    newTask.order = filtered.length
    addTaskModal.showModal()

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
    completedItemsShowMap = new Map(completedItemsShowMap)
}

function startSwipe(event: PointerEvent, itemId: string) {
    swipeStartX = event.clientX
    activeSwipeId = itemId
}

function moveSwipe(event: PointerEvent, itemId: string) {
    if (activeSwipeId !== itemId || swipeStartX === null) return

    const delta = event.clientX - swipeStartX
    const offset = Math.min(0, Math.max(-96, delta))
    const nextOffsets = new Map(swipeOffsets)
    nextOffsets.set(itemId, offset)
    swipeOffsets = nextOffsets
}

function endSwipe(itemId: string) {
    const offset = swipeOffsets.get(itemId) ?? 0
    const nextOffsets = new Map(swipeOffsets)
    nextOffsets.set(itemId, offset < -48 ? -96 : 0)
    swipeOffsets = nextOffsets
    swipeStartX = null
    activeSwipeId = null
}

function resetSwipe(itemId: string) {
    const nextOffsets = new Map(swipeOffsets)
    nextOffsets.set(itemId, 0)
    swipeOffsets = nextOffsets
}

function selectDateOption(option: 'today' | 'tomorrow' | 'custom' | null) {
    if (dateOption === option) {
        dateOption = null
        newTask.date = ''
    } else {
        dateOption = option
    }
    const today = new Date()
    today.setHours(0,0,0,0)
    switch (dateOption) {
        case 'today':
            newTask.date = today.toISOString()
        break;
        case 'tomorrow':
        today.setDate(today.getDate() + 1)
        today.setHours(0,0,0,0)
        newTask.date = today.toISOString()
        break

    }
}

async function addNewTask() {
    if (db) {
        addTaskModal.close()
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
                completed: newTask.completed
            });
            taskItems.data[taskItems.data.length -1].id = docRef.id
            newTask = {
                id: '',
                task_id: '',
                title: '',
                description: '',
                date: '',
                order: null,
                completed: false
            }

        } catch (error) {
            console.error(error);
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

function formatDate(dateStr: string): string {
  const hasTime = !dateStr.includes("T04:00:00.000Z")
  console.log(dateStr, hasTime)
  const date =new Date(dateStr)

  if (hasTime) {
    return date.toLocaleString(); // e.g. "7/5/2026, 3:00:00 PM"
  } else {
    return date.toLocaleDateString(); // e.g. "7/5/2026"
  }
}



function openDeleteModal(itemId: string) {
    currentItemId = itemId
    resetSwipe(itemId)
    deleteItemModal.showModal()
}
</script>

<dialog class="bg-white rounded-lg shadow-2xl p-4 m-auto backdrop:bg-black/50" bind:this={addTaskModal} onclick={() => addTaskModal.close()}>
    <div class="w-96 p-6">

        <form method="post" onsubmit={(e) => {addNewTask(); e.preventDefault()}} onclick={(e) => e.stopPropagation()}>
            <div class="flex justify-end">
                <button type="button" class=" font-semibold text-gray-600 hover:cursor-pointer" onclick={() => addTaskModal.close()}>X</button>
            </div>
            <div class="flex flex-col">
                <label class="font-semibold" for="title"> Title</label>
                <input required bind:value={newTask.title} type="text" name="title" id="title" class="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="flex flex-col">
                <label class="font-semibold" for="description"> Description</label>
                <textarea required bind:value={newTask.description} name="description" id="description" class="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
            </div>
            <div class="flex flex-col gap-2">
                <label class="font-semibold" for="date">Date</label>
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onclick={() => selectDateOption('today')} class:border-blue-500={dateOption === 'today'} class:bg-blue-300={dateOption === 'today'} class:text-blue-600={dateOption === 'today'} class:shadow-sm={dateOption === 'today'} class="flex cursor-pointer items-center gap-2 rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors">
                        <span>Today</span>
                    </button>
                    <button type="button" onclick={() => selectDateOption('tomorrow')} class:border-blue-500={dateOption === 'tomorrow'} class:bg-blue-300={dateOption === 'tomorrow'} class:text-blue-600={dateOption === 'tomorrow'} class:shadow-sm={dateOption === 'tomorrow'} class="flex cursor-pointer items-center gap-2 rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors">
                        <span>Tomorrow</span>
                    </button>
                    <button type="button" onclick={() => {
                        dateOption = 'custom';
                        const dateInput = document.getElementById('date');
                        if (dateInput) {
                            dateInput.showPicker();
                        }
                    }} class:border-blue-500={dateOption === 'custom'} class:bg-blue-300={dateOption === 'custom'} class:text-blue-600={dateOption === 'custom'} class:shadow-sm={dateOption === 'custom'} class="ml-auto flex cursor-pointer items-center justify-center rounded-full border border-gray-300 p-2 text-slate-600 transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                        </svg>
                    </button>
                    <input bind:value={newTask.date} type="datetime-local" name="date" id="date" class="pointer-events-none absolute h-0 w-0 opacity-0" tabindex="-1">
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

<dialog bind:this={deleteItemModal} class="m-auto rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/50">
    <div class="w-80 p-6">
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

<div class="p-4 flex flex-col gap-8 flex-1 items-center mx-auto container ">
<div class="w-full flex justify-center p-2">
		<span class="text-xl font-semibold text-slate-400">{today}</span>
	</div>
    {#each tasks.data as task, index (index) }
    {#if task.show}

    <div style={`background-color: ${task.color}`} class=" rounded-lg min-w-100 shadow-sm   hover:shadow-lg hover:border hover:border-slate-400 ">
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
                        class="relative z-10 flex items-start gap-3 bg-white px-1 pt-2 transition-transform duration-200 hover:bg-gray-200"
                        style={`transform: translateX(${swipeOffsets.get(item.id) ?? 0}px);`}
                        onpointerdown={(event) => startSwipe(event, item.id)}
                        onpointermove={(event) => moveSwipe(event, item.id)}
                        onpointerup={() => endSwipe(item.id)}
                        onpointerleave={() => endSwipe(item.id)}
                        onpointercancel={() => endSwipe(item.id)}
                    >
                        <input onchange={() => markCompleted(item.id)} bind:checked={item.completed} type="checkbox" name="completed" class="form-checkbox mt-1 ml-3 rounded-full" id="completed-{index}">
                        <dl class="pr-10">
                            <dt class="font-semibold text-sm">{item.title}</dt>
                            <dd class="flex flex-col pb-2 text-xs text-gray-600">
                                <span>
                                    {item.description}
                                </span>
                                {#if item.date}
                                    <span class="mt-1 rounded-full pointer-events-none border border-gray-300 px-2 py-1 text-blue-600">
                                        {formatDate(item.date)}
                                    </span>
                                {/if}
                            </dd>
                        </dl>
                    </div>
                </div>
                {:else}
                <div class="flex flex-col items-center gap-1">
                    <a href="https://storyset.com/money">Money illustrations by Storyset</a>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 500"><g id="freepik--background-simple--inject-74"><path d="M609.38,91.64a163.45,163.45,0,0,0-31.33-23.51c-37-21.71-78.32-36.88-121-41.84-4.12-.47-8.26-.86-12.4-1.14-96.15-6.59-161,50.49-201,105.36S146,151.73,87,231.49,60,392.46,146.68,434.17s198.14,16.09,269.53-1.47,141.32,43.17,209.07-43.17c50.85-64.81,50.81-162.35,22.85-236.64C638.8,128.11,626.46,108.15,609.38,91.64Z" style="fill:#92E3A9"/><path d="M609.38,91.64a163.45,163.45,0,0,0-31.33-23.51c-37-21.71-78.32-36.88-121-41.84-4.12-.47-8.26-.86-12.4-1.14-96.15-6.59-161,50.49-201,105.36S146,151.73,87,231.49,60,392.46,146.68,434.17s198.14,16.09,269.53-1.47,141.32,43.17,209.07-43.17c50.85-64.81,50.81-162.35,22.85-236.64C638.8,128.11,626.46,108.15,609.38,91.64Z" style="fill:#fff;opacity:0.7000000000000001"/></g><g id="freepik--Clouds--inject-74"><path d="M637.69,130.27S629.23,88.88,601,91.7c-12.83,1.28-21.42,7.72-28.86,17.71-9.55,12.82-13,5.37-26.64,9.57-12.23,3.77-10.35,14.12-17.88,16s-13.17-6.59-23.52-4.71-16,12.23-16,12.23H676.27a18.24,18.24,0,0,0-13.17-15C650.86,123.69,645.22,133.1,637.69,130.27Z" style="fill:none;stroke:#000;stroke-miterlimit:10;opacity:0.30000000000000004"/><path d="M193.16,127.53S187.81,101.4,170,103.18c-8.11.82-13.52,4.87-18.22,11.18-6,8.09-8.18,3.39-16.81,6-7.72,2.38-6.53,8.91-11.29,10.1s-8.31-4.16-14.84-3-10.1,7.72-10.1,7.72H217.5a11.5,11.5,0,0,0-8.31-9.5C201.47,123.37,197.91,129.31,193.16,127.53Z" style="fill:none;stroke:#000;stroke-miterlimit:10;opacity:0.30000000000000004"/><path d="M494,393.28s-4.7-22.95-20.35-21.38c-7.11.71-11.87,4.28-16,9.82-5.3,7.1-7.19,3-14.77,5.3-6.78,2.09-5.74,7.83-9.91,8.87s-7.3-3.65-13-2.61-8.86,6.78-8.86,6.78h104.3a10.1,10.1,0,0,0-7.3-8.34C501.28,389.63,498.15,394.85,494,393.28Z" style="fill:none;stroke:#000;stroke-miterlimit:10;opacity:0.30000000000000004"/><path d="M244.93,353s-4.7-22.94-20.35-21.38c-7.11.71-11.87,4.28-16,9.82-5.29,7.1-7.18,3-14.76,5.3-6.78,2.09-5.74,7.83-9.91,8.87s-7.3-3.65-13-2.61-8.86,6.78-8.86,6.78h104.3a10.1,10.1,0,0,0-7.3-8.34C252.23,349.3,249.1,354.52,244.93,353Z" style="fill:none;stroke:#000;stroke-miterlimit:10;opacity:0.30000000000000004"/></g><g id="freepik--Arrow--inject-74"><polygon points="593.46 160.51 614.02 175.74 470.09 263.32 444.2 312.06 278.94 372.98 106.88 486.5 208.05 486.5 316.26 404.96 480.75 344.8 509.69 291.49 648.29 196.3 677.23 218.39 709.98 138.42 709.98 129.24 593.46 160.51" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="593.46 151.32 614.02 166.55 470.09 254.13 444.2 302.87 278.94 363.79 96.69 486.5 197.81 486.5 316.26 395.78 480.75 335.62 509.69 282.31 648.29 187.12 677.23 209.2 709.98 129.24 593.46 151.32" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="470.53" y1="325.94" x2="473.9" y2="328.76" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="450.29" y1="308.96" x2="466.34" y2="322.43" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="476.18" y1="256.42" x2="486.84" y2="264.03" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="310.93" y1="392.73" x2="280.34" y2="371.24" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="593.46 160.51 593.46 151.32 614.02 166.55 607.25 170.75 593.46 160.51" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="677.23 218.39 677.23 209.2 648.29 187.12 648.29 196.3 677.23 218.39" style="fill:#fff;stroke:#263238;stroke-miterlimit:10"/></g><g id="freepik--character-2--inject-74"><path d="M328.58,205.22l-6,11.28s1.45,1.91,2,1.6,3.5-5.42,3.5-5.42l-2.36,8.73s.95,1.51,1.54.85,2.74-6.91,3.28-7,1.81-2.35,1.81-2.35L330.17,220s-.82,3.33.63,3.1,1.55-3.45,1.55-3.45l3.08-4.73L334.28,220s2,1.42,2.31.2,1.4-6,1.4-6,5-6,5.58-6.67,3.53-7.91,3.53-7.91l-4.46-6.28Z" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M341.81,194.74l-11.88,3.09s-3.61,8.8-4.64,10.32.21,1.81,2.06,1.07,5.06-4.92,5.06-4.92,5.65.84,7.52-2.22" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="331.09" y1="209.36" x2="336.19" y2="212.3" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M414.73,97.2l24.71,63.06,2.18,6.83s-23.79,9.94-28.73,10.73a47.14,47.14,0,0,0-6.82,1.45l-24.89-62.42,8.44-13.44L409.84,95Z" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="414.87" y1="130.3" x2="426.5" y2="166.91" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M408.37,306.49a95.36,95.36,0,0,1-1.55,9.78c-.76,2.77-3.18,10.35-2.82,12.33s2.29,10.46,3.47,11.09,2.94.78,3.9,0,5.84-10.3,6.3-13.62.15-14.15.22-15S408.37,306.49,408.37,306.49Z" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M512.62,244.61s8,3.7,9.06,3.79,10.18,1,10.18,1,7.56-1.48,8.74-.85.77,3.43.77,3.43-15.21,8.08-17.37,8.6-4.75-.4-6.2,0l-1.45.41,1.22,2.23-9.09,4.89s-4-4.6-4.16-7.26-.26-7.28-.26-7.28l-1.3-5.43Z" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M412.64,95.72s17,43.39,20.22,50.07,6.08,14.74,8.56,16.83-6.39-22.12-7.23-26.88-.71-13.66-.71-13.66L508.2,96.45l-2.8-9.31L443,94.61s-12.7-1.4-15.36-1.31S412.64,95.72,412.64,95.72Z" style="fill:#92E3A9;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M418.31,94.69c-3.07.54-5.67,1-5.67,1s11.9,30.29,17.67,44.15a137.65,137.65,0,0,0-3.51-23.67A109.6,109.6,0,0,0,418.31,94.69Z" style="fill:#92E3A9;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polyline points="435.77 102.74 433.48 122.08 439.44 103.68" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="505.4 87.14 509.99 86.44 511.8 94.57 508.2 96.44 505.4 87.14" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M526.45,84.1s3.85.64,3.77,1.57-1.45,6-1.45,6a11.61,11.61,0,0,1-5.62,0c-2.43-.83-3.22-2.62-2.61-4.29S526.45,84.1,526.45,84.1Z" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polyline points="523.64 85.89 526.82 87.1 526.48 90.98" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M522.47,86.73l1.89,1.72a3,3,0,0,1,0,1.41" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M510,86.44l12-2.73s11.51-4.79,11.92-4.13a1.45,1.45,0,0,1-.17,2c-.68.57-9.07,3.6-10.06,4.3s-1.61,2.36-.9,3.21A4.55,4.55,0,0,0,526.48,91c1.74-.17,6-.74,6.11-.1s.5,1.45-1,2-3.78.3-4.89.52-5.6,1.55-7.31,1.4a24.28,24.28,0,0,1-4.59-1.17l-3.05,1Z" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M438,160.39s12.5,24.3,13.48,24.32,12.3-8.51,12.6-8.9-15.08-9.18-19.42-13.7-8.17-9.53-8.17-9.53Z" style="fill:#92E3A9;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M441.62,167.09l6,10.46s31.37-3.61,42-4.32,14.38.42,14.38.42l10.56,70.93-16.87,7.48L481.92,199s-35.12,9.57-40.25,10.15a43.66,43.66,0,0,0-7.62,1.37s-9.68,65.55-10.42,74.21-.68,24.5-.68,24.5l-4.86,4.66s-10.49-5.57-11-6.43-5.83-81.28-5.83-81.28l-2-31.42,6.8-15.45Z" style="fill:#92E3A9;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="409.95 181.41 443.1 170.01 441.62 167.09 409.48 178.01 409.95 181.41" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="423.88 173.06 425.43 176.77 432.86 174.14 431.46 170.58 423.88 173.06" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="416.85" y1="241.73" x2="416.78" y2="237.7" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="418.09" y1="313.85" x2="416.92" y2="245.97" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M434.05,210.48S436,197,440,189" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M442,182.73s-5.81,9.5-6.7,11.57" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="492.56" y1="195.6" x2="495.45" y2="194.69" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="481.92" y1="198.96" x2="489.58" y2="196.54" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="405 120.11 413.49 125.48 416.16 113.01 406.58 110.05 405 120.11" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="408.82 115 401.58 130.9 391.97 105.22 412.64 95.72 424.02 117.26 408.82 115" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="344.81 190.63 340.89 194.73 347.13 201.74 349.15 198.57 344.81 190.63" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M389.62,103.41,366,122l-2.38,48.62-20,21,5.86,8.9,29-22.91,3.94-27.69,5.49,15.8-6.35,38.62a115.87,115.87,0,0,0,13.4,4.37c6.65,1.64,15.15.58,15.15.58l1.46-46.37-18.62-60.25Z" style="fill:#92E3A9;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polyline points="390.56 173.11 407.58 174.75 407.58 181.3 390.23 178.68" style="fill:#92E3A9;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M392.91,102.62l-3.29.79-4.31,3.39a145.34,145.34,0,0,0,7.7,21.76c3.62,8,10.47,17.26,15,23Z" style="fill:#92E3A9;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M413.49,125.48l-16.58,14-30.77-4.07-14.57,11.45-3.14,7.42,12.53,2,11.82-12.76s23.77,4.37,25.06,3.94,14-17.75,14-17.75Z" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M378.58,71.49s-4.27,1.23-6.24-1.32-3.27-5.85-1.53-5.3A22.1,22.1,0,0,1,375,67s-.67-6,.74-6.3,2,2.36,2,2.36,6.14-4.44,13-5.25,17,3.05,18.48,4.56.49,15.14.2,16.11-.87,3.3-1.93,4-3.52,1.68-4.81.58-1.16-2.68-3.51-3.08-8.11-.5-8.49-2.92,2.16-6.76-.22-6.77-8.32,2.07-9.91,2.13S378.58,71.49,378.58,71.49Z" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M378.58,71.49l0,12.12L381,86.8l-1,11.44,5-.37s3.33,9.82,4.3,10.1,5.17-2.34,5.17-2.34,13.65,9.91,14.29,9.37,3.29-17.59,3.74-18.15-2-9.5-2-9.5,1.94-4,1.4-7-1.5-3.31-1.5-3.31-2.09-1.17-2.78,0-2.79,4.73-2.79,4.73l-3.05-3.84s-8.67-.74-8.57-1.93,2-7.17,1.46-7.82S383.85,68,378.58,71.49Z" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M390.33,85.86c.4,1,.32,2-.18,2.18s-1.23-.45-1.64-1.45-.32-2,.18-2.17S389.92,84.86,390.33,85.86Z" style="fill:#263238"/><path d="M383.18,84.71s2.9,6.13,4.66,6.61,6.75-.57,7.39-2.31-1.12-7.93-1.12-7.93Z" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="394.11" y1="81.08" x2="407.71" y2="76.97" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M383.18,84.71l-8.63,3.51s1.95,3.93,5.26,3.39" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M391,96.65s4.78-.57,5.81-4.89" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M394.53,105.63s7.21-4.95,8.09-5.69,1.77-3.45,1.77-3.45-1,8.25-1.68,10-1.45,3.63-1.45,3.63Z" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M410.59,87.35s-1.11,3.05-2.92,3.22" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M385.86,82a5.13,5.13,0,0,1,5.57-2.13" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/></g><g id="freepik--character-1--inject-74"><path d="M301.79,225.41,304,219.6l4.6-4.35s1.6-2.91,2.57-2.32.4,1.22,0,2.37a15.58,15.58,0,0,1-2.66,3.33s9-6,9.5-6.13,2,.84,1.2,1.8-6.86,5-6.86,5l9.86-4.41s.79,2.61-.28,3.19-6.63,4.35-6.63,4.35,4.33-1.16,5.56-1.73,1.75,1.34.85,1.94-6.44,4-6.44,4,5.36-1.24,5.13-.58-.1,1.18-1.65,1.55-7.73,3.23-7.73,3.23l-8.51,2.49Z" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="298.68 227.45 301.8 225.41 305.51 233.5 301.07 236.26 298.68 227.45" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M182,301.59s.87,10.62.78,11.68,4.5,5.93,5.68,6.74,5.4-.43,5.4-.43,4.64-6.21,4.26-8a4.43,4.43,0,0,0-1.56-2.64l-5.73-5.37L189,301.3Z" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M190.08,313.72l-2.37,2.65s1.1,1.71,2.2,1.44l1.09-.26h0" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M189,301.3s6,5.33,7.19,5.79a2.67,2.67,0,0,1,1.56,2.64,53,53,0,0,1-6,5.38c-1.14.8-2.16.17-1.67-1.39s1.59-4,1.59-4-2.34.15-2.89-1.68" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M181.53,296.73l.48,4.86s2.54,1.65,4.34,1.45a12.48,12.48,0,0,0,4.07-1.62l1.46-3.35Z" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M282.2,369.79s-3.36,12.08-3.4,14.59a75.12,75.12,0,0,0,.76,7.95s1,1,3.53.66a12.68,12.68,0,0,0,5.15-1.53c.58-.49.51-3.9.51-3.9s2.48.39,4.24.72,7.53-2,9.77-3.11,6.43-3.93,7-6.21-1-3.31-1.69-3.37-9.49-.1-11.43-.45-5.25-3.67-5.38-4.22S282.2,369.79,282.2,369.79Z" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M234.87,417.91l.42,5.59s4,5.19,5.24,5.83,3.88.69,4.1,2.32.69,2.39-.61,3-6.49,2.49-8.47,2.5-5.6-1.56-5.6-1.56l-.54,2.11a9,9,0,0,1-3.64.58,14.06,14.06,0,0,1-4.24-.72s-.86-4.55-.47-7,2-9,2-9l1.4-5.8Z" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M213.8,303.78l4.55,9.5L231,359.21l-7.62,57.59s2.85,2.21,5.16,2.41,8.05-.21,8.05-.21l13.43-60.84,2.25-45,35.08,1.4-7,56.69s4.37,1.09,6,1.22a58.29,58.29,0,0,0,7.4-.79s16.46-70.71,16.95-72.28a3.3,3.3,0,0,0-.1-3c-.45-.94-40.71-10.64-40.71-10.64S222.67,304.54,213.8,303.78Z" style="fill:#92E3A9;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><polygon points="252.3 313.15 232.18 311.82 251.41 325.97 252.3 313.15" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M213.86,210.53s-12,7.16-12.79,9.61-17.29,42.6-17.43,44.27-3.14,34.15-3.14,34.15a20.58,20.58,0,0,0,5.14,1.28c2.5.21,6.24-1.77,6.24-1.77l7.32-34L212.33,248l3.83,14.18L207,305.45s15.36,4.46,31.49,0,34.45-19.93,34.45-19.93-9.41-17.6-12-21.18-4.83-7.34-4.83-7.34l.23-7.54s13.84,14.83,15.35,14.33,31.12-27.56,31.12-27.56l-4.08-8.75-26.95,13.23s-13.53-30.76-16.37-31.84-9.08-1.83-9.08-1.83S226.94,202.42,213.86,210.53Z" style="fill:#92E3A9;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M233.5,157.65a22.47,22.47,0,0,1,3.06,4.52c1.55,2.92,1.94,6.07,4.3,7.26s5.65,1,5.56,2.11-1.95,3.61-1.95,3.61,2.73,10.23,2.09,12-8.69,5.65-8.69,5.65l0,9.19-11.89.95a116,116,0,0,1-4.9-15.51c-1.4-6.68,5.16-10.54,5-18.42s1.21-12.2,2.88-12.55S233.5,157.65,233.5,157.65Z" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M238.61,169.65c.4,1,.35,2-.11,2.15s-1.16-.48-1.56-1.48-.35-2,.11-2.16S238.21,168.64,238.61,169.65Z" style="fill:#263238"/><path d="M235.3,167.31s-.16-2,1.77-1.49" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M245.42,179.33a2.88,2.88,0,0,1-3.17.71" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M231.87,161.44s2.62,5.8,1.29,9.79a32,32,0,0,1-3.57,7.23s-2.63,3.88-2.19,6.38,3.08,11.9,3.86,12.46l.77.56,1.65,1.78s-8.66,5.33-18.1,6.49-15.65-1.18-16.89-1.94a21.34,21.34,0,0,1-2.32-1.68s4.81-8.28,4.9-17-2.57-14,0-21.64,22.14-11.55,22.14-11.55.9-2.88,4.65-2.56,7.5,8.19,7.5,8.19Z" style="fill:#263238;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M230.82,181.36s-2.92-4.19-4.52-.88,3.52,8.66,6.12,7.08" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M226.86,200.94s9.52-.86,11.18-.72,5.64,2.79,5.64,2.79l-.27,3.13s-9.23-2.47-14.36-1.44S216.59,208,216.59,208l1.47-4.92S223.07,201,226.86,200.94Z" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M213.86,210.53l1.72-4.4s12.55-3.07,17.44-3.61a23.49,23.49,0,0,1,12.39,2.32,6.49,6.49,0,0,1,2.88,3.18s-9.88-2.31-18.58-1.17A86.51,86.51,0,0,0,213.86,210.53Z" style="fill:#92E3A9;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><path d="M256.29,249.43,243.71,237s-2.82-3.81-1.23-10.18" style="fill:none;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/><line x1="212.33" y1="247.97" x2="204.93" y2="229.08" style="fill:#fff;stroke:#263238;stroke-linecap:round;stroke-linejoin:round"/></g></svg>
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
                                {#each completedTakItemsMap().get(task.id) ?? [] as item (item.order)}
                                <div class="flex items-start pt-2 gap-3 mb-2  hover:bg-gray-200">
                                    <input onchange={() => markNotCompleted(item.id)} bind:checked={item.completed} type="checkbox" name="completed" class="form-checkbox mt-1 ml-3 rounded-full" id="completed-{index}">
                                    <dl class="">
                                        <dt class="font-semibold text-sm line-through">{item.title}</dt>
                                        <dd class="text-gray-600 pb-2 text-xs">{item.description}</dd>
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
