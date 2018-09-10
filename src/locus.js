/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 (function () {
    'use strict';
	const EXT_URL = browser.runtime.getURL('/');
	const ID_PREFIX = EXT_URL.replace(/[/:-]+/g, '-');

	const RATIO = window.devicePixelRatio || 1;

	let overlay = document.getElementById(ID_PREFIX + 'overlay');
	let canvas = document.createElement('canvas');
	canvas.id = ID_PREFIX + 'canvas';
	canvas.style.height = '100%';
	canvas.style.width = '100%';

	overlay.appendChild(canvas);

	let ctx = canvas.getContext('2d');
	
	let styleMap = new Map([
		['globalAlpha', .25],
		['lineCap', 'round'],
		['lineJoin', 'round'],
		['lineWidth', 3],
		['strokeStyle', '#30e60b'],
	]);
	browser.storage.local.get(['locus']).then(v => {
		let userStyle = v && v.locus.style || {};
		if (v && v.locus.themecolor) {
			let meta = document.head.querySelector('meta[name="theme-color"]');
			if (meta) {
				userStyle.strokeStyle = meta.content;
			}
		}
		Object.entries(userStyle).forEach(a => {
			styleMap.set(a[0], a[1]);	// overwrite style
		});
		canvas.style.opacity = v && v.locus.opacity || .5;
		updateCanvasSize();
	});

	window.addEventListener('resize', updateCanvasSize, { passive: true });
	function updateCanvasSize() {
		canvas.width = Math.round(window.innerWidth * RATIO);
		canvas.height = Math.round(window.innerHeight * RATIO);
		styleMap.forEach((v, k) => {
			ctx[k] = v;	// re-set style
		});
	}

	initCanvas();
	canvas.addEventListener('mousemove', drawLocus, { passive: true });
	canvas.addEventListener('mouseup', initCanvas, { passive: true })
	
	function initCanvas() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		canvas.addEventListener('mouseenter', beginLocus, { once: true, passive: true });
		canvas.addEventListener('mouseleave', initCanvas, { once: true, passive: true });
	}
	function beginLocus(e) {
		ctx.beginPath();
		ctx.moveTo(e.clientX * RATIO, e.clientY * RATIO);
	}
	function drawLocus(e) {
		ctx.lineTo(e.clientX * RATIO, e.clientY * RATIO);
		ctx.stroke();
	}
})();