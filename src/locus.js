/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 (function () {
    'use strict';
	const _scripts = document.getElementsByTagName('script');
	const [EXT_URL, PARAM_STR] = _scripts[_scripts.length - 1].src.split('locus.js?');
	const ID_PREFIX = EXT_URL.replace(/[/:-]+/g, '-');

	const RATIO = window.devicePixelRatio || 1;

	const overlay = /** @type {HTMLDivElement} */ (document.getElementById(ID_PREFIX + 'overlay'));
	const canvas = document.createElement('canvas');
	canvas.id = ID_PREFIX + 'canvas';
	canvas.style.height = '100%';
	canvas.style.width = '100%';

	overlay.appendChild(canvas);

	const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
	
	/** @type {Map<string, string|number>} */
	// @ts-ignore
	const styleMap = new Map([
		['globalAlpha', .25],
		['lineCap', 'round'],
		['lineJoin', 'round'],
		['lineWidth', 3],
		['strokeStyle', '#30e60b'],
	]);
	let themeColor = false;
	PARAM_STR.split('&').forEach(p => {
		const [k, v] = p.split('=');
		const keys = k.split('.');
		if (keys[0] === 'style') {
			if (typeof styleMap.get(keys[1]) === 'number') {
				styleMap.set(keys[1], parseFloat(v));
			} else {
				styleMap.set(keys[1], v);
			}
		} else if (keys[0] === 'opacity') {
			canvas.style.opacity = v;
		} else if (keys[0] === 'themecolor') {
			themeColor = v === "true";
		}
	});
	if (themeColor) {
		/** @type {?HTMLMetaElement} */
		const meta = document.head.querySelector('meta[name="theme-color"]');
		if (meta) styleMap.set('strokeStyle', meta.content);
	}

	window.addEventListener('resize', updateCanvasSize, { passive: true });
	function updateCanvasSize() {
		canvas.width = Math.round(window.innerWidth * RATIO);
		canvas.height = Math.round(window.innerHeight * RATIO);
		styleMap.forEach((v, k) => {
			// @ts-ignore
			ctx[k] = v;	// re-set style
		});
	}

	initCanvas();
	canvas.addEventListener('mousemove', drawLocus, { passive: true });
	canvas.addEventListener('mouseup', initCanvas, { passive: true })
	
	function initCanvas() {
		updateCanvasSize();
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		canvas.addEventListener('mouseenter', beginLocus, { once: true, passive: true });
		canvas.addEventListener('mouseleave', initCanvas, { once: true, passive: true });
	}
	function beginLocus(/** @type {MouseEvent} */ e) {
		ctx.beginPath();
		ctx.moveTo(e.clientX * RATIO, e.clientY * RATIO);
	}
	function drawLocus(/** @type {MouseEvent} */ e) {
		ctx.lineTo(e.clientX * RATIO, e.clientY * RATIO);
		ctx.stroke();
	}
})();