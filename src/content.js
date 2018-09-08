/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 (function () {
	'use strict';
	const EXT_URL = browser.runtime.getURL('/');
	let first = true;
	let startX = -1, startY = -1;
	
	self.addEventListener('mousedown', e => {
		if (e.button === 2) {
			let closest = e.target.closest('[href]');
			top.postMessage({
				href: closest ? closest.href : null,
				origin: EXT_URL,
				screenX: e.screenX,
				screenY: e.screenY,
			}, '*');
		}
	}, false);
	self.addEventListener('contextmenu', e => {
		if (!first || (startX !== e.screenX || startY !== e.screenY)) {
			e.preventDefault();
		}
	}, false);

	if (self !== top) {
		return false;
	}

	// glocal vars
	let vars = {};

	// load config
	browser.storage.local.get(['config']).then(v => {
		const INITIAL = { config: { mm1: 32, mm2: 16, ar: 30, wm: 4 } };
		let config = v.config;
		if (config) {
			vars = config;
		} else {
			vars = INITIAL.config;
			browser.storage.local.set({
				version: browser.runtime.getManifest().version,
				config: vars,
			});
		}
		vars.rad = vars.ar / 360 * Math.PI;
		vars.tan = Math.tan(vars.rad);
	});

	// overlay
	let overlay = document.createElement('div');
	overlay.id = EXT_URL.replace(/[/:-]+/g, '-') + 'overlay';
	overlay.hidden = true;
	overlay.style.position = 'fixed';
	overlay.style.height = '100%';
	overlay.style.width = '100%';
	overlay.style.left = 0;
	overlay.style.top = 0;
	overlay.style.zIndex = 0x7fffffff;
	document.addEventListener('DOMContentLoaded', () => {
		document.body.appendChild(overlay);
	});

	// main
	let port = browser.runtime.connect();
	let href;
	let wheelTimer;
	function initStartCoord() {
		startX = -1, startY = -1;
	}
	
	function checkstate(e) {
		let diffX = e.screenX - startX, diffY = e.screenY - startY;
		let absX = Math.abs(diffX), absY = Math.abs(diffY);
		let min = first ? vars.mm1 : vars.mm2;

		if (min < absX || min < absY) {			
			let states;
			if (absX > absY) {
				if (vars.tan > absY / absX) {
					states = [diffX < 0 ? 'left' : 'right'];
				} else {
					states = [null, diffX < 0 ? 'left' : 'right'];
				}
			} else if (absY > absX) {
				if (vars.tan > absX / absY) {
					states = [diffY < 0 ? 'up' : 'down'];
				} else {
					states = [null, diffY < 0 ? 'up' : 'down']
				}
			}
			if (states) {
				first = false;
				startX = e.screenX, startY = e.screenY;
				port.postMessage({ states: states });
			}
		}
	}
	function onwheel(e) {
		e.preventDefault();
		clearTimeout(wheelTimer);
		if (startX < 0 || startY < 0) {
			startX = e.screenX, startY = e.screenY;
		}
		startX += e.deltaX, startY += e.deltaY;
		let diffY = startY - e.screenY;
		if (vars.wm < Math.abs(diffY)) {
			startX = e.screenX, startY = e.screenY;
			port.postMessage({ type: 'wheel', direction: Math.sign(diffY) });
		}
		wheelTimer = setTimeout(initStartCoord, 100);
	}
	function onmouseup(e) {
		if (e.button === 2) {
			overlay.hidden = true;
			port.postMessage({ execute: true, url: href });
			self.removeEventListener('mousemove', checkstate);
			self.removeEventListener('wheel', onwheel);
		}
	}

	self.addEventListener('message', e => {
		if (e.data.origin === EXT_URL) {
			overlay.hidden = false;
			first = true;
			startX = e.data.screenX, startY = e.data.screenY;
			href = e.data.href;
			self.addEventListener('mousemove', checkstate, { once: false, passive: true });
			self.addEventListener('wheel', onwheel, { once: false, passive: false });
			self.addEventListener('mouseup', onmouseup, { once: true, passive: true });
		}
	}, false);
	
	let func = new Map([
		['left', () => { history.back(); }],
		['right', () => { history.forward(); }],
		['up', () => { window.stop(); }],
		['up,left', () => { location.href = location.href.replace(/[^/]*$/, ''); }],
		['up,down', () => { location.reload(); }],
		['enter', () => {
			overlay.hidden = false;
			startX = -1, startY = -1;
			self.addEventListener('wheel', onwheel, { once: false, passive: false });
			self.addEventListener('mouseup', onmouseup, { once: true, passive: true });
		}],
		['leave', () => {
			overlay.hidden = true;
			self.removeEventListener('mousemove', checkstate);
			self.removeEventListener('wheel', onwheel);
			self.removeEventListener('mouseup', onmouseup);
		}],
	]);
	port.onMessage.addListener(m => {
		if (m.func && func.has(m.func)) {
			func.get(m.func)();
		} else if (m.error) {
			throw m.error;
		}
	});
})();