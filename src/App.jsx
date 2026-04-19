import React, { useCallback, useEffect, useRef, useState } from 'react';
import AnimationManager from './anim/AnimationMain.jsx';
import SplayTree from './algo/SplayTree.js';
import { MEMORY_UI_EVENT } from './memoryTheme.js';

function interpretationForDepth(depth) {
	if (depth === 0) {
		return 'Most accessible memory (root).';
	}
	return 'Harder to retrieve until this cue is recalled or encoded again and splayed toward the root.';
}

export default function App() {
	const canvasRef = useRef(null);
	const viewportRef = useRef(null);
	const speedMountRef = useRef(null);
	const animManagerRef = useRef(null);
	const algoRef = useRef(null);
	const [nodeDetail, setNodeDetail] = useState(null);
	const [showMergedCollegeTitle, setShowMergedCollegeTitle] = useState(false);

	const setHighlightedLine = useCallback(() => {}, []);
	const unhighlightLine = useCallback(() => {}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		const viewport = viewportRef.current;
		if (!canvas || !viewport || !speedMountRef.current) return;

		animManagerRef.current = new AnimationManager(
			canvasRef,
			speedMountRef,
			setHighlightedLine,
			unhighlightLine,
		);

		const readViewportSize = () => {
			const w = Math.max(1, Math.floor(viewport.clientWidth));
			const h = Math.max(1, Math.floor(viewport.clientHeight));
			return { w, h };
		};

		const { w: initW, h: initH } = readViewportSize();

		algoRef.current = new SplayTree(animManagerRef.current, initW, initH);

		const updateDimensions = () => {
			if (!animManagerRef.current || !viewport) return;
			const { w, h } = readViewportSize();
			animManagerRef.current.changeSize(w, h);
		};

		const onCanvasClick = e => {
			const algo = algoRef.current;
			const c = canvasRef.current;
			if (!algo || !c) return;
			const rect = c.getBoundingClientRect();
			const rw = Math.max(1, rect.width);
			const rh = Math.max(1, rect.height);
			const scaleX = c.width / rw;
			const scaleY = c.height / rh;
			const x = (e.clientX - rect.left) * scaleX;
			const y = (e.clientY - rect.top) * scaleY;
			const hit = algo.hitTestNode(x, y);
			setNodeDetail(hit);
		};

		canvas.addEventListener('click', onCanvasClick);

		const resizeObserver = new ResizeObserver(() => {
			requestAnimationFrame(updateDimensions);
		});
		resizeObserver.observe(viewport);

		window.addEventListener('resize', updateDimensions);
		requestAnimationFrame(() => {
			requestAnimationFrame(updateDimensions);
		});

		return () => {
			canvas.removeEventListener('click', onCanvasClick);
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateDimensions);
			animManagerRef.current?.disposeSpeedControl();
			const algoControls = document.getElementById('AlgorithmSpecificControls');
			if (algoControls) algoControls.innerHTML = '';
			animManagerRef.current = null;
			algoRef.current = null;
		};
	}, [setHighlightedLine, unhighlightLine]);

	useEffect(() => {
		const onMemoryUi = e => {
			const d = e.detail || {};
			if (d.showMergedCollegeTitle) {
				setShowMergedCollegeTitle(true);
			} else if (
				d.lastOperation === 'clear' ||
				d.lastOperation === 'random' ||
				d.lastOperation === 'demo' ||
				d.lastOperation === 'split'
			) {
				setShowMergedCollegeTitle(false);
			}
		};
		window.addEventListener(MEMORY_UI_EVENT, onMemoryUi);
		return () => window.removeEventListener(MEMORY_UI_EVENT, onMemoryUi);
	}, []);

	return (
		<div className="splay-visualization-app" data-theme="light">
			<header className="splay-header">
				<h1>Remembrall: The Innerworkings using Splay Trees</h1>
			</header>
			<div id="mainContent">
				<div id="algoControlSection">
					<div className="algo-control-bar">
						<div className="algo-control-buttons">
							<table id="AlgorithmSpecificControls" />
						</div>
						<div
							className="algo-control-speed"
							ref={speedMountRef}
							aria-label="Animation speed"
						/>
					</div>
				</div>
				<div className="viewport" ref={viewportRef}>
					{showMergedCollegeTitle ? (
						<div className="merged-tree-title" aria-hidden="true">
							college memories
						</div>
					) : null}
					<div className="canvas-stack">
						<canvas id="canvas" ref={canvasRef} />
					</div>
					{nodeDetail ? (
						<div className="node-memory-popover" role="dialog" aria-label="Memory for selected node">
							<button
								type="button"
								className="node-memory-popover-close"
								onClick={() => setNodeDetail(null)}
								aria-label="Close"
							>
								×
							</button>
							<p className="node-memory-popover-title">Memory</p>
							<p>
								<strong>Key</strong> — {nodeDetail.key}
							</p>
							<p>
								<strong>Text</strong> — {nodeDetail.memory}
							</p>
							<p>
								<strong>Depth</strong> — {nodeDetail.depth}
							</p>
							<p className="node-memory-popover-interpret">{interpretationForDepth(nodeDetail.depth)}</p>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
