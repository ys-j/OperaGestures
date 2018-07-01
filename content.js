(function () {
	'use strict';
	let g = {
		mm1: 32,
		mm2: 16,
		rad: 30 / 360 * Math.PI,
	};
	browser.storage.local.get('config').then(v => {
		if (v.config) {
			g.mm1 = v.config.mm1;
			g.mm2 = v.config.mm2;
			g.rad = v.config.ar / 360 * Math.PI;
		}
	}).catch(e => {}).then(() => {
		g.tan = Math.tan(g.rad);
	});

	let startX = 0, startY = 0;
	let gestures = [];
	
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
	};

	function checkstate(e) {
		let diffX = e.pageX - startX, diffY = e.pageY - startY;
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
				startX = e.pageX, startY = e.pageY;
				if (state !== gestures[gestures.length - 1]
					&& state !== gestures[gestures.length - 2]
				) {
					gestures.push(state);
				}
			}
		}
	}

	function mousedown(e) {
		gestures = [];
		startX = e.pageX, startY = e.pageY;
		let href = e.target.href;
		
		if (e.button === 2) {
			window.addEventListener('mousemove', checkstate, { once: false });
			window.addEventListener('contextmenu', e => {
				if (gestures.length) {
					e.preventDefault();
				}
			}, { once: true });

			window.addEventListener('mouseup', e => {
				let gesture = gestures.join('-');
				if (gesture in func) {
					func[gesture](href);
				} else if (gestures.length) {
					console.log('No function is registered: ' + gesture);
				}
				window.removeEventListener('mousemove', checkstate);
				return false;
			}, { once: true });
		}
	}
	
	window.addEventListener('mousedown', mousedown, false);
})();