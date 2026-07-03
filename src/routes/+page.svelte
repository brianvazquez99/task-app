<script lang="ts">
	import { db } from "$lib/firebase/firebase.app";
	import { taskItems, tasks, type TASK_ITEM } from "$lib/state.svelte";
	import { addDoc, collection } from "firebase/firestore";

console.log(tasks)

let addTaskModal:HTMLDialogElement
let newTask = $state<TASK_ITEM>({
     id:'',
    task_id:'',
    title:'',
    description:'',
    date:''
})


function openAddNewTaskItemModal(taskId:string) {
    newTask.task_id = taskId
    addTaskModal.showModal()

}



async function addNewTask() {
    if (db) {
        await addDoc(collection(db, "Task Items"), {task_id:newTask.task_id, title:newTask.title, description:newTask.description, date:newTask.date});
        taskItems.data.push({...newTask});
        newTask = {
            id:'',
            task_id:'',
            title:'',
            description:'',
            date:''
        }
        addTaskModal.close()
    }
}
</script>


<dialog class="bg-white rounded-lg shadow-lg p-4 m-auto" bind:this={addTaskModal} onclick={() => addTaskModal.close()}>

    <form onsubmit={() => addNewTask()} onclick={(e) => e.stopPropagation()}>
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
        <div class="flex flex-col">
            <label class="font-semibold" for="date"> Date</label>
            <div class="flex items-center gap-5 p-2">
                <span class="rounded-full bg-neutral-200 font-semibold px-3 py-1">Today</span>
                <span class="rounded-full bg-neutral-200 font-semibold px-3 py-1">Tomorrow</span>
            </div>
            <input bind:value={newTask.date} type="datetime-local" name="date" id="date" class="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="flex justify-end mt-3">
            <button type="submit" class="rounded-full bg-blue-500 text-white hover:shadow-xl hover:cursor-pointer font-semibold px-2 py-1">
                Save
            </button>
        </div>
    </form>

</dialog>

<div class="p-4 flex flex-col items-center mx-auto container">
    {#each tasks.data as task, index (index) }
    <div class="bg-white rounded-lg min-w-75 shadow-sm  hover:shadow-lg hover:border hover:border-slate-400 ">
        <div class="text-lg ml-4 mt-2">{task.Name}</div>
        <div class="flex flex-col gap-3 p-2">
        <button type="button" onclick={() => openAddNewTaskItemModal(task.id)} class="flex justify-start gap-4 items-center px-2 py-1 hover:cursor-pointer hover:bg-blue-100 text-blue-600 font-semibold text-sm rounded-full">
            <svg enable-background="new 0 0 24 24" focusable="false" height="24" viewBox="0 0 24 24" width="24" class="text-blue-600"><rect fill="none" height="24" width="24"></rect><path d="M22,5.18L10.59,16.6l-4.24-4.24l1.41-1.41l2.83,2.83l10-10L22,5.18z M12,20c-4.41,0-8-3.59-8-8s3.59-8,8-8 c1.57,0,3.04,0.46,4.28,1.25l1.45-1.45C16.1,2.67,14.13,2,12,2C6.48,2,2,6.48,2,12s4.48,10,10,10c1.73,0,3.36-0.44,4.78-1.22 l-1.5-1.5C14.28,19.74,13.17,20,12,20z M19,15h-3v2h3v3h2v-3h3v-2h-3v-3h-2V15z"></path></svg>
            <span class="">Add a Task</span>
        </button>
        {#each taskItems.data as item, index (index) }
        {#if item.task_id === task.id}
        <div class="flex items-start pt-2 gap-3 mb-2  hover:bg-gray-200">
            <input type="checkbox" name="completed" class="form-checkbox mt-1 ml-3 rounded-full" id="completed-{index}">
            <dl class="">
                <dt class="font-semibold text-sm">{item.title}</dt>
                <dd class="text-gray-600 pb-2 text-xs">{item.description}</dd>
            </dl>
        </div>
        {/if}
        {/each}
        </div>
    </div>

    {/each}
</div>
