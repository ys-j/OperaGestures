(function () {
	'use strict';
	let extUrl = browser.extension.getURL('/');

	// overlay (for frames)
	let overlay;
	let overlayId = extUrl.replace(/[/:-]+/g, '-') + 'overlay';
	if (self === top) {
		overlay = document.createElement('div');
		overlay.id = overlayId;
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
	} else {
		self.addEventListener('mousedown', e => {
			if (e.button === 2) {
				let closest = e.target.closest('[href]');
				top.postMessage({
					href: closest ? closest.href : null,
					origin: extUrl,
					screenX: e.screenX,
					screenY: e.screenY,
				}, '*');
			}
		}, false);
		return; // break script
	}

	// glocal vars
	let g = {
		mm1: 32,
		mm2: 16,
		rad: 30 / 360 * Math.PI,
		wm: 4,
	};

	// load config
	browser.storage.local.get('config').then(v => {
		if (v.config) {
			g.mm1 = v.config.mm1 || g.mm1;
			g.mm2 = v.config.mm2 || g.mm2;
			g.rad = v.config.ar / 360 * Math.PI || g.rad;
			g.wm = v.config.wm || g.wm;
		}
	}).catch(e => {}).then(() => {
		g.tan = Math.tan(g.rad);
	});

	// main
	let startX = -1, startY = -1;
	let first = true;
	let href;
	
	let func = {
		'left': () => top.history.back(),
		'right': () => top.history.forward(),
		'up': () => top.stop(),
		'up,left': () => { top.location.href = top.location.href.replace(/[^/]*$/, '') },
		'up,down': () => top.location.reload(),
		'enter': e => {
			overlay.hidden = false;
			startX = e ? e.screenX : -1, startY = e ? e.screenY : -1;
			window.addEventListener('wheel', onwheel, { once: false });
			window.addEventListener('contextmenu', oncontextmenu, { once: true });
			window.addEventListener('mouseup', onmouseup, { once: true });
		},
		'leave': () => {
			overlay.hidden = true;
			window.removeEventListener('mousemove', checkstate);
			window.removeEventListener('wheel', onwheel);
			window.removeEventListener('contextmenu', oncontextmenu);
			window.removeEventListener('mouseup', onmouseup);
		}
	};
	browser.runtime.onMessage.addListener(m => {
		if (m.func in func)	{
			func[m.func]();
		}
	});
	
	function checkstate(e) {
		let diffX = e.screenX - startX, diffY = e.screenY - startY;
		let absX = Math.abs(diffX), absY = Math.abs(diffY);
		let min = first ? g.mm1 : g.mm2;

		if (min < absX || min < absY) {			
			let states;
			if (absX > absY) {
				if (g.tan > absY / absX) {
					states = [diffX < 0 ? 'left' : 'right'];
				} else {
					states = [null, diffX < 0 ? 'left' : 'right'];
				}
			} else if (absY > absX) {
				if (g.tan > absX / absY) {
					states = [diffY < 0 ? 'up' : 'down'];
				} else {
					states = [null, diffY < 0 ? 'up' : 'down']
				}
			}
			if (states) {
				first = false;
				startX = e.screenX, startY = e.screenY;
				browser.runtime.sendMessage({ states: states });
			}
		}
	}
	
	function resetDelta() {
		startX = -1, startY = -1;
	};
	function onwheel(e) {
		e.preventDefault();
		clearTimeout(resetDelta);
		if (startX < 0 || startY < 0) {
			startX = e.screenX, startY = e.screenY;
		}
		startX += e.deltaX, startY += e.deltaY;
		let diffY = startY - e.screenY;
		if (g.wm < Math.abs(diffY)) {
			startX = e.screenX, startY = e.screenY;
			browser.runtime.sendMessage({ type: 'wheel', direction: Math.sign(diffY) });
		}
		setTimeout(resetDelta, 100);
	}

	function oncontextmenu(e) {
		overlay.hidden = true;
		if (!first || (startX !== e.screenX || startY !== e.screenY)) {
			e.preventDefault();
		}
	}

	function onmouseup(e) {
		if (e.button === 2) {
			browser.runtime.sendMessage({ execute: true, url: href });
			window.addEventListener('contextmenu', oncontextmenu, { once: true });
			window.removeEventListener('mousemove', checkstate);
			window.removeEventListener('wheel', onwheel);
		}
		return false;
	}

	window.addEventListener('message', e => {
		if (e.data.origin === extUrl) {
			overlay.hidden = false;
			first = true;
			startX = e.data.screenX, startY = e.data.screenY;
			href = e.data.href;
			window.addEventListener('mousemove', checkstate, { once: false });
			window.addEventListener('wheel', onwheel, { once: false });
			window.addEventListener('mouseup', onmouseup, { once: true });
		}
	}, false);
	
	window.addEventListener('mousedown', e => {
		if (e.button === 2) {
			let closest = e.target.closest('[href]');
			window.postMessage({
				href: closest ? closest.href : null,
				origin: extUrl,
				screenX: e.screenX,
				screenY: e.screenY,
			}, location.origin);
		}
	}, false);
})();