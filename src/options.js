(function () {
	'use strict';
	let vars = {};
	let f = document.forms.f;
	let g = document.forms.g;
	let gc = Array.from(g);
	let svg = document.getElementsByTagName('svg');
	let cc = svg[0].getElementById('_cc');
	let tl = svg[0].getElementById('_tl');
	let ml = svg[1].getElementById('_ml');

	// load i18n
	let lang = browser.i18n.getUILanguage();
	document.documentElement.setAttribute('lang', lang === 'ja' ? 'ja' : 'en');
	Array.from(document.querySelectorAll('[data-i18n]')).map(elem => {
		let msg = browser.i18n.getMessage(elem.dataset.i18n);
		if (msg && msg !== '??') {
			elem.textContent = msg;
		}
	});

	// update svg
	function update() {
		f.sb.disabled = false;
		vars.mm1 = f.mm1.value;
		vars.mm2 = f.mm2.value;
		vars.rad = f.ar.value / 360 * Math.PI;
		vars.tan = Math.tan(vars.rad);
		vars.wm = f.wm.value;
		let ccv = (vars.mm1 / 20).toFixed(1);
		cc.setAttribute('r', ccv);
		let cx = (8 * Math.cos(vars.rad)).toFixed(1);
		let cy = (8 * Math.sin(vars.rad)).toFixed(1);
		tl.setAttribute('d', `M0,0L${cx},${cy}A8,8,0,0,0,${cx},-${cy}z`);
		let max = Math.max(vars.mm1, vars.mm2);
		ml.setAttribute('d', `M2,2v${(vars.mm1/max*12-2).toFixed(1)}a2,2,0,0,0,2,2h${(vars.mm2/max*12-2).toFixed(1)}`);
	}

	// load config and gesture
	browser.storage.local.get(['config', 'gesture']).then(v => {
		const INITIAL = {
			config: { mm1: 32, mm2: 16, ar: 30, wm: 4 },
			gesture: { basic: 2047, extra: 0 },
		};
		const STORAGE = v && v[0] || v;

		let config = STORAGE.config || INITIAL.config;
		f.mm1.value = config.mm1;
		f.mm2.value = config.mm2;
		f.ar.value = config.ar;
		f.wm.value = config.wm;
		f.mm1.onchange = update;
		f.mm2.onchange = update;
		f.ar.onchange = update;
		update();

		let gesture = STORAGE.gesture || INITIAL.gesture;
		for (let i = 0; i < 11; i++) {
			gc[i].checked = gesture.basic & Math.pow(2, i);
		}
		for (let i = 11, l = gc.length; i < l; i++) {
			gc[i].checked = gesture.extra & Math.pow(2, i - 11);
		}
	});

	// save config
	f.onsubmit = () => {
		browser.storage.local.set({
			version: browser.runtime.getManifest().version,
			config: {
				mm1: f.mm1.value | 0,
				mm2: f.mm2.value | 0,
				ar: f.ar.value | 0,
				wm: f.wm.value | 0,
			},
		}).then(() => {
			browser.runtime.reload();
		});
		return false;
	};

	// save gesture
	g.onsubmit = () => {
		let basic = 0, extra = 0;
		let name = gc.map(g => g.name);
		for (let i = 0; i < 11; i++) {
			basic += gc[i].checked ? Math.pow(2, i) : 0;
		}
		for (let i = 11, l = gc.length; i < l; i++) {
			extra += gc[i].checked ? Math.pow(2, i - 11) : 0;
		}
		browser.storage.local.set({
			version: browser.runtime.getManifest().version,
			gesture: {
				basic: basic,
				extra: extra,
				index: {
					basic: name.slice(0, 11),
					extra: name.slice(11),
				},
			},
		}).then(() => {
			browser.runtime.reload();
		});
		return false;
	};

	// preview
	let startX = 0, startY = 0;
	let gestures = [];

	function checkstate(e) {
		let diffX = e.screenX - startX, diffY = e.screenY - startY;
		let absX = Math.abs(diffX), absY = Math.abs(diffY);
		let min = gestures.length ? vars.mm2 : vars.mm1;

		if (min < absX || min < absY) {			
			let state;
			if (absX > absY && vars.tan > absY / absX) {
				state = diffX < 0 ? 'left' : 'right';
			} else if (absY > absX && vars.tan > absX / absY) {
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
		if (vars.wm < Math.abs(startY - e.screenY)) {
			startX = e.screenX, startY = e.screenY;
			gestures = ['wheel'];
		}
	}

	function onmousedown(e) {
		gestures = [];
		startX = e.screenX, startY = e.screenY;
		if (e.button === 2) {
			window.addEventListener('mousemove', checkstate, { once: false });
			window.addEventListener('wheel', onwheel, { once: false });
			window.addEventListener('contextmenu', e => {
				if (gestures.length) {
					e.preventDefault();
				}
			}, { once: true });
			window.addEventListener('mouseup', e => {
				f.lg.value = gestures.map(v => browser.i18n.getMessage(v) || v).join('→') || browser.i18n.getMessage('rightclick');
				window.removeEventListener('mousemove', checkstate);
				window.removeEventListener('wheel', onwheel);
			}, { once: true });
		}
	}
	
	window.addEventListener('mousedown', onmousedown, false);
})();