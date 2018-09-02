/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 (function () {
	'use strict';
	const EXT_MANIFEST = browser.runtime.getManifest();

	let vars = {};
	let s = document.forms.s;	// sensibility
	let fb = document.forms.fb;	// functions (basic)
	let fe = document.forms.fe;	// functions (extra)
	let b = document.forms.b;	// blacklist (list)
	let c = document.forms.c;	// blacklist (confirm)
	let fbc = Array.from(fb);
	let gesture = document.getElementById('gesture');
	let matchedPattern = document.getElementById('matchedPattern');
	let svg = document.getElementsByTagName('svg');
	let cc = svg[0].getElementById('_cc');
	let tl = svg[0].getElementById('_tl');
	let ml = svg[1].getElementById('_ml');

	// detect platform
	(async function classifyHtml() {
		let info = await browser.runtime.getPlatformInfo();
		document.documentElement.setAttribute('data-os', info.os);
	})();

	// substitute i18n, extension info
	(function subst_i18n() {
		let lang = browser.i18n.getUILanguage();
		document.documentElement.setAttribute('lang', lang === 'ja' ? 'ja' : 'en');
		Array.from(document.querySelectorAll('[data-i18n]')).forEach(elem => {
			let args = [];
			for (let i = 1; i < 9; i++) {
				let data = elem.dataset['i18n-$' + i];
				if (data) {
					args.push(data);
				} else {
					break;
				}
			}
			let msg = browser.i18n.getMessage(elem.dataset.i18n, args);
			if (msg && msg !== '??') {
				elem.textContent = msg;
			}
		});
		Array.from(document.querySelectorAll('[data-subst]')).forEach(elem => {
			let msg = EXT_MANIFEST[elem.dataset.subst];
			if (msg && typeof msg === 'string') {
				elem.textContent = msg;
			}
		})
	})();

	// menu / section
	function toggleNav() {
		document.body.classList.toggle('nav-opened');
	}
	let btn = document.getElementById('menu');
	let overlay = document.getElementById('overlay');
	btn.onclick = toggleNav;
	overlay.onclick = toggleNav;

	function openSection() {
		let hash = location.hash;
		if (hash) {
			document.body.className = hash.substr(1)  + '-opened';
		}
	}
	window.onhashchange = openSection;
	window.onload = openSection;

	// message pop
	let pops = document.getElementsByClassName('message');
	Array.from(pops).forEach(pop => {
		pop.addEventListener('transitionend', e => {
			if (e.target !== document.activeElement) {
				e.target.hidden = true;
			}
		}, { passive: true });
		// for Firefox 52
		let btns = pop.getElementsByTagName('button');
		Array.from(btns).forEach(btn => {
			btn.onmousedown = e => e.preventDefault();
		})
	});

	// update svg
	function updateSVG() {
		vars.mm1 = s.mm1.value;
		vars.mm2 = s.mm2.value;
		vars.rad = s.ar.value / 360 * Math.PI;
		vars.tan = Math.tan(vars.rad);
		vars.wm = s.wm.value;
		let ccv = (vars.mm1 / 20).toFixed(1);
		cc.setAttribute('r', ccv);
		let cx = (8 * Math.cos(vars.rad)).toFixed(1);
		let cy = (8 * Math.sin(vars.rad)).toFixed(1);
		tl.setAttribute('d', `M0,0L${cx},${cy}A8,8,0,0,0,${cx},-${cy}z`);
		let max = Math.max(vars.mm1, vars.mm2);
		ml.setAttribute('d', `M2,2v${(vars.mm1/max*12-2).toFixed(1)}a2,2,0,0,0,2,2h${(vars.mm2/max*12-2).toFixed(1)}`);
	}

	// update nested checkboxes
	function updateNestedCheckboxes() {
		let ul = fb.w.parentElement.nextElementSibling;
		let disabled = !fb.w.checked;
		ul.classList[disabled ? 'add' : 'remove']('disabled');
		fe.w1.disabled = disabled;
	}

	// load config, gesture, blacklist
	browser.storage.local.get(['config', 'gesture', 'blacklist']).then(STORAGE => {
		const INITIAL = {
			config: { mm1: 32, mm2: 16, ar: 30, wm: 4 },
			gesture: { basic: 2047, extra: 0 },
			blacklist: [],
		};

		let config = STORAGE.config || INITIAL.config;
		s.mm1.value = config.mm1;
		s.mm2.value = config.mm2;
		s.ar.value = config.ar;
		s.wm.value = config.wm;
		s.mm1.onchange = updateSVG;
		s.mm2.onchange = updateSVG;
		s.ar.onchange = updateSVG;
		updateSVG();

		let gesture = STORAGE.gesture || INITIAL.gesture;
		fbc.forEach((elem, i) => {
			elem.checked = gesture.basic & Math.pow(2, i);
		});
		fe.ru.checked = gesture.extra & 1;
		fe.w1.checked = gesture.extra & 2;
		fb.w.onchange = updateNestedCheckboxes;
		updateNestedCheckboxes();

		let blacklist = STORAGE.blacklist || INITIAL.blacklist;
		b.ul.value = blacklist.join('\n');
	});

	// reload extenison
	let reloadExtension;
	if ('discard' in browser.tabs) {
		reloadExtension = async () => {
			let tabs = await browser.tabs.query({ discarded: false });
			await browser.tabs.discard(tabs.map(tab => tab.id));
			browser.runtime.reload();
		};
	} else {
		// for Firefox 52
		let dialog = document.getElementsByClassName('dialog')[0];
		let msgboxes = dialog.getElementsByClassName('message');
		Array.from(msgboxes).forEach(msgbox => {
			let btns = msgbox.getElementsByTagName('button');
			btns[0].onclick = async () => {
				let windows = await browser.windows.getAll();
				windows.forEach(window => {
					browser.windows.remove(window.id);
				});
			};
			btns[1].onclick = () => {
				msgbox.addEventListener('transitionend', () => {
					document.body.classList.remove('dialog-opened')
					msgbox.hidden = true;
				}, { once: true, passive: true });
				msgbox.classList.remove('nofocus');
				msgbox.blur();
			};
		});
		reloadExtension = () => {
			let msgbox = msgboxes[0];
			document.body.classList.add('dialog-opened')
			msgbox.hidden = false;
			msgbox.onfocus = e => {
				e.target.classList.add('nofocus');
			};
			msgbox.focus();
		};
	}

	// save config
	let sensibilitySect = document.getElementById('sensibility');
	let popS = sensibilitySect.getElementsByClassName('success')[0];
	popS.lastElementChild.onclick = reloadExtension;
	s.onsubmit = () => {
		if (s.checkValidity()) {
			browser.storage.local.set({
				version: EXT_MANIFEST.version,
				config: {
					mm1: s.mm1.value | 0,
					mm2: s.mm2.value | 0,
					ar: s.ar.value | 0,
					wm: s.wm.value | 0,
				},
			}).then(() => {
				popS.hidden = false;
				popS.focus();
			});
		}
		return false;
	};

	// save gesture
	let functionsSect = document.getElementById('functions');
	let popF = functionsSect.getElementsByClassName('success')[0];
	popF.lastElementChild.onclick = reloadExtension;
	fb.onsubmit = () => {
		let basic = 0, extra = 0;
		fbc.forEach((elem, i) => {
			basic += elem.checked ? Math.pow(2, i) : 0;
		});
		extra += fe.ru.checked ? 1 : 0;
		extra += fe.w1.checked ? 2 : 0;
		browser.storage.local.set({
			version: EXT_MANIFEST.version,
			gesture: { basic: basic, extra: extra },
		}).then(() => {
			popF.hidden = false;
			popF.focus();
		});
		return false;
	};

	// save blacklist
	let blacklistSect = document.getElementById('blacklist');
	let popB = blacklistSect.getElementsByClassName('success')[0];
	popB.lastElementChild.onclick = reloadExtension;
	b.onsubmit = () => {
		let v = b.ul.value.replace(/\\\//g, '/').replace(/\\/g, '\\\\');
		browser.storage.local.set({
			version: EXT_MANIFEST.version,
			blacklist: v ? v.split('\n') : [],
		}).then(() => {
			popB.hidden = false;
			popB.focus();
		});
		return false;
	};

	// check blacklist
	c.onsubmit = () => {
		b.ul.value = b.ul.value.replace(/\\\//g, '/');
		let rawList = (b.dl.value + '\n' + b.ul.value).split('\n').filter(s => s.length);
		let reList = rawList.map(s => new RegExp(s));
		let matched = reList.filter(re => re.test(c.url.value)).map(re => re.source.replace(/\\\//g, '/'));
		if (matched.length) {
			matchedPattern.value = matched.join('\n');
		} else {
			matchedPattern.value = browser.i18n.getMessage('none');
		}
		matchedPattern.parentElement.hidden = false;
		matchedPattern.parentElement.focus();
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
			window.addEventListener('mouseup', e => {
				gesture.value = gestures.length ? gestures.map(v => browser.i18n.getMessage(v) || v).join('→') : browser.i18n.getMessage('rightclick');
				gesture.parentElement.hidden = false;
				gesture.parentElement.focus();
				window.removeEventListener('mousemove', checkstate);
				window.removeEventListener('wheel', onwheel);
			}, { once: true });
		}
	}
	window.addEventListener('mousedown', onmousedown, false);

	window.addEventListener('contextmenu', e => {
		if (document.activeElement === gesture.parentElement) {
			e.preventDefault();
		}
	}, false);
})();