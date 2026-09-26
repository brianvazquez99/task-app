<script lang="ts">
	import { auth, db } from '$lib/firebase/firebase.app';
	import { onAuthStateChanged, type User } from 'firebase/auth';
	import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
	import { onMount } from 'svelte';

	type RoutineCategory = {
		id: string;
		name: string;
		order: number;
		userId: string;
	};
	type Routine = {
		id: string;
		title: string;
		category: string;
		days: string[];
		completedKeys: string[];
		userId: string;
	};

	const defaultCategoryNames = ['Morning', 'After work', 'Night'];
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
	let categories = $state<RoutineCategory[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let savingCategory = $state(false);
	let currentUser = $state<User | null>(null);
	let title = $state('');
	let category = $state('Morning');
	let newCategoryName = $state('');
	let editingCategoryId = $state<string | null>(null);
	let editedCategoryName = $state('');
	let selectedDays = $state<string[]>(['Monday', 'Wednesday', 'Friday']);
	let showForm = $state(false);
	let showCategoryManager = $state(false);
	let errorMessage = $state('');
	let categoryErrorMessage = $state('');

	function getMonday(date = new Date()) {
		const day = date.getDay();
		const daysFromMonday = day === 0 ? 6 : day - 1;
		return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysFromMonday);
	}

	function dateForDay(dayIndex: number) {
		const monday = getMonday();
		return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + dayIndex);
	}

	function dateKeyForDay(dayIndex: number) {
		return dateForDay(dayIndex).toISOString().slice(0, 10);
	}

	function completionKey(dayName: string) {
		const day = weekDays.find((item) => item.name === dayName);
		return `${dateKeyForDay(day?.index ?? 0)}:${dayName}`;
	}

	function formattedDate(dayIndex: number) {
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
			dateForDay(dayIndex)
		);
	}

	function categoryOrder(categoryName: string) {
		const index = categories.findIndex((item) => item.name === categoryName);
		return index === -1 ? categories.length : index;
	}

	function routinesForDay(dayName: string) {
		return routines
			.filter((routine) => routine.days.includes(dayName))
			.sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
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
				category: String(data.category ?? 'Morning'),
				days: Array.isArray(data.days) ? data.days : [],
				completedKeys: Array.isArray(data.completedKeys) ? data.completedKeys : [],
				userId: String(data.userId ?? userId)
			};
		});
	}

	async function loadCategories(userId: string) {
		if (!db) return;
		const snapshot = await getDocs(query(collection(db, 'Routine Categories'), where('userId', '==', userId)));

		if (snapshot.empty) {
			const batch = writeBatch(db);
			const initialCategories = defaultCategoryNames.map((name, order) => {
				const categoryRef = doc(collection(db!, 'Routine Categories'));
				batch.set(categoryRef, { name, order, userId, createdAt: serverTimestamp() });
				return { id: categoryRef.id, name, order, userId };
			});
			await batch.commit();
			categories = initialCategories;
			return;
		}

		categories = snapshot.docs
			.map((categoryDoc) => {
				const data = categoryDoc.data();
				return {
					id: categoryDoc.id,
					name: String(data.name ?? ''),
					order: Number(data.order ?? 0),
					userId: String(data.userId ?? userId)
				};
			})
			.filter((item) => item.name)
			.sort((a, b) => a.order - b.order);
	}

	function categoryNameExists(name: string, excludedId?: string) {
		return categories.some(
			(item) => item.id !== excludedId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase()
		);
	}

	async function addCategory(event: SubmitEvent) {
		event.preventDefault();
		const name = newCategoryName.trim();
		if (!db || !currentUser || !name) return;
		if (categoryNameExists(name)) {
			categoryErrorMessage = 'A category with this name already exists.';
			return;
		}

		savingCategory = true;
		categoryErrorMessage = '';
		try {
			const newCategory = {
				name,
				order: categories.length,
				userId: currentUser.uid,
				createdAt: serverTimestamp()
			};
			const categoryRef = await addDoc(collection(db, 'Routine Categories'), newCategory);
			categories = [...categories, { id: categoryRef.id, ...newCategory }];
			category = name;
			newCategoryName = '';
		} catch (error) {
			console.error(error);
			categoryErrorMessage = 'Unable to add this category. Please try again.';
		} finally {
			savingCategory = false;
		}
	}

	function startEditingCategory(item: RoutineCategory) {
		editingCategoryId = item.id;
		editedCategoryName = item.name;
		categoryErrorMessage = '';
	}

	async function renameCategory(item: RoutineCategory) {
		const name = editedCategoryName.trim();
		if (!db || !name || name === item.name) {
			editingCategoryId = null;
			return;
		}
		if (categoryNameExists(name, item.id)) {
			categoryErrorMessage = 'A category with this name already exists.';
			return;
		}

		savingCategory = true;
		categoryErrorMessage = '';
		try {
			const batch = writeBatch(db);
			batch.update(doc(db, 'Routine Categories', item.id), { name });
			for (const routine of routines.filter((entry) => entry.category === item.name)) {
				batch.update(doc(db, 'Routines', routine.id), { category: name });
			}
			await batch.commit();
			categories = categories.map((entry) => (entry.id === item.id ? { ...entry, name } : entry));
			routines = routines.map((routine) =>
				routine.category === item.name ? { ...routine, category: name } : routine
			);
			if (category === item.name) category = name;
			editingCategoryId = null;
		} catch (error) {
			console.error(error);
			categoryErrorMessage = 'Unable to rename this category. Please try again.';
		} finally {
			savingCategory = false;
		}
	}

	async function removeCategory(item: RoutineCategory) {
		if (!db || categories.length === 1) {
			categoryErrorMessage = 'You need at least one category.';
			return;
		}

		const affectedRoutineCount = routines.filter((routine) => routine.category === item.name).length;
		const fallbackCategory = categories.find((entry) => entry.id !== item.id)!;
		const message = affectedRoutineCount
			? `Delete “${item.name}”? ${affectedRoutineCount} routine${affectedRoutineCount === 1 ? '' : 's'} will move to “${fallbackCategory.name}”.`
			: `Delete “${item.name}”?`;
		if (!window.confirm(message)) return;

		savingCategory = true;
		categoryErrorMessage = '';
		try {
			const batch = writeBatch(db);
			for (const routine of routines.filter((entry) => entry.category === item.name)) {
				batch.update(doc(db, 'Routines', routine.id), { category: fallbackCategory.name });
			}
			batch.delete(doc(db, 'Routine Categories', item.id));
			await batch.commit();
			categories = categories.filter((entry) => entry.id !== item.id);
			routines = routines.map((routine) =>
				routine.category === item.name ? { ...routine, category: fallbackCategory.name } : routine
			);
			if (category === item.name) category = fallbackCategory.name;
			if (editingCategoryId === item.id) editingCategoryId = null;
		} catch (error) {
			console.error(error);
			categoryErrorMessage = 'Unable to delete this category. Please try again.';
		} finally {
			savingCategory = false;
		}
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
			category = categories[0]?.name ?? 'Morning';
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
					await Promise.all([loadRoutines(user.uid), loadCategories(user.uid)]);
					category = categories.some((item) => item.name === category)
						? category
						: (categories[0]?.name ?? 'Morning');
				} catch (error) {
					console.error(error);
					errorMessage = 'Unable to load your routines.';
				}
			} else {
				routines = [];
				categories = [];
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
			<div class="flex flex-col gap-2 sm:flex-row">
				<button
					type="button"
					onclick={() => (showCategoryManager = !showCategoryManager)}
					class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
				>
					Manage categories
				</button>
				<button
					type="button"
					onclick={() => (showForm = !showForm)}
					class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
				>
					<svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 5v14m-7-7h14" /></svg>
					Add routine
				</button>
			</div>
		</div>

		{#if showCategoryManager && currentUser}
			<section class="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
				<div class="mb-5 flex items-start justify-between gap-4">
					<div>
						<h2 class="text-lg font-bold text-slate-900">Manage categories</h2>
						<p class="text-sm text-slate-500">Add categories or change how your routines are grouped.</p>
					</div>
					<button type="button" aria-label="Close category manager" onclick={() => (showCategoryManager = false)} class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
				</div>

				{#if categoryErrorMessage}
					<div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{categoryErrorMessage}</div>
				{/if}

				<div class="divide-y divide-slate-100 rounded-xl border border-slate-200">
					{#each categories as item (item.id)}
						<div class="flex min-h-16 items-center gap-3 px-4 py-3">
							{#if editingCategoryId === item.id}
								<form class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row" onsubmit={(event) => { event.preventDefault(); renameCategory(item); }}>
									<label class="sr-only" for={`category-${item.id}`}>Category name</label>
									<input id={`category-${item.id}`} required maxlength="50" bind:value={editedCategoryName} class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
									<div class="flex gap-2">
										<button type="submit" disabled={savingCategory} class="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">Save</button>
										<button type="button" disabled={savingCategory} onclick={() => (editingCategoryId = null)} class="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
									</div>
								</form>
							{:else}
								<div class="min-w-0 flex-1">
									<p class="truncate font-semibold text-slate-800">{item.name}</p>
									<p class="text-xs text-slate-400">{routines.filter((routine) => routine.category === item.name).length} routines</p>
								</div>
								<button type="button" disabled={savingCategory} onclick={() => startEditingCategory(item)} class="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50">Edit</button>
								<button type="button" disabled={savingCategory || categories.length === 1} onclick={() => removeCategory(item)} class="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
							{/if}
						</div>
					{/each}
				</div>

				<form onsubmit={addCategory} class="mt-5 flex flex-col gap-2 sm:flex-row">
					<label class="sr-only" for="new-category">New category name</label>
					<input id="new-category" required maxlength="50" bind:value={newCategoryName} placeholder="e.g. Lunch break" class="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
					<button type="submit" disabled={savingCategory || !newCategoryName.trim()} class="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{savingCategory ? 'Saving…' : 'Add category'}</button>
				</form>
			</section>
		{/if}

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
						<select required bind:value={category} class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
							{#each categories as option (option.id)}
								<option value={option.name}>{option.name}</option>
							{/each}
						</select>
					</label>
				</div>
				<div class="mt-5">
					<span class="mb-2 block text-sm font-semibold text-slate-700">Repeat on</span>
					<div class="flex flex-wrap gap-2">
						{#each weekDays as day (day.name)}
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
				{#each weekDays as day (day.name)}
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
