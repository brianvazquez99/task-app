<script lang="ts">
	import { auth, db } from '$lib/firebase/firebase.app';
	import { onAuthStateChanged, type User } from 'firebase/auth';
	import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
	import { onMount } from 'svelte';

	type RoutineCategory = 'Morning' | 'After work' | 'Night';
	type Routine = {
		id: string;
		title: string;
		category: RoutineCategory;
		days: string[];
		completedKeys: string[];
		userId: string;
	};

	const categories: RoutineCategory[] = ['Morning', 'After work', 'Night'];
	const weekDays = [
		{ name: 'Monday', short: 'Mon', index: 0 },
		{ name: 'Tuesday', short: 'Tue', index: 1 },
		{ name: 'Wednesday', short: 'Wed', index: 2 },
		{ name: 'Thursday', short: 'Thu', index: 3 },
		{ name: 'Friday', short: 'Fri', index: 4 },
		{ name: 'Saturday', short: 'Sat', index: 5 },
		{ name: 'Sunday', short: 'Sun', index: 6 }
	];

	let routines = $state<Routine[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let currentUser = $state<User | null>(null);
	let title = $state('');
	let category = $state<RoutineCategory>('Morning');
	let selectedDays = $state<string[]>(['Monday', 'Wednesday', 'Friday']);
	let showForm = $state(false);
	let errorMessage = $state('');

	function getMonday(date = new Date()) {
		const monday = new Date(date);
		const day = monday.getDay();
		const daysFromMonday = day === 0 ? 6 : day - 1;
		monday.setHours(0, 0, 0, 0);
		monday.setDate(monday.getDate() - daysFromMonday);
		return monday;
	}

	function dateKeyForDay(dayIndex: number) {
		const date = getMonday();
		date.setDate(date.getDate() + dayIndex);
		return date.toISOString().slice(0, 10);
	}

	function completionKey(dayName: string) {
		const day = weekDays.find((item) => item.name === dayName);
		return `${dateKeyForDay(day?.index ?? 0)}:${dayName}`;
	}

	function formattedDate(dayIndex: number) {
		const date = getMonday();
		date.setDate(date.getDate() + dayIndex);
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
	}

	function routinesForDay(dayName: string) {
		return routines
			.filter((routine) => routine.days.includes(dayName))
			.sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));
	}

	function isComplete(routine: Routine, dayName: string) {
		return routine.completedKeys.includes(completionKey(dayName));
	}

	function toggleDay(dayName: string) {
		selectedDays = selectedDays.includes(dayName)
			? selectedDays.filter((day) => day !== dayName)
			: [...selectedDays, dayName];
	}

	async function loadRoutines(userId: string) {
		if (!db) return;
		const snapshot = await getDocs(query(collection(db, 'Routines'), where('userId', '==', userId)));
		routines = snapshot.docs.map((routineDoc) => {
			const data = routineDoc.data();
			return {
				id: routineDoc.id,
				title: String(data.title ?? ''),
				category: (data.category ?? 'Morning') as RoutineCategory,
				days: Array.isArray(data.days) ? data.days : [],
				completedKeys: Array.isArray(data.completedKeys) ? data.completedKeys : [],
				userId: String(data.userId ?? userId)
			};
		});
	}

	async function addRoutine(event: SubmitEvent) {
		event.preventDefault();
		if (!db || !currentUser || !title.trim() || selectedDays.length === 0) return;

		saving = true;
		errorMessage = '';
		try {
			const routine = {
				title: title.trim(),
				category,
				days: [...selectedDays],
				completedKeys: [],
				userId: currentUser.uid,
				createdAt: serverTimestamp()
			};
			const routineRef = await addDoc(collection(db, 'Routines'), routine);
			routines.push({ id: routineRef.id, ...routine, completedKeys: [] });
			title = '';
			category = 'Morning';
			selectedDays = ['Monday', 'Wednesday', 'Friday'];
			showForm = false;
		} catch (error) {
			console.error(error);
			errorMessage = 'Unable to save this routine. Please try again.';
		} finally {
			saving = false;
		}
	}

	async function toggleComplete(routine: Routine, dayName: string) {
		if (!db) return;
		const key = completionKey(dayName);
		const completedKeys = isComplete(routine, dayName)
			? routine.completedKeys.filter((item) => item !== key)
			: [...routine.completedKeys, key];
		routine.completedKeys = completedKeys;

		try {
			await updateDoc(doc(db, 'Routines', routine.id), { completedKeys });
		} catch (error) {
			console.error(error);
			routine.completedKeys = isComplete(routine, dayName)
				? routine.completedKeys.filter((item) => item !== key)
				: [...routine.completedKeys, key];
		}
	}

	async function removeRoutine(routine: Routine) {
		if (!db) return;
		await deleteDoc(doc(db, 'Routines', routine.id));
		routines = routines.filter((item) => item.id !== routine.id);
	}

	onMount(() => {
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			currentUser = user;
			loading = true;
			if (user) {
				try {
					await loadRoutines(user.uid);
				} catch (error) {
					console.error(error);
					errorMessage = 'Unable to load your routines.';
				}
			}
			loading = false;
		});

		return unsubscribe;
	});
</script>

<svelte:head>
	<title>Routines | Task App</title>
	<meta name="description" content="Plan recurring routines across your week." />
</svelte:head>

<main class="min-h-[calc(100dvh-65px)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-7xl">
		<div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
			<div>
				<p class="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600">Weekly planner</p>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Your routines</h1>
				<p class="mt-2 max-w-xl text-slate-600">Build habits that repeat on the days that work for you.</p>
			</div>
			<button
				type="button"
				onclick={() => (showForm = !showForm)}
				class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
			>
				<svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 5v14m-7-7h14" /></svg>
				Add routine
			</button>
		</div>

		{#if showForm}
			<form onsubmit={addRoutine} class="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
				<div class="mb-5 flex items-center justify-between">
					<div>
						<h2 class="text-lg font-bold text-slate-900">Create a recurring routine</h2>
						<p class="text-sm text-slate-500">Choose every day this item should appear.</p>
					</div>
					<button type="button" aria-label="Close form" onclick={() => (showForm = false)} class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
				</div>
				<div class="grid gap-4 md:grid-cols-[1fr_180px]">
					<label class="block">
						<span class="mb-1.5 block text-sm font-semibold text-slate-700">Routine item</span>
						<input required bind:value={title} placeholder="e.g. Read for 20 minutes" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
					</label>
					<label class="block">
						<span class="mb-1.5 block text-sm font-semibold text-slate-700">Category</span>
						<select bind:value={category} class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
							{#each categories as option}
								<option value={option}>{option}</option>
							{/each}
						</select>
					</label>
				</div>
				<div class="mt-5">
					<span class="mb-2 block text-sm font-semibold text-slate-700">Repeat on</span>
					<div class="flex flex-wrap gap-2">
						{#each weekDays as day}
							<button type="button" onclick={() => toggleDay(day.name)} class={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${selectedDays.includes(day.name) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400'}`} aria-pressed={selectedDays.includes(day.name)}>{day.short}</button>
						{/each}
					</div>
				</div>
				<div class="mt-5 flex justify-end">
					<button disabled={saving || selectedDays.length === 0} type="submit" class="rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'Save routine'}</button>
				</div>
			</form>
		{/if}

		{#if errorMessage}
			<div class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
		{/if}

		{#if loading}
			<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading your routines…</div>
		{:else if !currentUser}
			<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
				<h2 class="text-lg font-bold text-slate-800">Sign in to manage routines</h2>
				<p class="mt-2 text-slate-500">Your recurring checklist will be saved to your account.</p>
			</div>
		{:else}
			<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{#each weekDays as day}
					<section class="flex min-h-72 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
						<div class="mb-4 flex items-start justify-between border-b border-slate-100 pb-3">
							<div>
								<h2 class="font-bold text-slate-900">{day.name}</h2>
								<p class="text-xs text-slate-400">{formattedDate(day.index)}</p>
							</div>
							<span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">{routinesForDay(day.name).length}</span>
						</div>
						<div class="flex flex-1 flex-col gap-2">
							{#each routinesForDay(day.name) as routine (routine.id)}
								<div class={`group rounded-xl border p-3 transition ${isComplete(routine, day.name) ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50/70 hover:border-blue-200 hover:bg-blue-50/40'}`}>
									<div class="flex items-start gap-3">
										<button type="button" aria-label={`Mark ${routine.title} complete`} aria-pressed={isComplete(routine, day.name)} onclick={() => toggleComplete(routine, day.name)} class={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${isComplete(routine, day.name) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-transparent hover:border-blue-500'}`}>
											<svg aria-hidden="true" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="m5 12 4 4L19 6" /></svg>
										</button>
										<div class="min-w-0 flex-1">
											<p class={`text-sm font-semibold ${isComplete(routine, day.name) ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>{routine.title}</p>
											<p class="mt-1 text-xs font-medium text-slate-400">{routine.category}</p>
										</div>
										<button type="button" aria-label={`Delete ${routine.title}`} onclick={() => removeRoutine(routine)} class="text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100">✕</button>
									</div>
								</div>
							{:else}
								<p class="flex flex-1 items-center justify-center py-8 text-center text-sm text-slate-400">No routines planned</p>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	</div>
</main>
