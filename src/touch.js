/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
	'use strict';
	const EXT_URL = browser.runtime.getURL('/');
	const ID_PREFIX = EXT_URL.replace(/[/:-]+/g, '-');

	// get <meta name=viewport>
	const viewport = {};
	let meta = document.head.querySelector('meta[name="viewport"]');
	if (meta) {
		viewport.initial = meta.content || '';
		viewport.fixed = viewport.initial + ',user-scalable=no';
	} else {
		const observer = new MutationObserver(records => {
			loop:
			for (let record of records) {
				for (let node of record.addedNodes) {
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
	let wheelMoving = 32;
	let minDelta = 4;
	let duration = 200;
	let margin = 32;
	browser.storage.local.get(['config', 'touch']).then(v => {
		if (v && v.config) {
			wheelMoving = v.congig.mm1 || 32;
			minDelta = v.config.wm || 4;
		}
		if (v && v.touch) {
			duration = v.touch.duration || 200;
			margin = v.touch.margin || 32;
		}
	});

	// main
	let timer;
	let counter = 0;
	let tapCoord = [], tap2Coord = new Map();
	const inRange = (x, y) => {
		let tx = tapCoord[0], ty = tapCoord[1];
		return tx && ty && (tx - margin <= x && x <= tx + margin) && (ty - margin <= y && y <= ty + margin);
	};
	const isSingleTap = touch => {
		let x = touch.pageX, y = touch.pageY;
		let rx = touch.radiusX, ry = touch.radiusY;
		let tx = tapCoord[0], ty = tapCoord[1];
		return tx && ty && (tx - rx <= x && x <= tx + rx) && (ty - ry <= y && y <= ty + ry);
	};
	top.addEventListener('touchstart', touchStart, { passive: true });
	top.addEventListener('touchend', touchEnd, { passive: false });
	top.addEventListener('touchcancel', touchCancel, { passive: true });

	function touchStart(e) {
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
	function touchEnd(e) {
		if (!e.touches.length) {
			const aElem = document.activeElement;
			if (counter === 1
				&& !(aElem instanceof HTMLTextAreaElement)
				&& !(aElem instanceof HTMLInputElement && ['email', 'number', 'password', 'search', 'tel', 'text', 'url'].includes(aElem.type))
				&& !(aElem instanceof HTMLMediaElement && aElem.controls)
			) {
				e.preventDefault();
				document.getSelection().removeAllRanges();
			}
			if (isSingleTap(e.changedTouches[0])) {
				e.target.focus();
				timer = setTimeout(resetCount, duration, e.target);
			} else {
				timer = setTimeout(resetCount, duration);
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
	function dispatchMouseDown2(touch) {
		// set viewport
		meta.content = viewport.fixed;

		const closest = touch.target.closest('a[href],area[href]');
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
	function dispatchMouseMove2(e) {
		const touch = e.changedTouches[0];
		eventTarget.dispatchEvent(new MouseEvent('mousemove', {
			bubbles: true,
			clientX: touch.clientX,
			clientY: touch.clientY,
			screenX: touch.screenX,
			screenY: touch.screenY,
		}));
	}
	function dispatchMouseUp2(e) {
		touchCancel();
		// reset viewport
		meta.content = viewport.initial;

		const touch = e.changedTouches[0];
		eventTarget.dispatchEvent(new MouseEvent('mouseup', {
			bubbles: true,
			button: 2,
			screenX: touch.screenX,
			screenY: touch.screenY,
		}));
	}
	function dispatchWheel(e) {
		let touches;
		if (e.touches.length === 1 && e.changedTouches.length === 1) {
			touches = [e.touches[0], e.changedTouches[0]];
		} else if (e.touches.length === 0 && e.changedTouches === 2) {
			touches = Array.from(e.changedTouches);
		}
		if (touches) {
			const startCoords = touches.map(t => tap2Coord.get(t.identifier));
			const diffYs = touches.map((t, i) => startCoords[i][1] - t.screenY);
			const absDiffYs = diffYs.map(Math.abs);
			const maxAbs = Math.max.apply(null, absDiffYs);
			const minAbs = Math.min.apply(null, absDiffYs);
			const diff2 = diffYs[0] - diffYs[1];
			if (minAbs >= wheelMoving && maxAbs - minAbs < margin) {
				const direction = Math.sign(diff2);
				top.dispatchEvent(new WheelEvent('wheel', {
					deltaX: 0,
					deltaY: minDelta * direction,
					screenX: touches[0].screenX,
					screenY: touches[0].screenY,
				}));
			}
		}
	}
})();