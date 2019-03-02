/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 (function () {
	'use strict';
	const EXT_URL = browser.runtime.getURL('/');
	let first = true;
	let startX = -1, startY = -1;

	function preventDefault(e) {
		e.preventDefault();
	}
	
	self.addEventListener('mousedown', e => {
		if (e.button === 2) {
			const closest = e.target.closest('a[href],area[href]');
			top.postMessage({
				href: closest ? closest.href : null,
				origin: EXT_URL,
				screenX: e.screenX,
				screenY: e.screenY,
			}, '*');
		}
	}, false);
	self.addEventListener('contextmenu', e => {
		if (!first || (startX !== -1 && startX !== e.screenX) || (startY !== -1 && startY !== e.screenY)) {
			preventDefault(e);
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
		if (v.config) {
			vars = v.config;
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
	const overlay = document.createElement('div');
	overlay.id = EXT_URL.replace(/[/:-]+/g, '-') + 'overlay';
	overlay.hidden = true;
	overlay.style.display = 'none';
	overlay.style.position = 'fixed';
	overlay.style.height = '100%';
	overlay.style.width = '100%';
	overlay.style.left = 0;
	overlay.style.top = 0;
	overlay.style.zIndex = 0x7fffffff;
	document.addEventListener('DOMContentLoaded', () => {
		if (document.body.nodeName.toLowerCase() === 'frameset') {
			const body = document.createElement('body');
			document.body = frameset2div(document.body, body);
			document.documentElement.style.height = '100%';
		}
		document.body.appendChild(overlay);
	});
	function frameset2div(frameset, wrapper) {
		const styleGrid = attr => attr ? attr.split(',').map(v => v.replace(/(\d*)(\D*)/, (_, p1, p2) => (p1 || '1') + (p2 ? p2 === '*' ? 'fr' : p2 : 'px'))).join(' ') : '';
		if (!wrapper) {
			wrapper = document.createElement('div');
		}
		wrapper.style.display = 'grid';
		wrapper.style.height = '100%';
		wrapper.style.width = '100%';
		wrapper.style.margin = 0;
		const STYLE_NAMES = ['gridTemplateColumns', 'gridTemplateRows'];
		['cols', 'rows'].forEach((v, i) => {
			wrapper.style[STYLE_NAMES[i]] = styleGrid(frameset.getAttribute(v));
		});
		const frameborder = frameset.getAttribute('frameborder')  || '';
		if (frameborder) {
			wrapper.dataset.frameBorder = frameborder;
			const style = document.createElement('style');
			style.textContent = '[data-frame-border] iframe{border:' + (isNaN(frameborder) ? 'inherit}' : frameborder + 'px}');
			wrapper.appendChild(style);
		}
		
		const NEW_ELEMENT_TEMPLATE = {
			frame: document.createElement('iframe'),
			frameset: document.createElement('div'),
		};
		Array.from(frameset.children).forEach(child => {
			let newnode;
			const nodeName = child.nodeName.toLowerCase();
			if (nodeName in NEW_ELEMENT_TEMPLATE) {
				let newelem = NEW_ELEMENT_TEMPLATE[nodeName].cloneNode();
				Array.from(child.attributes).forEach(attr => {
					newelem.setAttribute(attr.name, attr.value);
				});
				if (frameborder) {
					newelem.dataset.frameBorder = frameborder;
				}
				newnode = nodeName === 'frameset' ? frameset2div(child, newelem) : newelem;
			} else {
				newnode = document.createComment('<noframes>' + child.innerHTML + '</noframes>');
			}
			wrapper.appendChild(newnode);
		});
		return wrapper;
	}

	// main
	const port = browser.runtime.connect();
	let href;
	let wheelTimer;
	function initStartCoord() {
		startX = -1, startY = -1;
	}
	
	function checkstate(e) {
		const diffX = e.screenX - startX, diffY = e.screenY - startY;
		const absX = Math.abs(diffX), absY = Math.abs(diffY);
		const min = first ? vars.mm1 : vars.mm2;

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
		const diffY = startY - e.screenY;
		if (vars.wm < Math.abs(diffY)) {
			startX = e.screenX, startY = e.screenY;
			port.postMessage({ type: 'wheel', direction: Math.sign(diffY) });
		}
		wheelTimer = setTimeout(initStartCoord, 100);
	}
	function onmouseup(e) {
		if (e.button === 2) {
			overlay.hidden = true;
			overlay.style.display = 'none';
			port.postMessage({ execute: true, url: href });
			self.removeEventListener('mousemove', checkstate);
			self.removeEventListener('wheel', onwheel);
			self.removeEventListener('mouseup', onmouseup);
		}
	}

	self.addEventListener('message', e => {
		if (e.data.origin === EXT_URL) {
			overlay.hidden = false;
			overlay.style.display = 'block';
			first = true;
			startX = e.data.screenX, startY = e.data.screenY;
			href = e.data.href;
			self.addEventListener('mousemove', checkstate, { passive: true });
			self.addEventListener('wheel', onwheel, { passive: false });
			self.addEventListener('mouseup', onmouseup, { passive: true });
		}
	}, false);
	
	const func = new Map([
		['left', () => { history.back(); }],
		['right', () => { history.forward(); }],
		['up', () => { window.stop(); }],
		['up,left', () => { location.href = location.href.replace(/[^/]*$/, ''); }],
		['up,down', () => { location.reload(); }],
		['enter', () => {
			overlay.hidden = false;
			overlay.style.display = 'block';
			startX = -1, startY = -1;
			self.addEventListener('wheel', onwheel, { passive: false });
			self.addEventListener('mouseup', onmouseup, { passive: true });
			self.addEventListener('contextmenu', preventDefault, { once: true });
		}],
		['leave', () => {
			overlay.hidden = true;
			overlay.style.display = 'none';
			self.removeEventListener('mousemove', checkstate);
			self.removeEventListener('wheel', onwheel);
			self.removeEventListener('mouseup', onmouseup);
			self.removeEventListener('contextmenu', preventDefault);
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