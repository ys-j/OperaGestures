/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXT_URL = browser.runtime.getURL('/');
let first = true;
let startX = -1, startY = -1;

/**
 * @param {Event} e 
 */
function preventDefault(e) {
	e.preventDefault();
}

self.addEventListener('mousedown', e => {
	if (e.button === 2) {
		/** @type {?HTMLAnchorElement|HTMLAreaElement} */
		// @ts-ignore
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
	throw null;
}

// glocal vars
/** @type { { [key:string]: number } } */
let vars = {};

// load config
browser.storage.local.get(['config']).then(/** @param v { { config:{} } } */ v => {
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
overlay.style.cssText = 'display:none;position:fixed;height:100%;width:100%;left:0;top:0;z-index:2147483647';

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
function onDOMContentLoaded() {
	if (document.body.nodeName.toLowerCase() === 'frameset') {
		const body = document.createElement('body');
		document.body = frameset2div(document.body, body);
		document.documentElement.style.height = '100%';
	}
	document.body.appendChild(overlay);

	// load locus.js / touch.js
	/**
	 * Create GET-method-style parameters from object.
	 * @param { { [key:string]: * } } obj target object
	 * @param {number} n current nested number
	 * @param {string[]} keyContainer key container
	 */
	const createParams = (obj, n = 0, keyContainer = []) => {
		/** @type {(string|string[])[]} */
		let params = [];
		let val;
		for ([keyContainer[n], val] of Object.entries(obj)) {
			if (typeof val === 'object') {
				params.push(createParams(val, n + 1, keyContainer));
			} else {
				params.push(keyContainer.slice(0, n + 1).join('.') + '=' + val.toString());
			}
		}
		return params.flat().join('&');
	}
	if (vars.locus) {
		const script = document.createElement('script');
		script.defer = true;
		script.src = EXT_URL + 'locus.js';
		browser.storage.local.get(['locus']).then(v => {
			if (v && v.locus) {
				script.src += '?' + createParams(v.locus);
			}
			overlay.appendChild(script);
		});
	}
	if (vars.touch) {
		const script = document.createElement('script');
		script.defer = true;
		script.src = EXT_URL + `touch.js?mm1=${vars.mm1 || 32}&wm=${vars.wm || 4}`;
		browser.storage.local.get(['touch']).then(v => {
			if (v && v.touch) {
				script.src += '?' + createParams(v.touch);
			}
			overlay.appendChild(script);
		});
	}
}

/**
 * Convert <frameset> element to <div> element
 * @param {HTMLElement} frameset - <frameset> element
 * @param {HTMLElement} wrapper - wrapper element
 */
function frameset2div(frameset, wrapper = document.createElement('div')) {
	wrapper.style.display = 'grid';
	wrapper.style.height = '100%';
	wrapper.style.width = '100%';
	wrapper.style.margin = '0';
	const framesetAttr2GridStyle = (/** @type {string} */ attr) => attr.split(',').map(v => v.replace(/\s*(\d*)(\D*)\s*/, (/** @type {string[]} */ ...p) => (p[1] || '1') + (p[2] ? p[2] === '*' ? 'fr' : p[2] : 'px'))).join(' ');
	const [_cols, _rows] = ['cols', 'rows'].map(a => frameset.getAttribute(a));
	if (_cols) wrapper.style.gridTemplateColumns = framesetAttr2GridStyle(_cols);
	if (_rows) wrapper.style.gridTemplateRows = framesetAttr2GridStyle(_rows);
	const frameBorder = frameset.getAttribute('frameborder')  || '0';
	wrapper.dataset.frameBorder = frameBorder;
	const style = document.createElement('style');
	style.textContent = `[data-frame-border] iframe{border:${isNaN(+frameBorder) ? 'inherit' : `${frameBorder}px`};height:inherit;width:inherit}`;
	wrapper.appendChild(style);
	
	/** @type { { [key:string]: HTMLElement } } */
	const NEW_ELEMENT_TEMPLATE = {
		frame: document.createElement('iframe'),
		frameset: document.createElement('div'),
	};
	Array.from(frameset.children).forEach((/** @type {HTMLElement} */ child) => {
		/** @type {Node} */
		let newnode;
		const nodeName = child.nodeName.toLowerCase();
		if (nodeName in NEW_ELEMENT_TEMPLATE) {
			const newelem = /** @type {HTMLElement} */ (NEW_ELEMENT_TEMPLATE[nodeName].cloneNode());
			Array.from(child.attributes).forEach(attr => {
				newelem.setAttribute(attr.name, attr.value);
			});
			newelem.dataset.frameBorder = frameBorder;
			newnode = nodeName === 'frameset' ? frameset2div(child, newelem) : newelem;
		} else {
			newnode = document.createComment(`<noframes>${child.innerHTML}</noframes>`);
		}
		wrapper.appendChild(newnode);
	});
	return wrapper;
}

// main
const port = browser.runtime.connect();
let href = '';
let wheelTimer = 0;
function initStartCoord() {
	startX = -1, startY = -1;
}

/**
 * Detect and send states
 * @param {MouseEvent} e 
 */
function checkState(e) {
	const diffX = e.screenX - startX, diffY = e.screenY - startY;
	const absX = Math.abs(diffX), absY = Math.abs(diffY);
	const min = first ? vars.mm1 : vars.mm2;

	if (min < absX || min < absY) {			
		/** @type {?(?string)[]} */
		let states = null;
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
/**
 * @param {WheelEvent} e 
 */
function onWheel(e) {
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
/**
 * @param {MouseEvent} e 
 */
function onMouseUp(e) {
	if (e.button === 2) {
		overlay.hidden = true;
		overlay.style.display = 'none';
		port.postMessage({ execute: true, url: href });
		self.removeEventListener('mousemove', checkState);
		self.removeEventListener('wheel', onWheel);
		self.removeEventListener('mouseup', onMouseUp);
	}
}

self.addEventListener('message', e => {
	if (e.data.origin === EXT_URL) {
		overlay.hidden = false;
		overlay.style.display = 'block';
		first = true;
		startX = e.data.screenX, startY = e.data.screenY;
		href = e.data.href;
		self.addEventListener('mousemove', checkState, { passive: true });
		self.addEventListener('wheel', onWheel, { passive: false });
		self.addEventListener('mouseup', onMouseUp, { passive: true });
	}
}, false);

const funcMap = new Map([
	['enter', () => {
		overlay.hidden = false;
		overlay.style.display = 'block';
		startX = -1, startY = -1;
		self.addEventListener('wheel', onWheel, { passive: false });
		self.addEventListener('mouseup', onMouseUp, { passive: true });
		self.addEventListener('contextmenu', preventDefault, { once: true });
	}],
	['leave', () => {
		overlay.hidden = true;
		overlay.style.display = 'none';
		self.removeEventListener('mousemove', checkState);
		self.removeEventListener('wheel', onWheel);
		self.removeEventListener('mouseup', onMouseUp);
		self.removeEventListener('contextmenu', preventDefault);
	}],
]);
port.onMessage.addListener(/** @param m { { func?:string, error?:string } } */ m => {
	if (m.func && funcMap.has(m.func)) {
		// @ts-ignore
		funcMap.get(m.func)();
	} else if (m.error) {
		throw m.error;
	}
});