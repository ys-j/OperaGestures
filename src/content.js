(function () {
	'use strict';
	// global object
	let global;
	if (self !== top) {
		global = top.wrappedJSObject.OperaGestures;
	} else {
		global = new window.Object()
		wrappedJSObject.OperaGestures = global;
		global.wrappedJSObject.url = browser.extension.getURL('/');
		global.wrappedJSObject.first = true;
		global.wrappedJSObject.startX = -1;
		global.wrappedJSObject.startY = -1;
	}

	window.addEventListener('contextmenu', e => {
		if (!global.first || (global.startX !== e.screenX || global.startY !== e.screenY)) {
			e.preventDefault();
		}
	}, false);

	// overlay (for frames)
	if (self !== top) {
		self.addEventListener('mousedown', e => {
			if (e.button === 2) {
				let closest = e.target.closest('[href]');
				top.postMessage({
					href: closest ? closest.href : null,
					origin: global.url,
					screenX: e.screenX,
					screenY: e.screenY,
				}, '*');
			}
		}, false);
		return; // break script
	}
	let overlay = document.createElement('div');
	overlay.id = global.url.replace(/[/:-]+/g, '-') + 'overlay';
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
	let vars = {
		mm1: 32,
		mm2: 16,
		rad: 30 / 360 * Math.PI,
		wm: 4,
	};

	// load config
	browser.storage.local.get('config').then(v => {
		if (v.config) {
			vars.mm1 = v.config.mm1 || vars.mm1;
			vars.mm2 = v.config.mm2 || vars.mm2;
			vars.rad = v.config.ar / 360 * Math.PI || vars.rad;
			vars.wm = v.config.wm || vars.wm;
		}
	}).catch(e => {}).then(() => {
		vars.tan = Math.tan(vars.rad);
	});

	// main
	let href;
	let wheelTimer;
	
	let func = {
		'left': () => history.back(),
		'right': () => history.forward(),
		'up': () => window.stop(),
		'up,left': () => { location.href = location.href.replace(/[^/]*$/, '') },
		'up,down': () => location.reload(),
		'enter': e => {
			overlay.hidden = false;
			global.wrappedJSObject.startX = e ? e.screenX : -1;
			global.wrappedJSObject.startY = e ? e.screenY : -1;
			window.addEventListener('wheel', onwheel, { once: false });
			//window.addEventListener('contextmenu', oncontextmenu, { once: true });
			window.addEventListener('mouseup', onmouseup, { once: true });
		},
		'leave': () => {
			overlay.hidden = true;
			window.removeEventListener('mousemove', checkstate);
			window.removeEventListener('wheel', onwheel);
			//window.removeEventListener('contextmenu', oncontextmenu);
			window.removeEventListener('mouseup', onmouseup);
		}
	};
	browser.runtime.onMessage.addListener(m => {
		if (m.func in func)	{
			func[m.func]();
		}
	});
	
	function checkstate(e) {
		let diffX = e.screenX - global.startX, diffY = e.screenY - global.startY;
		let absX = Math.abs(diffX), absY = Math.abs(diffY);
		let min = global.first ? vars.mm1 : vars.mm2;

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
				global.wrappedJSObject.first = false;
				global.wrappedJSObject.startX = e.screenX;
				global.wrappedJSObject.startY = e.screenY;
				browser.runtime.sendMessage({ states: states });
			}
		}
	}
	function onwheel(e) {
		e.preventDefault();
		clearTimeout(wheelTimer);
		if (global.startX < 0 || global.startY < 0) {
			global.wrappedJSObject.startX = e.screenX;
			global.wrappedJSObject.startY = e.screenY;
		}
		global.wrappedJSObject.startX += e.deltaX;
		global.wrappedJSObject.startY += e.deltaY;
		let diffY = global.startY - e.screenY;
		if (vars.wm < Math.abs(diffY)) {
			global.wrappedJSObject.startX = e.screenX;
			global.wrappedJSObject.startY = e.screenY;
			browser.runtime.sendMessage({ type: 'wheel', direction: Math.sign(diffY) });
		}
		wheelTimer = setTimeout(() => {
			global.wrappedJSObject.startX = -1;
			global.wrappedJSObject.startY = -1;
		}, 100);
	}

	function onmouseup(e) {
		if (e.button === 2) {
			overlay.hidden = true;
			browser.runtime.sendMessage({ execute: true, url: href });
			//window.addEventListener('contextmenu', oncontextmenu, { once: true });
			window.removeEventListener('mousemove', checkstate);
			window.removeEventListener('wheel', onwheel);
		}
		return false;
	}

	window.addEventListener('message', e => {
		if (e.data.origin === global.url) {
			overlay.hidden = false;
			global.wrappedJSObject.first = true;
			global.wrappedJSObject.startX = e.data.screenX;
			global.wrappedJSObject.startY = e.data.screenY;
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
				origin: global.url,
				screenX: e.screenX,
				screenY: e.screenY,
			}, location.origin);
		}
	}, false);
})();