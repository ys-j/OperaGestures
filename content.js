(function () {
	'use strict';
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
			startX = e ? e.screenX : -1, startY = e ? e.screenY : -1;
			window.addEventListener('wheel', onwheel, { once: false });
			window.addEventListener('contextmenu', oncontextmenu, { once: true });
			window.addEventListener('mouseup', onmouseup, { once: true });
		},
		'leave': () => {
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

	function onmousedown(e) {
		first = true;
		startX = e.screenX, startY = e.screenY;
		href = e.target.href;
		if (e.button === 2) {
			window.addEventListener('mousemove', checkstate, { once: false });
			window.addEventListener('wheel', onwheel, { once: false });
			window.addEventListener('mouseup', onmouseup, { once: true });
		}
	}
	
	window.addEventListener('mousedown', onmousedown, false);

	// for iframes (alpha)
	let events = {
		mouseup: new MouseEvent('mouseup'),
	};
	let mousedown2 = e => {
		if (e.buttons === 2) func['enter'](e);
	};
	if (self === top) {
		let iframes = document.getElementsByTagName('iframe');
		for (let i = 0, l = iframes.length; i < l; i++) {
			iframes[i].addEventListener('mouseover', func['leave']);
			iframes[i].addEventListener('mouseout', mousedown2);
		}
		window.addEventListener('mouseup', e => {
			for (let i = 0, l = iframes.length; i < l; i++) {
				iframes[i].contentWindow.dispatchEvent(events.mouseup);
			}
		}, false);
	} else {
		window.addEventListener('mouseenter', mousedown2);
		window.addEventListener('mouseleave', func['leave']);
		window.addEventListener('mouseup', e => {
			top.dispatchEvent(events.mouseup);
		}, false);
	}
})();