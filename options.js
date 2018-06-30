(function () {
	'use strict';
	let g = {};
	let f = document.forms.f;
	let svg = document.getElementsByTagName('svg');
	let cc = svg[0].getElementById('_cc');
	let tl = svg[0].getElementById('_tl');
	let ml = svg[1].getElementById('_ml');

	// load i18n
	let lang = browser.i18n.getUILanguage();
	document.documentElement.setAttribute('lang', lang === 'ja' ? 'ja' : 'en');
	Array.from(document.querySelectorAll('[data-i18n]')).map(elem => {
		let msg = browser.i18n.getMessage(elem.dataset.i18n);
		if (msg) elem.textContent = msg;
	});

	// load config
	function update() {
		g.mm1 = f.mm1.value;
		g.mm2 = f.mm2.value;
		g.rad = f.ar.value / 360 * Math.PI;
		g.tan = Math.tan(g.rad);
		let ccv = (g.mm1 / 20).toFixed(1);
		cc.setAttribute('r', ccv);
		let cx = (8 * Math.cos(g.rad)).toFixed(1);
		let cy = (8 * Math.sin(g.rad)).toFixed(1);
		tl.setAttribute('d', `M0,0L${cx},${cy}A8,8,0,0,0,${cx},-${cy}z`);
		let max = Math.max(g.mm1, g.mm2);
		ml.setAttribute('d', `M2,2v${(g.mm1/max*12-2).toFixed(1)}a2,2,0,0,0,2,2h${(g.mm2/max*12-2).toFixed(1)}`);
	}
	browser.storage.local.get('config').then(v => v.config).catch(e => {}).then(c => {
		f.mm1.value = c ? c.mm1 : 32;
		f.mm2.value = c ? c.mm2 : 16;
		f.ar.value = c ? c.ar : 30;
		f.mm1.onchange = update;
		f.mm2.onchange = update;
		f.ar.onchange = update;
		update();
	});

	// save config
	f.addEventListener('submit', e => {
		e.preventDefault();
		browser.storage.local.set({
			version: browser.runtime.getManifest().version,
			config: {
				mm1: f.mm1.value|0,
				mm2: f.mm2.value|0,
				ar: f.ar.value|0,
			},
		});
	}, false);

	// Preview
	let body = document.body;
	let startX = 0, startY = 0;
	let gestures = [];

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
			} else {
				state = 'outofrange';
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
		if (e.button === 2) {
			body.addEventListener('mousemove', checkstate, { once: false });
			body.addEventListener('contextmenu', e => {
				if (gestures.length) {
					e.preventDefault();
				}
			}, { once: true });

			body.addEventListener('mouseup', e => {
				f.lg.value = gestures.map(v => browser.i18n.getMessage(v) || v).join('→') || browser.i18n.getMessage('rightclick');
				body.removeEventListener('mousemove', checkstate);
				return false;
			}, { once: true });
		}
	}

	body.addEventListener('mousedown', mousedown, false);
})();