/**
 * @typedef {{ key: number; memory: string; category?: string; timestamp?: string }} MemoryEntry
 */

/** Left demo forest: club activities (keys must stay below every academic-schedule key). */
export const CLUB_ACTIVITY_DATA = [
	{ key: 9, memory: 'Bits of Good' },
	{ key: 10, memory: 'Student Government Association' },
	{ key: 12, memory: 'IOS Club' },
];

/** Right demo forest: academic schedule (all keys > max club key). */
export const ACADEMIC_SCHEDULE_DATA = [
	{ key: 24, memory: 'Algorithms Honors' },
	{ key: 27, memory: 'Final Exams' },
	{ key: 32, memory: 'Systems & Networks' },
	{ key: 37, memory: 'Final Project' },
];

export const CLUB_ACTIVITY_KEYS = CLUB_ACTIVITY_DATA.map(m => m.key);

/** @deprecated Use CLUB_ACTIVITY_DATA + ACADEMIC_SCHEDULE_DATA; kept for older imports. */
export const COLLEGE_MEMORY_DATA = [...CLUB_ACTIVITY_DATA, ...ACADEMIC_SCHEDULE_DATA];

/** @type {Record<number, string>} */
export const demoMemoryByKey = COLLEGE_MEMORY_DATA.reduce((acc, m) => {
	acc[m.key] = m.memory;
	return acc;
}, {});

export const DEMO_MEMORY_KEYS = COLLEGE_MEMORY_DATA.map(m => m.key);

export function defaultMemoryForDemoKey(key) {
	return demoMemoryByKey[key] ?? null;
}

export function getNarration(op, ctx = {}) {
	const {
		key,
		memory,
		targetMemory,
		success,
		relatedKey,
		relatedMemory,
		cueMemory,
	} = ctx;
	const mem = memory ?? '';
	const tgt = targetMemory ?? mem;
	const relMem = relatedMemory ?? (relatedKey != null ? defaultMemoryForDemoKey(relatedKey) : null);

	switch (op) {
		case 'access':
			if (success) {
				return `Recalling cue ${key} activated the memory “${tgt}” and moved it to the root.`;
			}
			if (relatedKey == null) {
				return `The exact memory for cue ${key} (“${cueMemory ?? 'unknown'}”) was not found, and the network was empty so nothing else could take focus.`;
			}
			return `The exact memory was not found for cue ${key}, but a nearby related memory (“${relMem ?? 'related'}”, key ${relatedKey}) became active.`;
		case 'insert':
			return success === false
				? `That retrieval cue (key) already exists; the tree keeps one memory per key.`
				: `A new memory was encoded at key ${key} (“${mem}”) and made highly accessible.`;
		case 'delete':
			return success === false
				? `No node with that key was found to remove.`
				: `The memory at key ${key} (“${mem}”) was removed from the active structure.`;
		case 'split': {
			if (ctx.success === false) {
				if (ctx.reason === 'dual_forest') {
					return `Split needs a single combined tree. Merge or clear the two demo forests first.`;
				}
				if (ctx.reason === 'empty') {
					return `Split was skipped: there is no tree to partition.`;
				}
				if (ctx.reason === 'right_only') {
					return `Split needs the main (left) tree. Load “Club activities” first.`;
				}
				return `Split could not complete.`;
			}
			if (ctx.mode === 'at_key') {
				return `Split at cue ${ctx.splitKey}: after access and splay, key ${ctx.splitKey} was at the root; its left subtree (keys ${ctx.leftKeys ?? '—'}) and right subtree (keys ${ctx.rightKeys ?? '—'}) are now shown as two separate splay forests, with that cue removed.`;
			}
			if (ctx.mode === 'absent') {
				return `Split at absent cue ${ctx.splitKey}: access splayed key ${ctx.cutKey} to the cut point, then one child link was broken so the left forest (keys ${ctx.leftKeys ?? '—'}) and right forest (keys ${ctx.rightKeys ?? '—'}) are shown separately.`;
			}
			return `The tree was partitioned into two forests.`;
		}
		case 'join': {
			if (ctx.success === false) {
				if (ctx.reason === 'no_left') {
					return `Merge was skipped: load “Club activities” first so the left splay tree appears.`;
				}
				if (ctx.reason === 'no_right') {
					return `Merge was skipped: load “Academic schedule” so the right splay tree appears beside the club tree.`;
				}
				if (ctx.reason === 'order_keys') {
					return `Merge was skipped: every key in the right tree must be greater than every key in the left tree (min right ${ctx.minRight ?? '—'} vs max left ${ctx.maxKey ?? '—'}).`;
				}
				if (ctx.reason === 'bad_state') {
					return `Merge stopped: after splaying the largest left key, the root still had a right child (unexpected in a BST).`;
				}
				return `Merge could not complete.`;
			}
			const keys = ctx.addedKeys?.length ? ctx.addedKeys.join(', ') : '';
			const maxK = ctx.maxKey;
			return (
				`Joined club activities with academic schedule using join(t1, t2): accessed the largest club key ${maxK} at the root, then attached the academic tree (keys ${keys}). The combined view is labeled college memories.`
			);
		}
		case 'clear':
			return `The active memory network was cleared.`;
		case 'random': {
			return `Loaded the left “Club activities” tree (keys 9, 10, 12). Load “Academic schedule” for the right tree, then use “Merge Memory Groups”.`;
		}
		case 'demo':
			return `Loaded the right “Academic schedule” tree (keys 24, 27, 32, 37). Load “Club activities” on the left if needed, then use “Merge Memory Groups”.`;
		default:
			return '';
	}
}

export const MEMORY_UI_EVENT = 'memory-visualization-ui';

export function dispatchMemoryUi(detail) {
	window.dispatchEvent(new CustomEvent(MEMORY_UI_EVENT, { detail }));
}
