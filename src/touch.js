/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {
	'use strict';
	const EXT_URL = browser.runtime.getURL('/');
	const ID_PREFIX = EXT_URL.replace(/[/:-]+/g, '-');

	// get <meta name=viewport>
	let viewport = {};
	let meta = document.head.querySelector('meta[name="viewport"]');
	if (meta) {
		viewport.initial = meta.content || '';
		viewport.fixed = viewport.initial + ',user-scalable=no';
	} else {
		let observer = new MutationObserver(records => {
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
	let duration = 300;
	let margin = 32;
	browser.storage.local.get(['touch']).then(v => {
		if (v && v.touch) {
			duration = v.touch.duration || 300;
			margin = v.touch.margin || 32;
		}
	});

	// main
	let timer;
	let counter = 0;
	let tapCoord = [];
	let inRange = (x, y) => {
		let tx = tapCoord[0], ty = tapCoord[1];
		return tx && ty && (tx - margin <= x && x <= tx + margin) && (ty - margin <= y && y <= ty + margin);
	};
	let isSingleTap = touch => {
		let x = touch.pageX, y = touch.pageY;
		let rx = touch.radiusX, ry = touch.radiusY;
		let tx = tapCoord[0], ty = tapCoord[1];
		return tx && ty && (tx - rx <= x && x <= tx + rx) && (ty - ry <= y && y <= ty + ry);
	};
	top.addEventListener('touchstart', touchStart, { passive: true });
	top.addEventListener('touchend', cueResetCount, { passive: false });
	top.addEventListener('touchcancel', touchCancel, { passive: true });

	function touchStart(e) {
		if (e.touches.length === 1) {
			let touch = e.touches[0];
			let x = touch.pageX, y = touch.pageY;
			if (++counter === 1) {
				tapCoord = [x, y];
			} else if (counter === 2) {
				if (inRange(x, y)) {
					counter = 0;
					clearTimeout(timer);
					dispatchMouseDown2(touch);
					top.addEventListener('touchmove', dispatchMouseMove2, { once: false, passive: true });
					top.addEventListener('touchend', dispatchMouseUp2, { once: true, passive: true });
				}
			}
		} else {
			touchCancel();
		}
	}
	function cueResetCount(e) {
		if (!e.touches.length) {
			let aElem = document.activeElement;
			if (counter === 1
				&& !(aElem instanceof HTMLInputElement)
				&& !(aElem instanceof HTMLSelectElement)
				&& !(aElem instanceof HTMLTextAreaElement)
				&& !(aElem instanceof HTMLMediaElement && aElem.controls)
			) {
				e.preventDefault();
				document.getSelection().removeAllRanges();
			}
			if (isSingleTap(e.changedTouches[0])) {
				e.target.focus();
				timer = setTimeout(target => {
					counter = 0;
					target.click();
				}, duration, e.target);
			} else {
				timer = setTimeout(() => {
					counter = 0;
				}, duration);
			}
		}
	}
	function touchCancel() {
		counter = 0;
		clearTimeout(timer);
		top.removeEventListener('touchmove', dispatchMouseMove2);
		top.removeEventListener('touchend', dispatchMouseUp2);
		if (eventTarget !== top) {
			eventTarget.dispatchEvent(new MouseEvent('mouseleave'));
		}
	}
	function dispatchMouseDown2(touch) {
		// set viewport
		meta.content = viewport.fixed;

		let closest = touch.target.closest('[href]');
		top.postMessage({
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
		let touch = e.changedTouches[0];
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

		let touch = e.changedTouches[0];
		eventTarget.dispatchEvent(new MouseEvent('mouseup', {
			bubbles: true,
			button: 2,
			screenX: touch.screenX,
			screenY: touch.screenY,
		}));
	}
})();