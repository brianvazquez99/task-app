export type TASK = {
    id:string
    Name:string
}

export const  tasks = $state<{data:TASK[]}>({
    data:[]
})
