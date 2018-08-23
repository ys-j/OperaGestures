(function () {
	'use strict';
	const EXT_URL = browser.extension.getURL('/');
	let first = true;
	let startX = -1, startY = -1;
	
	self.addEventListener('mousedown', e => {
		if (e.button === 2) {
			startX = e.screenX, startY = e.screenY;
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
	self.addEventListener('DOMContentLoaded', () => {
		document.body.appendChild(overlay);
	});

	// glocal vars
	let vars = {};

	// load config
	browser.storage.local.get('config').then(v => {
		const INITIAL = { config: { mm1: 32, mm2: 16, ar: 30, wm: 4 } };
		let config = v && (v[0] || v).config;
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

	// main
	let port = browser.runtime.connect();
	let href;
	let wheelTimer;
	function initStartCoord() {
		startX = -1, startY = -1;
	}
	
	let func = {
		'left': () => { history.back(); },
		'right': () => { history.forward(); },
		'up': () => { window.stop(); },
		'up,left': () => { location.href = location.href.replace(/[^/]*$/, ''); },
		'up,down': () => { location.reload(); },
		'enter': e => {
			overlay.hidden = false;
			startX = e ? e.screenX : -1;
			startY = e ? e.screenY : -1;
			self.addEventListener('wheel', onwheel, { once: false });
			self.addEventListener('mouseup', onmouseup, { once: true });
		},
		'leave': () => {
			overlay.hidden = true;
			self.removeEventListener('mousemove', checkstate);
			self.removeEventListener('wheel', onwheel);
			self.removeEventListener('mouseup', onmouseup);
		}
	};
	port.onMessage.addListener(m => {
		if (m.func in func)	{
			func[m.func]();
		}
	});
	
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
		return false;
	}
	self.addEventListener('message', e => {
		if (e.data.origin === EXT_URL) {
			overlay.hidden = false;
			first = true;
			startX = e.data.screenX, startY = e.data.screenY;
			href = e.data.href;
			self.addEventListener('mousemove', checkstate, { once: false });
			self.addEventListener('wheel', onwheel, { once: false });
			self.addEventListener('mouseup', onmouseup, { once: true });
		}
	}, false);
})();