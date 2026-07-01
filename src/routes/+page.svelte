<script >
	import { db } from "$lib/firebase/firebase.app";
	import { collection, getDocs } from "firebase/firestore";
	import { onMount } from "svelte";


    let tasks= $state([])
    let loading = $state(true)

    onMount(async () => {

        const snapshot =  await getDocs(collection(db, 'Tasks'))
        const loadedTasks = snapshot.docs.map(doc => ({id:doc.id, ...doc.data() }))
        tasks = loadedTasks
        loading = false

    })

</script>

<div class="p-4 flex flex-col items-center mx-auto container">
    {#each tasks as task, index (index) }
    <div class="bg-white rounded-lg min-w-75 shadow-sm p-3">
        <span class="text-lg ">{task.Name}</span>
    </div>

    {/each}
</div>
