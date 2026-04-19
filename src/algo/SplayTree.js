// Copyright 2011 David Galles, University of San Francisco. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification, are
// permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of
// conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list
// of conditions and the following disclaimer in the documentation and/or other materials
// provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY David Galles ``AS IS'' AND ANY EXPRESS OR IMPLIED
// WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> OR
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
// ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
// NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
// ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// The views and conclusions contained in the software and documentation are those of the
// authors and should not be interpreted as representing official policies, either expressed
// or implied, of the University of San Francisco

import Algorithm, { addControlToAlgorithmBar, addDivisorToAlgorithmBar } from './Algorithm.js';
import { act } from '../anim/AnimationMain';
import {
	ACADEMIC_SCHEDULE_DATA,
	CLUB_ACTIVITY_DATA,
	defaultMemoryForDemoKey,
	demoMemoryByKey,
	dispatchMemoryUi,
	getNarration,
} from '../memoryTheme.js';

/** Remembrall-inspired palette: calm silver glass, green on recall, yellow on encode, scarlet on forget / “something’s missing”. */
const LINK_COLOR = '#475569';
const FOREGROUND_COLOR = '#0f172a';
const NODE_FILL_DEFAULT = '#f1f5f9';
const NODE_FILL_ROOT = '#dbe4f0';
const REMEMBRALL_RECALL_HALO = '#16a34a';
const REMEMBRALL_INSERT_HALO = '#eab308';
const REMEMBRALL_FORGET_HALO = '#dc2626';
const REMEMBRALL_PATH_RECALL = '#86efac';
const REMEMBRALL_PATH_INSERT = '#fde047';
const REMEMBRALL_PATH_FORGET = '#f87171';
const REMEMBRALL_SMOKE_RING = '#94a3b8';
const REMEMBRALL_MERGED_ROOT_RING = '#38bdf8';
/** Solid glass tint on the cue circle (rings alone are too subtle for the sphere metaphor). */
const REMEMBRALL_RECALL_NODE_FILL = '#bbf7d0';
const REMEMBRALL_ACCESS_MISS_NODE_FILL = '#fecaca';
const REMEMBRALL_FORGET_NODE_FILL = '#fca5a5';
const WIDTH_DELTA = 68;
const HEIGHT_DELTA = 58;
/** Root row Y — leave room above for captions + corner “college memories” label (DOM). */
const STARTING_Y = 158;
/** Club keys (left tree) are always less than academic keys (right tree). */

export default class SplayTree extends Algorithm {
	constructor(am, w, h) {
		super(am, w, h);
		this.startingX = w / 2;
		this.pendingMemoryUi = null;
		this.treeRootRight = null;
		this._lastVisitedDepth = 0;
		this._bulkMemoryLoad = false;
		this._lastInsertDuplicate = false;
		this.pendingRecentGraphicId = null;
		this.pendingRecentHighlightColor = null;

		this.addControls();
		this.nextIndex = 0;
		this.commands = [];
		this.cmd(
			act.createLabel,
			0,
			'',
			Math.floor(this.canvasWidth / 2),
			28,
			true,
		);
		this.nextIndex = 1;
		this.animationManager.startNewAnimation(this.commands);
		this.animationManager.skipForward();
		this.animationManager.clearHistory();
	}

	appendMemoryButton(label, onClick) {
		const bar = document.getElementById('AlgorithmSpecificControls');
		const td = document.createElement('td');
		td.className = 'memory-control-cell';
		const btn = document.createElement('input');
		btn.type = 'button';
		btn.value = label;
		btn.onclick = onClick;
		td.appendChild(btn);
		bar.appendChild(td);
		return btn;
	}

	/** Stacked “Club activities” + “Academic schedule” so both stay visible without overlapping. */
	appendMemoryDemoPair() {
		const bar = document.getElementById('AlgorithmSpecificControls');
		const td = document.createElement('td');
		td.className = 'memory-control-cell memory-demo-pair-cell';
		const wrap = document.createElement('div');
		wrap.className = 'memory-demo-actions';
		const mk = (label, handler) => {
			const btn = document.createElement('input');
			btn.type = 'button';
			btn.value = label;
			btn.onclick = handler;
			wrap.appendChild(btn);
			return btn;
		};
		this.randomButton = mk('Club activities', this.randomCallback.bind(this));
		this.demoButton = mk('Academic schedule', this.demoDatasetCallback.bind(this));
		td.appendChild(wrap);
		bar.appendChild(td);
	}

	addControls() {
		this.controls = [];

		this.insertField = addControlToAlgorithmBar('Text', '');
		this.insertField.style.textAlign = 'center';
		this.insertField.setAttribute('title', 'Numeric retrieval cue (BST key)');
		this.insertField.placeholder = 'Key';
		this.insertField.onkeydown = this.returnSubmit(
			this.insertField,
			this.insertCallback.bind(this),
			4,
			true,
		);
		this.controls.push(this.insertField);

		this.insertMemoryField = addControlToAlgorithmBar('Text', '');
		this.insertMemoryField.style.textAlign = 'left';
		this.insertMemoryField.style.minWidth = '140px';
		this.insertMemoryField.setAttribute('title', 'Text stored with this key');
		this.insertMemoryField.placeholder = 'Memory';
		this.insertMemoryField.onkeydown = e => {
			const keyASCII = e.which != null ? e.which : e.keyCode;
			if (keyASCII === 13) {
				this.insertCallback();
			}
		};
		this.controls.push(this.insertMemoryField);

		this.insertButton = this.appendMemoryButton('Encode Memory', this.insertCallback.bind(this));
		this.controls.push(this.insertButton);

		addDivisorToAlgorithmBar();

		this.deleteField = addControlToAlgorithmBar('Text', '');
		this.deleteField.style.textAlign = 'center';
		this.deleteField.setAttribute('title', 'Numeric memory key to forget');
		this.deleteField.placeholder = 'Key';
		this.deleteField.onkeydown = this.returnSubmit(
			this.deleteField,
			this.deleteCallback.bind(this),
			4,
			true,
		);
		this.controls.push(this.deleteField);

		this.deleteButton = this.appendMemoryButton('Forget Memory', this.deleteCallback.bind(this));
		this.controls.push(this.deleteButton);

		addDivisorToAlgorithmBar();

		this.findField = addControlToAlgorithmBar('Text', '');
		this.findField.style.textAlign = 'center';
		this.findField.setAttribute('title', 'Numeric memory key to recall');
		this.findField.placeholder = 'Key';
		this.findField.onkeydown = this.returnSubmit(
			this.findField,
			this.findCallback.bind(this),
			4,
			true,
		);
		this.controls.push(this.findField);

		this.findButton = this.appendMemoryButton('Recall Memory', this.findCallback.bind(this));
		this.controls.push(this.findButton);

		addDivisorToAlgorithmBar();

		this.appendMemoryDemoPair();
		this.controls.push(this.randomButton, this.demoButton);

		addDivisorToAlgorithmBar();

		this.joinButton = this.appendMemoryButton('Merge Memory Groups', () =>
			this.implementAction(this.joinMergeElement.bind(this)),
		);
		this.controls.push(this.joinButton);

		addDivisorToAlgorithmBar();

		this.splitField = addControlToAlgorithmBar('Text', '');
		this.splitField.style.textAlign = 'center';
		this.splitField.setAttribute('title', 'Numeric cue i for split(i, T): access(i) then partition');
		this.splitField.placeholder = 'Key';
		this.splitField.onkeydown = this.returnSubmit(
			this.splitField,
			this.splitCallback.bind(this),
			4,
			true,
		);
		this.controls.push(this.splitField);

		this.splitButton = this.appendMemoryButton(
			'Partition Memory Group',
			this.splitCallback.bind(this),
		);
		this.controls.push(this.splitButton);

		addDivisorToAlgorithmBar();

		this.clearButton = this.appendMemoryButton('Clear Rememberall', this.clearCallback.bind(this));
		this.controls.push(this.clearButton);
	}

	/** Largest BST key (right spine); no animation. */
	maxKeyInTree(root) {
		let n = root;
		while (n.right != null) n = n.right;
		return n.data;
	}

	/**
	 * Balanced BST from sorted { key, memory } entries (creates circles off-layout; layout follows).
	 */
	buildBalancedBSTFromSortedEntries(entries, lo, hi) {
		if (lo > hi) return null;
		const mid = Math.floor((lo + hi) / 2);
		const row = entries[mid];
		const id = this.nextIndex++;
		const label = String(row.key);
		const offY = STARTING_Y + 420;
		this.cmd(act.createCircle, id, label, this.startingX, offY);
		this.cmd(act.setForegroundColor, id, FOREGROUND_COLOR);
		this.cmd(act.setBackgroundColor, id, NODE_FILL_DEFAULT);
		const node = new BSTNode(row.key, id, this.startingX, offY, row.memory);
		node.left = this.buildBalancedBSTFromSortedEntries(entries, lo, mid - 1);
		node.right = this.buildBalancedBSTFromSortedEntries(entries, mid + 1, hi);
		if (node.left != null) {
			node.left.parent = node;
			this.cmd(act.connect, id, node.left.graphicID, LINK_COLOR);
		}
		if (node.right != null) {
			node.right.parent = node;
			this.cmd(act.connect, id, node.right.graphicID, LINK_COLOR);
		}
		return node;
	}

	minKeyInTree(root) {
		let n = root;
		while (n.left != null) n = n.left;
		return n.data;
	}

	collectKeysInOrder(root, out) {
		if (root == null) return;
		this.collectKeysInOrder(root.left, out);
		out.push(root.data);
		this.collectKeysInOrder(root.right, out);
	}

	/** True when both demo forests are on screen (before merge). */
	isDualForestMode() {
		return this.treeRoot != null && this.treeRootRight != null;
	}

	reloadLeftSampleForest() {
		this.commands = [];
		this.recClear(this.treeRoot);
		this.treeRoot = null;
		const entries = [...CLUB_ACTIVITY_DATA].sort((a, b) => a.key - b.key);
		const clubKeys = entries.map(e => e.key);
		this.treeRoot = this.buildBalancedBSTFromSortedEntries(entries, 0, entries.length - 1);
		this.syncForestLayout();
		this.pendingMemoryUi = {
			narration: getNarration('random', { keys: clubKeys }),
			recallDifficultyBefore: null,
			recallDifficultyAfter: null,
			lastOperation: 'random',
		};
		this.pendingRecentGraphicId = this.treeRoot != null ? this.treeRoot.graphicID : null;
		this.pendingRecentHighlightColor = this.pendingRecentGraphicId != null ? REMEMBRALL_SMOKE_RING : null;
		return this.commands;
	}

	reloadRightCollegeForest() {
		this.commands = [];
		this.recClear(this.treeRootRight);
		this.treeRootRight = null;
		const entries = [...ACADEMIC_SCHEDULE_DATA].sort((a, b) => a.key - b.key);
		this.treeRootRight = this.buildBalancedBSTFromSortedEntries(
			entries,
			0,
			entries.length - 1,
		);
		this.syncForestLayout();
		this.pendingMemoryUi = {
			narration: getNarration('demo'),
			recallDifficultyBefore: null,
			recallDifficultyAfter: null,
			lastOperation: 'demo',
		};
		this.pendingRecentGraphicId =
			this.treeRootRight != null ? this.treeRootRight.graphicID : null;
		this.pendingRecentHighlightColor =
			this.pendingRecentGraphicId != null ? REMEMBRALL_SMOKE_RING : null;
		return this.commands;
	}

	layoutSingleForest(root, centerX) {
		if (root == null) return;
		let startingPoint = centerX;
		this.resizeWidths(root);
		if (root.leftWidth > startingPoint) {
			startingPoint = root.leftWidth;
		} else if (root.rightWidth > startingPoint) {
			startingPoint = Math.max(root.leftWidth, 2 * centerX - root.rightWidth);
		}
		this.setNewPositions(root, startingPoint, STARTING_Y, 0);
		this.animateNewPositions(root);
	}

	syncForestLayout() {
		if (this.treeRoot != null && this.treeRootRight != null) {
			this.layoutSingleForest(this.treeRoot, this.canvasWidth * 0.26);
			this.layoutSingleForest(this.treeRootRight, this.canvasWidth * 0.72);
			this.applyMemoryDepthStyleCommands();
			this.cmd(act.step);
			return;
		}
		if (this.treeRoot != null) {
			this.layoutSingleForest(this.treeRoot, this.startingX);
			this.applyMemoryDepthStyleCommands();
			this.cmd(act.step);
			return;
		}
		if (this.treeRootRight != null) {
			this.layoutSingleForest(this.treeRootRight, this.startingX);
			this.applyMemoryDepthStyleCommands();
			this.cmd(act.step);
		}
	}

	updateManualOpLocks() {
		const blockManual =
			this.isDualForestMode() ||
			(this.treeRootRight != null && this.treeRoot == null);
		const lockables = [
			this.insertField,
			this.insertMemoryField,
			this.insertButton,
			this.deleteField,
			this.deleteButton,
			this.findField,
			this.findButton,
			this.splitField,
			this.splitButton,
		];
		for (let i = 0; i < lockables.length; i++) {
			const el = lockables[i];
			if (el) el.disabled = blockManual;
		}
	}

	joinMergeElement() {
		this.commands = [];
		this.pendingRecentGraphicId = null;
		this.pendingRecentHighlightColor = null;

		if (this.treeRoot == null) {
			this.cmd(
				act.setText,
				0,
				'Merge: load the left “Club activities” tree first.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			this.pendingMemoryUi = {
				narration: getNarration('join', { success: false, reason: 'no_left' }),
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'join',
			};
			return this.commands;
		}

		if (this.treeRootRight == null) {
			this.cmd(
				act.setText,
				0,
				'Merge: load the right “Academic schedule” tree so two forests are on screen.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			this.pendingMemoryUi = {
				narration: getNarration('join', { success: false, reason: 'no_right' }),
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'join',
			};
			return this.commands;
		}

		const maxKey = this.maxKeyInTree(this.treeRoot);
		const minRight = this.minKeyInTree(this.treeRootRight);
		if (minRight <= maxKey) {
			this.cmd(
				act.setText,
				0,
				`Join needs every right key > every left key (min right ${minRight}, max left ${maxKey}).`,
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			this.pendingMemoryUi = {
				narration: getNarration('join', {
					success: false,
					reason: 'order_keys',
					maxKey,
					minRight,
				}),
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'join',
			};
			return this.commands;
		}

		const addedKeys = [];
		this.collectKeysInOrder(this.treeRootRight, addedKeys);
		const keysStr = addedKeys.join(', ');

		this.cmd(
			act.setText,
			0,
			`Join(t1, t2): every key in the right tree must be larger than every key in the left tree (min right ${minRight} > max left ${maxKey}).`,
		);
		this.cmd(act.step);

		this.cmd(
			act.setText,
			0,
			`Step 1 — access(${maxKey}, t1): splay the largest item in the left tree to the root.`,
		);
		this.cmd(act.step);

		this.highlightID = this.nextIndex++;
		this.doFind(this.treeRoot, maxKey, 0);

		if (this.treeRoot == null || this.treeRoot.data !== maxKey || this.treeRoot.right != null) {
			this.cmd(
				act.setText,
				0,
				'Merge aborted: expected largest key at root with an empty right child.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			this.pendingMemoryUi = {
				narration: getNarration('join', { success: false, reason: 'bad_state' }),
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'join',
			};
			return this.commands;
		}

		this.cmd(
			act.setText,
			0,
			`Largest left key ${maxKey} (“${this.memoryString(this.treeRoot)}”) is now at the root with a null right child.`,
		);
		this.cmd(act.step);

		this.cmd(
			act.setText,
			0,
			`Step 2 — complete join: attach the academic-schedule tree (keys ${keysStr}) as the root’s right subtree.`,
		);
		this.cmd(act.step);

		const t2Root = this.treeRootRight;
		this.treeRootRight = null;

		this.cmd(
			act.setText,
			0,
			'Linked the academic tree; laying out the combined College memories network.',
		);
		this.cmd(act.step);

		this.cmd(act.connect, this.treeRoot.graphicID, t2Root.graphicID, LINK_COLOR);
		this.treeRoot.right = t2Root;
		t2Root.parent = this.treeRoot;

		this.resizeTree();
		this.cmd(act.setText, 0, '');
		this.pendingMemoryUi = {
			narration: getNarration('join', {
				success: true,
				maxKey,
				addedKeys,
			}),
			recallDifficultyBefore: null,
			recallDifficultyAfter: 0,
			lastOperation: 'join',
			showMergedCollegeTitle: true,
		};
		this.pendingRecentGraphicId = this.treeRoot.graphicID;
		this.pendingRecentHighlightColor = REMEMBRALL_MERGED_ROOT_RING;
		return this.commands;
	}

	keysStringFromForest(root) {
		if (root == null) return '';
		const out = [];
		this.collectKeysInOrder(root, out);
		return out.join(', ');
	}

	splitCallback() {
		let v = this.normalizeNumber(this.splitField.value, 4);
		if (v === '') {
			this.shake(this.splitButton);
			return;
		}
		this.splitField.value = '';
		this.implementAction(this.splitAtKeyElement.bind(this), parseInt(v, 10));
	}

	splitAtKeyElement(splitKey) {
		this.commands = [];
		this.pendingRecentGraphicId = null;
		this.pendingRecentHighlightColor = null;

		if (this.isDualForestMode()) {
			this.cmd(
				act.setText,
				0,
				'Split needs one combined tree — merge the demo forests or clear first.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			this.pendingMemoryUi = {
				narration: getNarration('split', { success: false, reason: 'dual_forest' }),
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'split',
			};
			return this.commands;
		}

		if (this.treeRootRight != null && this.treeRoot == null) {
			this.cmd(
				act.setText,
				0,
				'Split needs the main tree on the left — load “Club activities” first.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			this.pendingMemoryUi = {
				narration: getNarration('split', { success: false, reason: 'right_only' }),
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'split',
			};
			return this.commands;
		}

		if (this.treeRoot == null) {
			this.cmd(act.setText, 0, 'Nothing to split — the network is empty.');
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			this.pendingMemoryUi = {
				narration: getNarration('split', { success: false, reason: 'empty' }),
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'split',
			};
			return this.commands;
		}

		this.cmd(
			act.setText,
			0,
			`Split(${splitKey}, T): perform access(${splitKey}, T) — splaying along the search path.`,
		);
		this.cmd(act.step);

		this._visitHighlightColor = REMEMBRALL_RECALL_HALO;
		this._pathRingColor = REMEMBRALL_PATH_RECALL;
		this.highlightID = this.nextIndex++;
		const found = this.doFind(this.treeRoot, splitKey, 0);
		const r = this.treeRoot;

		if (r == null) {
			this.cmd(act.setText, 0, 'Split aborted — tree became empty.');
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			this.pendingMemoryUi = {
				narration: getNarration('split', { success: false, reason: 'empty' }),
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'split',
			};
			return this.commands;
		}

		if (found) {
			this.cmd(
				act.setText,
				0,
				`Key ${splitKey} is at the root after access. Left subtree holds keys < ${splitKey}, right subtree holds keys > ${splitKey}. Detaching both yields two forests (root cue removed).`,
			);
			this.cmd(act.step);

			const L = r.left;
			const R = r.right;
			if (L != null) {
				this.cmd(act.disconnect, r.graphicID, L.graphicID);
				L.parent = null;
				r.left = null;
			}
			if (R != null) {
				this.cmd(act.disconnect, r.graphicID, R.graphicID);
				R.parent = null;
				r.right = null;
			}
			this.cmd(act.delete, r.graphicID);

			this.treeRoot = L;
			this.treeRootRight = R;

			this.cmd(act.setText, 0, 'Laying out the two trees after split…');
			this.cmd(act.step);
			this.syncForestLayout();
			this.cmd(act.setText, 0, '');

			const lk = this.keysStringFromForest(L) || '—';
			const rk = this.keysStringFromForest(R) || '—';
			this.pendingMemoryUi = {
				narration: getNarration('split', {
					success: true,
					mode: 'at_key',
					splitKey,
					leftKeys: lk,
					rightKeys: rk,
				}),
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'split',
			};
			return this.commands;
		}

		const cutKey = r.data;
		const isSuccCase = cutKey > splitKey;

		if (isSuccCase) {
			this.cmd(
				act.setText,
				0,
				`Cue ${splitKey} is not stored. The splay stopped at ${cutKey} (smallest key on the search path that is > ${splitKey}). Breaking the left child link separates keys < ${cutKey} from keys ≥ ${cutKey}.`,
			);
			this.cmd(act.step);
			const L = r.left;
			if (L != null) {
				this.cmd(act.disconnect, r.graphicID, L.graphicID);
				L.parent = null;
				r.left = null;
			}
			this.treeRoot = L;
			this.treeRootRight = r;
		} else {
			this.cmd(
				act.setText,
				0,
				`Cue ${splitKey} is not stored. The splay stopped at ${cutKey} (largest key on the search path that is < ${splitKey}). Breaking the right child link separates keys ≤ ${cutKey} from keys > ${cutKey}.`,
			);
			this.cmd(act.step);
			const R = r.right;
			if (R != null) {
				this.cmd(act.disconnect, r.graphicID, R.graphicID);
				R.parent = null;
				r.right = null;
			}
			this.treeRoot = r;
			this.treeRootRight = R;
		}

		this.cmd(act.setText, 0, 'Laying out the two trees after split…');
		this.cmd(act.step);
		this.syncForestLayout();
		this.cmd(act.setText, 0, '');

		const lk = this.keysStringFromForest(this.treeRoot) || '—';
		const rk = this.keysStringFromForest(this.treeRootRight) || '—';
		this.pendingMemoryUi = {
			narration: getNarration('split', {
				success: true,
				mode: 'absent',
				splitKey,
				cutKey,
				leftKeys: lk,
				rightKeys: rk,
			}),
			recallDifficultyBefore: null,
			recallDifficultyAfter: null,
			lastOperation: 'split',
		};
		return this.commands;
	}

	setURLData(searchParams) {
		const dataList = searchParams
			.get('data')
			.split(',')
			.filter(item => item.trim() !== '');
		dataList.forEach(dataEntry => {
			const k = parseInt(dataEntry, 10);
			const mem = defaultMemoryForDemoKey(k) || '';
			this.implementAction(this.insertElement.bind(this), k, mem);
			this.animationManager.skipForward();
			this.animationManager.clearHistory();
		});
	}

	reset() {
		this.nextIndex = 1;
		this.treeRoot = null;
		this.treeRootRight = null;
	}

	insertCallback() {
		let insertedValue = this.insertField.value;
		insertedValue = this.normalizeNumber(insertedValue, 4);
		if (insertedValue !== '') {
			const memoryText = (this.insertMemoryField.value || '').trim();
			this.insertField.value = '';
			this.insertMemoryField.value = '';
			this.implementAction(this.insertElement.bind(this), parseInt(insertedValue, 10), memoryText);
		} else {
			this.shake(this.insertButton);
		}
	}

	deleteCallback() {
		let deletedValue = this.deleteField.value;
		if (deletedValue !== '') {
			deletedValue = this.normalizeNumber(deletedValue, 4);
			this.deleteField.value = '';
			this.implementAction(this.deleteElement.bind(this), parseInt(deletedValue));
		} else {
			this.shake(this.deleteButton);
		}
	}

	randomCallback() {
		this._bulkMemoryLoad = true;
		this.implementAction(this.reloadLeftSampleForest.bind(this));
		this._bulkMemoryLoad = false;
		this._applyPendingRecentHighlight();
	}

	demoDatasetCallback() {
		this._bulkMemoryLoad = true;
		this.implementAction(this.reloadRightCollegeForest.bind(this));
		this._bulkMemoryLoad = false;
		this._applyPendingRecentHighlight();
	}

	//  TODO:  This top-down version is broken.  Don't use
	splay(value) {
		if (this.treeRoot == null) {
			return false;
		}
		if (this.treeRoot.data === value) {
			return true;
		}
		if (value < this.treeRoot.data) {
			if (this.treeRoot.left == null) {
				return false;
			} else if (this.treeRoot.left.data === value) {
				this.singleRotateRight(this.treeRoot);
				return true;
			} else if (value < this.treeRoot.left.data) {
				if (this.treeRoot.left.left == null) {
					this.singleRotateRight(this.treeRoot);
					return this.splay(value);
				} else {
					this.zigZigRight(this.treeRoot);
					return this.splay(value);
				}
			} else {
				if (this.treeRoot.left.right == null) {
					this.singleRotateRight(this.treeRoot);
					return this.splay(value);
				} else {
					this.doubleRotateRight(this.treeRoot);
					return this.splay(value);
				}
			}
		} else {
			if (this.treeRoot.right == null) {
				return false;
			} else if (this.treeRoot.right.data === value) {
				this.singleRotateLeft(this.treeRoot);
				return true;
			} else if (value > this.treeRoot.right.data) {
				if (this.treeRoot.right.right == null) {
					this.singleRotateLeft(this.treeRoot);
					return this.splay(value);
				} else {
					this.zigZigLeft(this.treeRoot);
					return this.splay(value);
				}
			} else {
				if (this.treeRoot.right.left == null) {
					this.singleRotateLeft(this.treeRoot);
					return this.splay(value);
				} else {
					this.doubleRotateLeft(this.treeRoot);
					return this.splay(value);
				}
			}
		}
	}

	clearCallback() {
		this.implementAction(this.clear.bind(this));
	}

	clear() {
		this.insertField.value = '';
		this.insertMemoryField.value = '';
		this.deleteField.value = '';
		this.findField.value = '';
		this.splitField.value = '';
		this.commands = [];
		this.recClear(this.treeRoot);
		this.treeRoot = null;
		this.recClear(this.treeRootRight);
		this.treeRootRight = null;
		if (!this._bulkMemoryLoad) {
			this.pendingMemoryUi = {
				narration: getNarration('clear'),
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'clear',
			};
		}
		this.pendingRecentGraphicId = null;
		this.pendingRecentHighlightColor = null;
		return this.commands;
	}

	recClear(curr) {
		if (curr != null) {
			this.cmd(act.delete, curr.graphicID);
			this.recClear(curr.left);
			this.recClear(curr.right);
		}
	}

	_depthIfPresentIn(root, value) {
		let d = 0;
		let n = root;
		while (n != null) {
			if (n.data === value) return d;
			if (value < n.data) n = n.left;
			else n = n.right;
			d++;
		}
		return -1;
	}

	depthIfPresent(value) {
		let d = this._depthIfPresentIn(this.treeRoot, value);
		if (d >= 0) return d;
		return this._depthIfPresentIn(this.treeRootRight, value);
	}

	_depthOfNodeIn(root, target) {
		let d = 0;
		let n = root;
		while (n != null) {
			if (n === target) return d;
			if (target.data < n.data) n = n.left;
			else n = n.right;
			d++;
		}
		return -1;
	}

	depthOfNode(target) {
		let d = this._depthOfNodeIn(this.treeRoot, target);
		if (d >= 0) return d;
		return this._depthOfNodeIn(this.treeRootRight, target);
	}

	_findNodeIn(root, key) {
		let n = root;
		while (n != null) {
			if (n.data === key) return n;
			if (key < n.data) n = n.left;
			else n = n.right;
		}
		return null;
	}

	findNodeByKey(key) {
		const a = this._findNodeIn(this.treeRoot, key);
		if (a != null) return a;
		return this._findNodeIn(this.treeRootRight, key);
	}

	memoryString(node) {
		if (node == null) return '';
		const m = node.memory != null ? String(node.memory).trim() : '';
		if (m) return m;
		return defaultMemoryForDemoKey(node.data) || `Cue ${node.data}`;
	}

	circleLabelForNode(node) {
		return String(node.data);
	}

	cueLabelForKey(key) {
		const n = this.findNodeByKey(key);
		if (n) return this.memoryString(n);
		return defaultMemoryForDemoKey(key) || `no memory stored at key ${key}`;
	}

	applyMemoryDepthStyleCommands() {
		if (this.treeRoot == null && this.treeRootRight == null) return;
		const walk = (node, depth) => {
			if (node == null) return;
			const label = this.circleLabelForNode(node);
			const width = depth === 0 ? 58 : depth >= 3 ? 38 : 48;
			const alpha = depth >= 3 ? 0.65 : 1;
			const bg = depth === 0 ? NODE_FILL_ROOT : NODE_FILL_DEFAULT;
			this.cmd(act.setText, node.graphicID, label);
			this.cmd(act.setWidth, node.graphicID, width);
			this.cmd(act.setAlpha, node.graphicID, alpha);
			this.cmd(act.setBackgroundColor, node.graphicID, bg);
			walk(node.left, depth + 1);
			walk(node.right, depth + 1);
		};
		if (this.treeRoot != null) walk(this.treeRoot, 0);
		if (this.treeRootRight != null) walk(this.treeRootRight, 0);
	}

	_flushPendingMemoryUi() {
		if (this.pendingMemoryUi == null) return;
		dispatchMemoryUi(this.pendingMemoryUi);
		this.pendingMemoryUi = null;
	}

	_clearRecentRecallHighlight() {
		const om = this.animationManager?.animatedObjects;
		if (!om) return;
		const walk = n => {
			if (n == null) return;
			om.setHighlight(n.graphicID, false);
			walk(n.left);
			walk(n.right);
		};
		walk(this.treeRoot);
		walk(this.treeRootRight);
		om.draw();
	}

	_applyPendingRecentHighlight() {
		const om = this.animationManager?.animatedObjects;
		if (!om || this.pendingRecentGraphicId == null) return;
		const ring =
			this.pendingRecentHighlightColor != null
				? this.pendingRecentHighlightColor
				: REMEMBRALL_SMOKE_RING;
		om.setHighlight(this.pendingRecentGraphicId, true, ring);
		om.draw();
	}

	findCallback() {
		const findValue = this.normalizeNumber(this.findField.value, 4);
		if (findValue !== '') {
			this.findField.value = '';
			this.implementAction(this.findElement.bind(this), parseInt(findValue));
		} else {
			this.shake(this.findButton);
		}
	}

	findElement(findValue) {
		this.commands = [];
		if (this.isDualForestMode()) {
			this.cmd(
				act.setText,
				0,
				'Recall is disabled while two demo trees are on screen — merge first.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			this.pendingMemoryUi = {
				narration:
					'Recall is turned off until the two demo trees are merged into one network.',
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'access',
			};
			return this.commands;
		}
		if (this.treeRootRight != null && this.treeRoot == null) {
			this.cmd(
				act.setText,
				0,
				'Recall is disabled until you load “Club activities” on the left.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			this.pendingMemoryUi = {
				narration:
					'Load “Club activities” so the left tree exists; then merge before using recall.',
				recallDifficultyBefore: null,
				recallDifficultyAfter: null,
				lastOperation: 'access',
			};
			return this.commands;
		}
		this._lastVisitedDepth = 0;

		const cueMemory = this.cueLabelForKey(findValue);
		const depthBeforeKnown = this.depthIfPresent(findValue);

		this._visitHighlightColor = REMEMBRALL_RECALL_HALO;
		this._pathRingColor = REMEMBRALL_PATH_RECALL;
		this.highlightID = this.nextIndex++;

		const found = this.doFind(this.treeRoot, findValue, 0);

		let depthBeforeRecall = null;
		if (this.treeRoot != null) {
			if (found && depthBeforeKnown >= 0) {
				depthBeforeRecall = depthBeforeKnown;
			} else if (!found) {
				depthBeforeRecall = this._lastVisitedDepth;
			}
		}

		const targetMem =
			found && this.treeRoot != null ? this.memoryString(this.treeRoot) : cueMemory;
		const relatedMem =
			!found && this.treeRoot != null ? this.memoryString(this.treeRoot) : null;

		if (found) {
			this.cmd(
				act.setText,
				0,
				'Recalled cue ' + findValue + ' — “' + targetMem + '” is now at the root.',
			);
		} else if (this.treeRoot != null) {
			this.cmd(
				act.setText,
				0,
				'Attempted recall failed for cue ' +
					findValue +
					', but “' +
					relatedMem +
					'” became most accessible.',
			);
		} else {
			this.cmd(
				act.setText,
				0,
				'No memories in the network; recall impossible for key ' + findValue + '.',
			);
		}

		if (this.treeRoot != null) {
			const nodeGlass = found
				? REMEMBRALL_RECALL_NODE_FILL
				: REMEMBRALL_ACCESS_MISS_NODE_FILL;
			this.cmd(act.setBackgroundColor, this.treeRoot.graphicID, nodeGlass);
			this.cmd(act.step);
		}

		this.pendingMemoryUi = {
			narration: getNarration('access', {
				key: findValue,
				success: found,
				targetMemory: targetMem,
				relatedKey: !found && this.treeRoot ? this.treeRoot.data : undefined,
				relatedMemory: relatedMem,
				cueMemory,
			}),
			recallDifficultyBefore: depthBeforeRecall,
			recallDifficultyAfter: this.treeRoot != null ? 0 : null,
			lastOperation: 'access',
		};

		if (this.treeRoot != null) {
			this.pendingRecentGraphicId = this.treeRoot.graphicID;
			this.pendingRecentHighlightColor = found
				? REMEMBRALL_RECALL_HALO
				: REMEMBRALL_FORGET_HALO;
		} else {
			this.pendingRecentGraphicId = null;
			this.pendingRecentHighlightColor = null;
		}

		return this.commands;
	}

	doFind(tree, value, depth) {
		if (tree != null) {
			this.cmd(
				act.setText,
				0,
				'Recalling cue ' + value + ' (looking for “' + this.cueLabelForKey(value) + '”)',
			);
			this._lastVisitedDepth = depth;
			this.cmd(act.setHighlight, tree.graphicID, 1, this._visitHighlightColor);
			if (tree.data === value) {
				this.cmd(
					act.setText,
					0,
					'Key ' +
						value +
						' matches “' +
						this.memoryString(tree) +
						'” — reinforcing through splay.',
				);
				this.cmd(act.step);
				this.cmd(act.setText, 0, 'Splaying recalled memory to root');
				this.cmd(act.step);
				this.cmd(act.setHighlight, tree.graphicID, 0, this._visitHighlightColor);
				this.splayUp(tree);
				return true;
			} else {
				if (tree.data > value) {
					this.cmd(
						act.setText,
						0,
							'Key ' +
							value +
							' < ' +
							tree.data +
							' (“' +
							this.memoryString(tree) +
							'”) — search left branch',
					);
					this.cmd(act.step);
					this.cmd(act.setHighlight, tree.graphicID, 0, this._visitHighlightColor);
					if (tree.left != null) {
						this.cmd(
							act.createHighlightCircle,
							this.highlightID,
							this._pathRingColor,
							tree.x,
							tree.y,
						);
						this.cmd(act.move, this.highlightID, tree.left.x, tree.left.y);
						this.cmd(act.step);
						this.cmd(act.delete, this.highlightID);
						return this.doFind(tree.left, value, depth + 1);
					} else {
						this.cmd(
							act.setText,
							0,
							'No left branch — unsuccessful recall; splaying last reached memory.',
						);
						this.cmd(act.step);
						this.splayUp(tree);
						return false;
					}
				} else {
					this.cmd(
						act.setText,
						0,
							'Key ' +
							value +
							' > ' +
							tree.data +
							' (“' +
							this.memoryString(tree) +
							'”) — search right branch',
					);
					this.cmd(act.step);
					this.cmd(act.setHighlight, tree.graphicID, 0, this._visitHighlightColor);
					if (tree.right != null) {
						this.cmd(
							act.createHighlightCircle,
							this.highlightID,
							this._pathRingColor,
							tree.x,
							tree.y,
						);
						this.cmd(act.move, this.highlightID, tree.right.x, tree.right.y);
						this.cmd(act.step);
						this.cmd(act.delete, this.highlightID);
						return this.doFind(tree.right, value, depth + 1);
					} else {
						this.cmd(
							act.setText,
							0,
							'No right branch — unsuccessful recall; splaying last reached memory.',
						);
						this.cmd(act.step);
						this.splayUp(tree);
						return false;
					}
				}
			}
		} else {
			this.cmd(
				act.setText,
				0,
				'Recalling key ' + value + ' : empty network (nothing to recall)',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, 'Recall failed — no memories stored yet');
			return false;
		}
	}

	insertElement(insertedValue, memoryText = '') {
		this.commands = [];
		if (this.isDualForestMode()) {
			this.cmd(
				act.setText,
				0,
				'Encode is disabled while two demo trees are on screen — merge first.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			return this.commands;
		}
		if (this.treeRootRight != null && this.treeRoot == null) {
			this.cmd(
				act.setText,
				0,
				'Encode is disabled until you load “Club activities” on the left.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			return this.commands;
		}
		this._lastInsertDuplicate = false;
		const trimmed = (memoryText != null && String(memoryText).trim()) || '';
		const resolvedMemory =
			trimmed || defaultMemoryForDemoKey(insertedValue) || `Cue ${insertedValue}`;
		const circleLabel = String(insertedValue);

		this.cmd(
			act.setText,
			0,
			'Encoding key ' + insertedValue + ' — “' + resolvedMemory + '”',
		);
		this.highlightID = this.nextIndex++;

		if (this.treeRoot == null) {
			this.cmd(act.createCircle, this.nextIndex, circleLabel, this.startingX, STARTING_Y);
			this.cmd(act.setForegroundColor, this.nextIndex, FOREGROUND_COLOR);
			this.cmd(act.setBackgroundColor, this.nextIndex, NODE_FILL_DEFAULT);
			this.cmd(act.step);
			this.treeRoot = new BSTNode(
				insertedValue,
				this.nextIndex,
				this.startingX,
				STARTING_Y,
				resolvedMemory,
			);
			this.nextIndex += 1;
			this.applyMemoryDepthStyleCommands();
			if (!this._bulkMemoryLoad) {
				this.pendingMemoryUi = {
					narration: getNarration('insert', {
						key: insertedValue,
						success: true,
						memory: resolvedMemory,
					}),
					recallDifficultyBefore: null,
					recallDifficultyAfter: 0,
					lastOperation: 'insert',
				};
				this.pendingRecentGraphicId = this.treeRoot.graphicID;
				this.pendingRecentHighlightColor = REMEMBRALL_INSERT_HALO;
			}
		} else {
			this._visitHighlightColor = REMEMBRALL_INSERT_HALO;
			this._pathRingColor = REMEMBRALL_PATH_INSERT;
			this.cmd(act.createCircle, this.nextIndex, circleLabel, 100, 100);
			this.cmd(act.setForegroundColor, this.nextIndex, FOREGROUND_COLOR);
			this.cmd(act.setBackgroundColor, this.nextIndex, NODE_FILL_DEFAULT);
			this.cmd(act.step);
			const insertElem = new BSTNode(
				insertedValue,
				this.nextIndex,
				100,
				100,
				resolvedMemory,
			);

			this.nextIndex += 1;
			this.cmd(act.setHighlight, insertElem.graphicID, 1, this._visitHighlightColor);
			this.insert(insertElem, this.treeRoot);
			if (this._lastInsertDuplicate) {
				this.cmd(act.setText, 0, 'Duplicate key — memory already in the network');
				this.cmd(act.step);
				this.cmd(act.setText, 0, '');
				if (!this._bulkMemoryLoad) {
					this.pendingMemoryUi = {
						narration: getNarration('insert', {
							key: insertedValue,
							success: false,
							memory: resolvedMemory,
						}),
						recallDifficultyBefore: null,
						recallDifficultyAfter: null,
						lastOperation: 'insert',
					};
					this.pendingRecentGraphicId = null;
					this.pendingRecentHighlightColor = null;
				}
				return this.commands;
			}
			this.resizeTree();
			const depthBeforeRecall = this.depthOfNode(insertElem);
			this.cmd(act.setText, 0, 'Splaying newly encoded memory to root');
			this.cmd(act.step);
			this.splayUp(insertElem);
			if (!this._bulkMemoryLoad) {
				this.pendingMemoryUi = {
					narration: getNarration('insert', {
						key: insertedValue,
						success: true,
						memory: resolvedMemory,
					}),
					recallDifficultyBefore: depthBeforeRecall,
					recallDifficultyAfter: 0,
					lastOperation: 'insert',
				};
				this.pendingRecentGraphicId = insertElem.graphicID;
				this.pendingRecentHighlightColor = REMEMBRALL_INSERT_HALO;
			}
		}
		this.cmd(act.setText, 0, '');
		return this.commands;
	}

	insert(elem, tree) {
		let foundDuplicate = false;
		this.cmd(act.setHighlight, tree.graphicID, 1, this._visitHighlightColor);
		this.cmd(act.setHighlight, elem.graphicID, 1, this._visitHighlightColor);

		if (elem.data < tree.data) {
			this.cmd(act.setText, 0, elem.data + ' < ' + tree.data + '.  Looking at left subtree');
		} else if (elem.data > tree.data) {
			this.cmd(
				act.setText,
				0,
				elem.data + ' >= ' + tree.data + '.  Looking at right subtree',
			);
		} else {
			this.cmd(
				act.setText,
				0,
				'Key ' + elem.data + ' already stored — “' + this.memoryString(tree) + '”',
			);
			foundDuplicate = true;
		}
		this.cmd(act.step);
		this.cmd(act.setHighlight, tree.graphicID, 0, this._visitHighlightColor);
		this.cmd(act.setHighlight, elem.graphicID, 0, this._visitHighlightColor);

		if (foundDuplicate) {
			this._lastInsertDuplicate = true;
			this.cmd(act.delete, elem.graphicID, 0);
			return;
		}

		if (elem.data < tree.data) {
			if (tree.left == null) {
				this.cmd(act.setText, 0, 'Found null tree, inserting element');

				this.cmd(act.setHighlight, elem.graphicID, 0, this._visitHighlightColor);
				tree.left = elem;
				elem.parent = tree;
				this.cmd(act.connect, tree.graphicID, elem.graphicID, LINK_COLOR);
			} else {
				this.cmd(
					act.createHighlightCircle,
					this.highlightID,
					this._pathRingColor,
					tree.x,
					tree.y,
				);
				this.cmd(act.move, this.highlightID, tree.left.x, tree.left.y);
				this.cmd(act.step);
				this.cmd(act.delete, this.highlightID);
				this.insert(elem, tree.left);
			}
		} else {
			if (tree.right == null) {
				this.cmd(act.setText, 0, 'Found null tree, inserting element');
				this.cmd(act.setHighlight, elem.graphicID, 0, this._visitHighlightColor);
				tree.right = elem;
				elem.parent = tree;
				this.cmd(act.connect, tree.graphicID, elem.graphicID, LINK_COLOR);
				elem.x = tree.x + WIDTH_DELTA / 2;
				elem.y = tree.y + HEIGHT_DELTA;
				this.cmd(act.move, elem.graphicID, elem.x, elem.y);
			} else {
				this.cmd(
					act.createHighlightCircle,
					this.highlightID,
					this._pathRingColor,
					tree.x,
					tree.y,
				);
				this.cmd(act.move, this.highlightID, tree.right.x, tree.right.y);
				this.cmd(act.step);
				this.cmd(act.delete, this.highlightID);
				this.insert(elem, tree.right);
			}
		}
	}

	deleteElement(deletedValue) {
		this.commands = [];
		if (this.isDualForestMode()) {
			this.cmd(
				act.setText,
				0,
				'Forget is disabled while two demo trees are on screen — merge first.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			return this.commands;
		}
		if (this.treeRootRight != null && this.treeRoot == null) {
			this.cmd(
				act.setText,
				0,
				'Forget is disabled until you load “Club activities” on the left.',
			);
			this.cmd(act.step);
			this.cmd(act.setText, 0, '');
			return this.commands;
		}
		const existed = this.depthIfPresent(deletedValue) >= 0;
		const victim = this.findNodeByKey(deletedValue);
		const victimMemory = victim
			? this.memoryString(victim)
			: defaultMemoryForDemoKey(deletedValue) || '';
		this.cmd(act.setText, 0, 'Forgetting memory key ' + deletedValue + ' …');
		this.cmd(act.step);
		this.cmd(act.setText, 0, '');
		this.highlightID = this.nextIndex++;
		this.treeDelete(this.treeRoot, deletedValue);
		this.cmd(act.setText, 0, '');
		this.pendingMemoryUi = {
			narration: getNarration('delete', {
				key: deletedValue,
				success: existed,
				memory: victimMemory,
			}),
			recallDifficultyBefore: null,
			recallDifficultyAfter: null,
			lastOperation: 'delete',
		};
		this.pendingRecentGraphicId = null;
		this.pendingRecentHighlightColor = null;
		return this.commands;
	}

	treeDelete(tree, valueToDelete) {
		const pre = this.findNodeByKey(valueToDelete);
		const preMem = pre ? this.memoryString(pre) : this.cueLabelForKey(valueToDelete);
		this.cmd(
			act.setText,
			0,
			'Locating key ' + valueToDelete + ' (“' + preMem + '”) to remove',
		);
		this.cmd(act.step);

		this._visitHighlightColor = REMEMBRALL_FORGET_HALO;
		this._pathRingColor = REMEMBRALL_PATH_FORGET;
		const inTree = this.doFind(this.treeRoot, valueToDelete, 0);
		this.cmd(act.setText, 0, 'Removing root, leaving left and right trees');
		this.cmd(act.step);
		if (inTree) {
			this.cmd(act.setBackgroundColor, this.treeRoot.graphicID, REMEMBRALL_FORGET_NODE_FILL);
			this.cmd(act.step);
			if (this.treeRoot.right == null) {
				this.cmd(act.delete, this.treeRoot.graphicID);
				this.cmd(act.setText, 0, 'No right tree, make left tree the root.');
				this.cmd(act.step);
				this.treeRoot = this.treeRoot.left;
				this.treeRoot.parent = null;
				this.resizeTree();
			} else if (this.treeRoot.left == null) {
				this.cmd(act.delete, this.treeRoot.graphicID);
				this.cmd(act.setText, 0, 'No left tree, make right tree the root.');
				this.cmd(act.step);
				this.treeRoot = this.treeRoot.right;
				this.treeRoot.parent = null;
				this.resizeTree();
			} else {
				const right = this.treeRoot.right;
				const left = this.treeRoot.left;
				const oldGraphicID = this.treeRoot.graphicID;
				this.cmd(act.disconnect, this.treeRoot.graphicID, left.graphicID);
				this.cmd(act.disconnect, this.treeRoot.graphicID, right.graphicID);
				this.cmd(act.setAlpha, this.treeRoot.graphicID, 0);
				this.cmd(act.setText, 0, 'Splay largest element in left tree to root');
				this.cmd(act.step);

				left.parent = null;
				const largestLeft = this.findMax(left);
				this.splayUp(largestLeft);
				this.cmd(
					act.setText,
					0,
					'Left tree now has no right subtree, connect left and right trees',
				);
				this.cmd(act.step);
				this.cmd(act.connect, largestLeft.graphicID, right.graphicID, LINK_COLOR);
				largestLeft.parent = null;
				largestLeft.right = right;
				right.parent = largestLeft;
				this.treeRoot = largestLeft;
				this.cmd(act.delete, oldGraphicID);
				this.resizeTree();
			}
		}
	}

	singleRotateRight(tree) {
		const B = tree;
		// const t3 = B.right;
		const A = tree.left;
		// const t1 = A.left;
		const t2 = A.right;

		this.cmd(act.setText, 0, 'Zig Right');
		this.cmd(act.setEdgeHighlight, B.graphicID, A.graphicID, 1);
		this.cmd(act.step);

		if (t2 != null) {
			this.cmd(act.disconnect, A.graphicID, t2.graphicID);
			this.cmd(act.connect, B.graphicID, t2.graphicID, LINK_COLOR);
			t2.parent = B;
		}
		this.cmd(act.disconnect, B.graphicID, A.graphicID);
		this.cmd(act.connect, A.graphicID, B.graphicID, LINK_COLOR);
		A.parent = B.parent;
		if (B.parent == null) {
			this.treeRoot = A;
		} else {
			this.cmd(act.disconnect, B.parent.graphicID, B.graphicID, LINK_COLOR);
			this.cmd(act.connect, B.parent.graphicID, A.graphicID, LINK_COLOR);
			if (B.isLeftChild()) {
				B.parent.left = A;
			} else {
				B.parent.right = A;
			}
		}
		A.right = B;
		B.parent = A;
		B.left = t2;
		this.resizeTree();
	}

	zigZigRight(tree) {
		const C = tree;
		const B = tree.left;
		const A = tree.left.left;
		// const t1 = A.left;
		const t2 = A.right;
		const t3 = B.right;
		// const t4 = C.right;

		this.cmd(act.setText, 0, 'Zig-Zig Right');
		this.cmd(act.setEdgeHighlight, C.graphicID, B.graphicID, 1);
		this.cmd(act.setEdgeHighlight, B.graphicID, A.graphicID, 1);
		this.cmd(act.step);
		this.cmd(act.setEdgeHighlight, C.graphicID, B.graphicID, 0);
		this.cmd(act.setEdgeHighlight, B.graphicID, A.graphicID, 0);

		if (C.parent != null) {
			this.cmd(act.disconnect, C.parent.graphicID, C.graphicID);
			this.cmd(act.connect, C.parent.graphicID, A.graphicID, LINK_COLOR);
			if (C.isLeftChild()) {
				C.parent.left = A;
			} else {
				C.parent.right = A;
			}
		} else {
			this.treeRoot = A;
		}

		if (t2 != null) {
			this.cmd(act.disconnect, A.graphicID, t2.graphicID);
			this.cmd(act.connect, B.graphicID, t2.graphicID, LINK_COLOR);
			t2.parent = B;
		}
		if (t3 != null) {
			this.cmd(act.disconnect, B.graphicID, t3.graphicID);
			this.cmd(act.connect, C.graphicID, t3.graphicID, LINK_COLOR);
			t3.parent = C;
		}
		this.cmd(act.disconnect, B.graphicID, A.graphicID);
		this.cmd(act.connect, A.graphicID, B.graphicID, LINK_COLOR);
		this.cmd(act.disconnect, C.graphicID, B.graphicID);
		this.cmd(act.connect, B.graphicID, C.graphicID, LINK_COLOR);

		A.right = B;
		A.parent = C.parent;
		B.parent = A;
		B.left = t2;
		B.right = C;
		C.parent = B;
		C.left = t3;
		this.resizeTree();
	}

	zigZigLeft(tree) {
		const A = tree;
		const B = tree.right;
		const C = tree.right.right;
		// const t1 = A.left;
		const t2 = B.left;
		const t3 = C.left;
		// const t4 = C.right;

		this.cmd(act.setText, 0, 'Zig-Zig Left');
		this.cmd(act.setEdgeHighlight, A.graphicID, B.graphicID, 1);
		this.cmd(act.setEdgeHighlight, B.graphicID, C.graphicID, 1);
		this.cmd(act.step);
		this.cmd(act.setEdgeHighlight, A.graphicID, B.graphicID, 0);
		this.cmd(act.setEdgeHighlight, B.graphicID, C.graphicID, 0);

		if (A.parent != null) {
			this.cmd(act.disconnect, A.parent.graphicID, A.graphicID);
			this.cmd(act.connect, A.parent.graphicID, C.graphicID, LINK_COLOR);
			if (A.isLeftChild()) {
				A.parent.left = C;
			} else {
				A.parent.right = C;
			}
		} else {
			this.treeRoot = C;
		}

		if (t2 != null) {
			this.cmd(act.disconnect, B.graphicID, t2.graphicID);
			this.cmd(act.connect, A.graphicID, t2.graphicID, LINK_COLOR);
			t2.parent = A;
		}
		if (t3 != null) {
			this.cmd(act.disconnect, C.graphicID, t3.graphicID);
			this.cmd(act.connect, B.graphicID, t3.graphicID, LINK_COLOR);
			t3.parent = B;
		}
		this.cmd(act.disconnect, A.graphicID, B.graphicID);
		this.cmd(act.disconnect, B.graphicID, C.graphicID);
		this.cmd(act.connect, C.graphicID, B.graphicID, LINK_COLOR);
		this.cmd(act.connect, B.graphicID, A.graphicID, LINK_COLOR);
		C.parent = A.parent;
		A.right = t2;
		B.left = A;
		A.parent = B;
		B.right = t3;
		C.left = B;
		B.parent = C;

		this.resizeTree();
	}

	singleRotateLeft(tree) {
		const A = tree;
		const B = tree.right;
		// const t1 = A.left;
		const t2 = B.left;
		// const t3 = B.right;

		this.cmd(act.setText, 0, 'Zig Left');
		this.cmd(act.setEdgeHighlight, A.graphicID, B.graphicID, 1);
		this.cmd(act.step);

		if (t2 != null) {
			this.cmd(act.disconnect, B.graphicID, t2.graphicID);
			this.cmd(act.connect, A.graphicID, t2.graphicID, LINK_COLOR);
			t2.parent = A;
		}
		this.cmd(act.disconnect, A.graphicID, B.graphicID);
		this.cmd(act.connect, B.graphicID, A.graphicID, LINK_COLOR);
		B.parent = A.parent;
		if (A.parent == null) {
			this.treeRoot = B;
		} else {
			this.cmd(act.disconnect, A.parent.graphicID, A.graphicID, LINK_COLOR);
			this.cmd(act.connect, A.parent.graphicID, B.graphicID, LINK_COLOR);

			if (A.isLeftChild()) {
				A.parent.left = B;
			} else {
				A.parent.right = B;
			}
		}
		B.left = A;
		A.parent = B;
		A.right = t2;

		this.resizeTree();
	}

	splayUp(tree) {
		if (tree.parent == null) {
			return;
		} else if (tree.parent.parent == null) {
			if (tree.isLeftChild()) {
				this.singleRotateRight(tree.parent);
			} else {
				this.singleRotateLeft(tree.parent);
			}
		} else if (tree.isLeftChild() && !tree.parent.isLeftChild()) {
			this.doubleRotateLeft(tree.parent.parent);
			this.splayUp(tree);
		} else if (!tree.isLeftChild() && tree.parent.isLeftChild()) {
			this.doubleRotateRight(tree.parent.parent);
			this.splayUp(tree);
		} else if (tree.isLeftChild()) {
			this.zigZigRight(tree.parent.parent);
			this.splayUp(tree);
		} else {
			this.zigZigLeft(tree.parent.parent);
			this.splayUp(tree);
		}
	}

	findMax(tree) {
		if (tree.right != null) {
			this.highlightID = this.nextIndex++;
			this.cmd(
				act.createHighlightCircle,
				this.highlightID,
				this._pathRingColor,
				tree.x,
				tree.y,
			);
			this.cmd(act.step);
			while (tree.right != null) {
				this.cmd(act.move, this.highlightID, tree.right.x, tree.right.y);
				this.cmd(act.step);
				tree = tree.right;
			}
			this.cmd(act.delete, this.highlightID);
			return tree;
		} else {
			return tree;
		}
	}

	doubleRotateRight(tree) {
		this.cmd(act.setText, 0, 'Zig-Zag Right');
		const A = tree.left;
		const B = tree.left.right;
		const C = tree;
		// const t1 = A.left;
		const t2 = B.left;
		const t3 = B.right;
		// const t4 = C.right;

		this.cmd(act.setEdgeHighlight, C.graphicID, A.graphicID, 1);
		this.cmd(act.setEdgeHighlight, A.graphicID, B.graphicID, 1);

		this.cmd(act.step);

		if (t2 != null) {
			this.cmd(act.disconnect, B.graphicID, t2.graphicID);
			t2.parent = A;
			A.right = t2;
			this.cmd(act.connect, A.graphicID, t2.graphicID, LINK_COLOR);
		}
		if (t3 != null) {
			this.cmd(act.disconnect, B.graphicID, t3.graphicID);
			t3.parent = C;
			C.left = t2;
			this.cmd(act.connect, C.graphicID, t3.graphicID, LINK_COLOR);
		}
		if (C.parent == null) {
			B.parent = null;
			this.treeRoot = B;
		} else {
			this.cmd(act.disconnect, C.parent.graphicID, C.graphicID);
			this.cmd(act.connect, C.parent.graphicID, B.graphicID, LINK_COLOR);
			if (C.isLeftChild()) {
				C.parent.left = B;
			} else {
				C.parent.right = B;
			}
			B.parent = C.parent;
			C.parent = B;
		}
		this.cmd(act.disconnect, C.graphicID, A.graphicID);
		this.cmd(act.disconnect, A.graphicID, B.graphicID);
		this.cmd(act.connect, B.graphicID, A.graphicID, LINK_COLOR);
		this.cmd(act.connect, B.graphicID, C.graphicID, LINK_COLOR);
		B.left = A;
		A.parent = B;
		B.right = C;
		C.parent = B;
		A.right = t2;
		C.left = t3;

		this.resizeTree();
	}

	doubleRotateLeft(tree) {
		this.cmd(act.setText, 0, 'Zig-Zag Left');
		const A = tree;
		const B = tree.right.left;
		const C = tree.right;
		// const t1 = A.left;
		const t2 = B.left;
		const t3 = B.right;
		// const t4 = C.right;

		this.cmd(act.setEdgeHighlight, A.graphicID, C.graphicID, 1);
		this.cmd(act.setEdgeHighlight, C.graphicID, B.graphicID, 1);

		this.cmd(act.step);

		if (t2 != null) {
			this.cmd(act.disconnect, B.graphicID, t2.graphicID);
			t2.parent = A;
			A.right = t2;
			this.cmd(act.connect, A.graphicID, t2.graphicID, LINK_COLOR);
		}
		if (t3 != null) {
			this.cmd(act.disconnect, B.graphicID, t3.graphicID);
			t3.parent = C;
			C.left = t2;
			this.cmd(act.connect, C.graphicID, t3.graphicID, LINK_COLOR);
		}

		if (A.parent == null) {
			B.parent = null;
			this.treeRoot = B;
		} else {
			this.cmd(act.disconnect, A.parent.graphicID, A.graphicID);
			this.cmd(act.connect, A.parent.graphicID, B.graphicID, LINK_COLOR);
			if (A.isLeftChild()) {
				A.parent.left = B;
			} else {
				A.parent.right = B;
			}
			B.parent = A.parent;
			A.parent = B;
		}
		this.cmd(act.disconnect, A.graphicID, C.graphicID);
		this.cmd(act.disconnect, C.graphicID, B.graphicID);
		this.cmd(act.connect, B.graphicID, A.graphicID, LINK_COLOR);
		this.cmd(act.connect, B.graphicID, C.graphicID, LINK_COLOR);
		B.left = A;
		A.parent = B;
		B.right = C;
		C.parent = B;
		A.right = t2;
		C.left = t3;

		this.resizeTree();
	}

	resizeTree() {
		this.syncForestLayout();
	}

	setNewPositions(tree, xPosition, yPosition, side) {
		if (tree != null) {
			tree.y = yPosition;
			if (side === -1) {
				xPosition = xPosition - tree.rightWidth;
			} else if (side === 1) {
				xPosition = xPosition + tree.leftWidth;
			}
			tree.x = xPosition;
			this.setNewPositions(tree.left, xPosition, yPosition + HEIGHT_DELTA, -1);
			this.setNewPositions(tree.right, xPosition, yPosition + HEIGHT_DELTA, 1);
		}
	}

	animateNewPositions(tree) {
		if (tree != null) {
			this.cmd(act.move, tree.graphicID, tree.x, tree.y);
			this.animateNewPositions(tree.left);
			this.animateNewPositions(tree.right);
		}
	}

	resizeWidths(tree) {
		if (tree == null) {
			return 0;
		}
		tree.leftWidth = Math.max(this.resizeWidths(tree.left), WIDTH_DELTA / 2);
		tree.rightWidth = Math.max(this.resizeWidths(tree.right), WIDTH_DELTA / 2);
		return tree.leftWidth + tree.rightWidth;
	}

	disableUI() {
		for (let i = 0; i < this.controls.length; i++) {
			this.controls[i].disabled = true;
		}
		this._clearRecentRecallHighlight();
	}

	enableUI() {
		for (let i = 0; i < this.controls.length; i++) {
			this.controls[i].disabled = false;
		}
		if (!this._bulkMemoryLoad) {
			this._flushPendingMemoryUi();
		}
		this._applyPendingRecentHighlight();
		this.updateManualOpLocks();
	}

	/**
	 * Hit test in canvas pixel space (same coordinates as node.x / node.y).
	 * @returns {{ key: number; memory: string; depth: number } | null}
	 */
	hitTestNode(canvasX, canvasY) {
		const om = this.animationManager?.animatedObjects;
		if (!om || (this.treeRoot == null && this.treeRootRight == null)) return null;
		let best = null;
		let bestDist = Infinity;
		const visit = node => {
			if (node == null) return;
			const dx = canvasX - node.x;
			const dy = canvasY - node.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const w = om.getWidth(node.graphicID);
			const r = w > 8 ? Math.max(14, w / 2) : 22;
			if (dist <= r + 6 && dist < bestDist) {
				bestDist = dist;
				best = node;
			}
			visit(node.left);
			visit(node.right);
		};
		visit(this.treeRoot);
		visit(this.treeRootRight);
		if (best == null) return null;
		return {
			key: best.data,
			memory: this.memoryString(best),
			depth: this.depthOfNode(best),
		};
	}
}

class BSTNode {
	constructor(val, id, initialX, initialY, memory = '') {
		this.data = val;
		this.memory = memory != null ? String(memory) : '';
		this.x = initialX;
		this.y = initialY;
		this.graphicID = id;
		this.left = null;
		this.right = null;
		this.parent = null;
	}

	isLeftChild() {
		if (this.parent == null) {
			return true;
		}
		return this.parent.left === this;
	}
}
