import type { UserCredential } from "firebase/auth"

export type TASK = {
    id:string
    Name:string
    show:boolean
    color:string
    userId:string
}

export type TASK_ITEM = {
    id:string,
    task_id:string
    title:string
    description:string
    date:string
    order:number |null
    completed:boolean
    userId:string

}

export const  tasks = $state<{data:TASK[]}>({
    data:[]
})

export const taskItems = $state<{data:TASK_ITEM[]}>({
    data:[]
})

export const user = $state<{data: UserCredential | null} >({
    data: null
})
