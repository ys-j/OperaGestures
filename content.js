(function () {
	'use strict';
	let g = {
		mm1: 32,
		mm2: 16,
		rad: 30 / 360 * Math.PI,
		wm: 4,
	};
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

	let startX = -1, startY = -1;
	let gestures = [];
	let href;
	
	let func = {
		'left': () => history.back(),
		'right': () => history.forward(),
		'up': () => window.stop(),
		'down': url => {
			let msg = { type: 'create', options: {} };
			if (typeof url === 'string' && url.startsWith('http')) {
				msg.options.url = url;
			}
			browser.runtime.sendMessage(msg);
		},
		'up-left': () => {
			location.href = location.href.replace(/[^/]*$/, '');
		},
		'up-down': () => location.reload(),
		'down-right': () => browser.runtime.sendMessage({ type: 'remove' }),
		'down-up': url => {
			let msg = { type: 'create', options: { active: false } };
			if (typeof url === 'string' && url.startsWith('http')) {
				msg.options.url = url;
			} else {
				msg.options.url = location.href;
			}
			browser.runtime.sendMessage(msg);
		},
		'down-left': () => browser.runtime.sendMessage({ type: 'window', options: { state: 'minimized' } }),
		'up-right': () => browser.runtime.sendMessage({ type: 'window', options: { state: 'maximized' } }),
	};

	function checkstate(e) {
		let diffX = e.screenX - startX, diffY = e.screenY - startY;
		let absX = Math.abs(diffX), absY = Math.abs(diffY);
		let min = gestures.length ? g.mm2 : g.mm1;

		if (min < absX || min < absY) {			
			let state;
			if (absX > absY && g.tan > absY / absX) {
				state = diffX < 0 ? 'left' : 'right';
			} else if (absY > absX && g.tan > absX / absY) {
				state = diffY < 0 ? 'up' : 'down';
			} else if (gestures.length) {
				switch (gestures[gestures.length - 1]) {
					case 'left':
					case 'right':
					if (absY > absX) state = diffY < 0 ? 'up' : 'down';
					break;
					case 'up':
					case 'down':
					if (absX > absY) state = diffX < 0 ? 'left' : 'right';
				}
			}
			if (state) {
				startX = e.screenX, startY = e.screenY;
				if (state !== gestures[gestures.length - 1]
					&& state !== gestures[gestures.length - 2]
				) {
					gestures.push(state);
				}
			}
		}
	}
	
	function onwheel(e) {
		e.preventDefault();
		if (startX < 0 || startY < 0) {
			startX = e.screenX, startY = e.screenY;
		}
		startX += e.deltaX, startY += e.deltaY;
		let diffY = startY - e.screenY;
		if (g.wm < Math.abs(diffY)) {
			startX = e.screenX, startY = e.screenY;
			gestures = ['wheel'];
			browser.runtime.sendMessage({ type: 'wheel', direction: Math.sign(diffY) });
		}
	}

	function oncontextmenu(e) {
		if (gestures.length) {
			e.preventDefault();
		}
	}

	function onmouseup(e) {
		let gesture = gestures.join('-');
		if (gesture in func) {
			func[gesture](href);
		}
		window.removeEventListener('mousemove', checkstate);
		window.removeEventListener('wheel', onwheel);
		return false;
	}

	function onmousedown(e) {
		gestures = [];
		startX = e.screenX, startY = e.screenY;
		href = e.target.href;
		if (e.button === 2) {
			window.addEventListener('mousemove', checkstate, { once: false });
			window.addEventListener('wheel', onwheel, { once: false });
			window.addEventListener('contextmenu', oncontextmenu, { once: true });
			window.addEventListener('mouseup', onmouseup, { once: true });
		}
	}
	
	window.addEventListener('mousedown', onmousedown, false);

	browser.runtime.onMessage.addListener(m => {
		switch (m.message) {
			case 'enter':
				startX = -1, startY = -1;
				window.addEventListener('wheel', onwheel, { once: false });
				window.addEventListener('contextmenu', oncontextmenu, { once: true });
				window.addEventListener('mouseup', onmouseup, { once: true });
				break;
			case 'leave':
				window.removeEventListener('mousemove', checkstate);
				window.removeEventListener('wheel', onwheel);
				window.removeEventListener('contextmenu', oncontextmenu);
				window.removeEventListener('mouseup', onmouseup);
				break;
		}
	});
})();