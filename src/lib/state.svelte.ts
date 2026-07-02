export type TASK = {
    id:string
    Name:string
}

export type TASK_ITEM = {
    id:string,
    task_id:string
    title:string
    description:string
    date:string
}

export const  tasks = $state<{data:TASK[]}>({
    data:[]
})

export const taskItems = $state<{data:TASK_ITEM[]}>({
    data:[]
})
