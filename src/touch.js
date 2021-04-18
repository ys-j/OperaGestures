/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
	'use strict';
	const _scripts = document.getElementsByTagName('script');
	const [EXT_URL, PARAM_STR] = _scripts[_scripts.length - 1].src.split('touch.js?');
	const ID_PREFIX = EXT_URL.replace(/[/:-]+/g, '-');

	// get <meta name=viewport>
	const viewport = {};
	/** @type {?HTMLMetaElement} */
	let meta = document.head.querySelector('meta[name="viewport"]');
	if (meta) {
		viewport.initial = meta.content || '';
		viewport.fixed = viewport.initial + ',user-scalable=no';
	} else {
		const observer = new MutationObserver(records => {
			loop:
			for (const record of records) {
				for (const node of Array.from(record.addedNodes)) {
					if (node instanceof HTMLMetaElement && node.name === 'viewport') {
						meta = node;
						observer.disconnect();
						break loop;
					}
				}
			}
		});
		observer.observe(document.head, { childList: true });
		window.addEventListener('load', () => {
			if (!meta) {
				observer.disconnect();
				meta = document.createElement('meta');
				meta.name = 'viewport';
				document.head.appendChild(meta);
			}
			viewport.initial = meta.content || '';
			viewport.fixed = viewport.initial + ',user-scalable=no';
		}, false);
	}

	let eventTarget = document.getElementById(ID_PREFIX + 'canvas') || top;

	// load config
	/** @type { { [key:string]: number } } */
	const vars = {
		mm1: 4,
		wm: 32,
		duration: 200,
		margin: 32,
	};
	PARAM_STR.split('&').forEach(p => {
		const [k, v] = p.split('=');
		vars[k] = parseInt(v);
	});

	// main
	let timer = 0;
	let counter = 0;
	/** @type {number[]} */ 
	let tapCoord = [];
	/** @type {Map<number, number[]>} */
	let tap2Coord = new Map();
	const inRange = (/** @type {number} */ x, /** @type {number} */ y) => {
		let tx = tapCoord[0], ty = tapCoord[1];
		return tx && ty && (tx - vars.margin <= x && x <= tx + vars.margin) && (ty - vars.margin <= y && y <= ty + vars.margin);
	};
	const isSingleTap = (/** @type {Touch} */ touch) => {
		let x = touch.pageX, y = touch.pageY;
		let rx = touch.radiusX, ry = touch.radiusY;
		let tx = tapCoord[0], ty = tapCoord[1];
		return tx && ty && (tx - rx <= x && x <= tx + rx) && (ty - ry <= y && y <= ty + ry);
	};
	top.addEventListener('touchstart', touchStart, { passive: true });
	top.addEventListener('touchend', touchEnd, { passive: false });
	top.addEventListener('touchcancel', touchCancel, { passive: true });

	function touchStart(/** @type {TouchEvent} */ e) {
		if (e.touches.length === 1) {
			const touch = e.touches[0];
			const x = touch.pageX, y = touch.pageY;
			if (++counter === 1) {
				tapCoord = [x, y];
			} else {
				if (counter === 2 && inRange(x, y)) {
					dispatchMouseDown2(touch);
					top.addEventListener('touchmove', dispatchMouseMove2, { once: false, passive: true });
					top.addEventListener('touchend', dispatchMouseUp2, { once: true, passive: true });
				}
				resetCount();
			}
		} else {
			touchCancel();
			if (e.touches.length === 2) {
				dispatchMouseDown2(e.touches[0]);
				tap2Coord = new Map(Array.from(e.touches).map(t => [t.identifier, [t.screenX, t.screenY]]));
				top.addEventListener('touchend', dispatchWheel, { once: true, passive: true });
			}
		}
	}

	function resetCount() {
		clearTimeout(timer);
		counter = 0;
		if (arguments.length && 'click' in arguments[0]) {
			arguments[0].click();
		}
	}
	function touchEnd(/** @type {TouchEvent} */ e) {
		if (!e.touches.length) {
			const aElem = document.activeElement;
			if (counter === 1
				&& !(aElem instanceof HTMLTextAreaElement)
				&& !(aElem instanceof HTMLInputElement && ['email', 'number', 'password', 'search', 'tel', 'text', 'url'].includes(aElem.type))
				&& !(aElem instanceof HTMLMediaElement && aElem.controls)
			) {
				e.preventDefault();
				const _selection = document.getSelection();
				if (_selection) _selection.removeAllRanges();
			}
			if (isSingleTap(e.changedTouches[0])) {
				/** @type {HTMLElement} */ (e.target).focus();
				timer = setTimeout(resetCount, vars.duration, e.target);
			} else {
				timer = setTimeout(resetCount, vars.duration);
			}
		}
	}
	function touchCancel() {
		resetCount();
		top.removeEventListener('touchmove', dispatchMouseMove2);
		top.removeEventListener('touchend', dispatchMouseUp2);
		if (eventTarget !== top) {
			eventTarget.dispatchEvent(new MouseEvent('mouseleave'));
		}
	}
	function dispatchMouseDown2(/** @type {Touch} */ touch) {
		// set viewport
		/** @type {HTMLMetaElement} */ (meta).content = viewport.fixed;
		/** @type {?HTMLAnchorElement|HTMLAreaElement} */
		const closest = /** @type {HTMLElement} */ (touch.target).closest('a[href],area[href]');
		top.postMessage({
			button: 2,
			href: closest ? closest.href : null,
			origin: EXT_URL,
			screenX: touch.screenX,
			screenY: touch.screenY,
		}, '*');
		if (eventTarget !== top) {
			eventTarget.dispatchEvent(new MouseEvent('mouseenter', {
				clientX: touch.clientX,
				clientY: touch.clientY,
				screenX: touch.screenX,
				screenY: touch.screenY,
			}));
		}
	}
	function dispatchMouseMove2(/** @type {TouchEvent} */ e) {
		const touch = e.changedTouches[0];
		eventTarget.dispatchEvent(new MouseEvent('mousemove', {
			bubbles: true,
			clientX: touch.clientX,
			clientY: touch.clientY,
			screenX: touch.screenX,
			screenY: touch.screenY,
		}));
	}
	function dispatchMouseUp2(/** @type {TouchEvent} */e) {
		touchCancel();
		// reset viewport
		/** @type {HTMLMetaElement} */(meta).content = viewport.initial;

		const touch = e.changedTouches[0];
		eventTarget.dispatchEvent(new MouseEvent('mouseup', {
			bubbles: true,
			button: 2,
			screenX: touch.screenX,
			screenY: touch.screenY,
		}));
	}
	function dispatchWheel(/** @type {TouchEvent} */ e) {
		/** @type {Touch[]} */
		let touches = [];
		if (e.touches.length === 1 && e.changedTouches.length === 1) {
			touches = [e.touches[0], e.changedTouches[0]];
		} else if (e.touches.length === 0 && e.changedTouches.length === 2) {
			touches = Array.from(e.changedTouches);
		}
		if (touches.length) {
			const startCoords = touches.map(t => /** @type {number[]} */ (tap2Coord.get(t.identifier)));
			const diffYs = touches.map((t, i) => startCoords[i][1] - t.screenY);
			const absDiffYs = diffYs.map(Math.abs);
			const maxAbs = Math.max(...absDiffYs);
			const minAbs = Math.min(...absDiffYs);
			const diff2 = diffYs[0] - diffYs[1];
			if (minAbs >= vars.wm && maxAbs - minAbs < vars.margin) {
				const direction = Math.sign(diff2);
				top.dispatchEvent(new WheelEvent('wheel', {
					deltaX: 0,
					deltaY: vars.mm1 * direction,
					screenX: touches[0].screenX,
					screenY: touches[0].screenY,
				}));
			}
		}
	}
})();