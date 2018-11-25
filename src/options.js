/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 (function () {
	'use strict';
	const EXT_MANIFEST = browser.runtime.getManifest();
	const EXT_URL = browser.runtime.getURL('/');

	let vars = {};
	let s = document.forms.s;	// sensibility
	let fb = document.forms.fb;	// functions (basic)
	let fe = document.forms.fe;	// functions (extra)
	let b = document.forms.b;	// blacklist (list)
	let c = document.forms.c;	// blacklist (confirm)
	let g = document.forms.g;	// beta features
	let ml = document.forms.ml;	// for Mac/Linux
	let fbc = Array.from(fb);
	let gesture = document.getElementById('gesture');
	let matchedPattern = document.getElementById('matchedPattern');
	let svg = document.getElementsByTagName('svg');

	let _cc = svg[0].getElementById('_cc');
	let _tl = svg[0].getElementById('_tl');
	let _ml = svg[1].getElementById('_ml');

	let dialog = document.getElementById('dialog');
	let dialogMessages = Array.from(dialog.getElementsByClassName('message'));
	function openDialog() {
		document.body.classList.add('dialog-opened')
		this.hidden = false;
		this.onfocus = e => {
			e.target.classList.add('nofocus');
		};
		this.focus();
	}
	function closeDialog() {
		this.addEventListener('transitionend', () => {
			document.body.classList.remove('dialog-opened')
			this.hidden = true;
		}, { once: true, passive: true });
		this.focus();
		this.classList.remove('nofocus');
		this.blur();
	}

	// detect platform
	(async function classifyHtml() {
		let info = await browser.runtime.getPlatformInfo();
		document.documentElement.setAttribute('data-os', info.os);
	})();

	// substitute i18n, extension info
	(function subst_i18n() {
		let lang = browser.i18n.getUILanguage();
		document.documentElement.setAttribute('lang', lang === 'ja' ? 'ja' : 'en');
		document.querySelectorAll('[data-i18n]').forEach(elem => {
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
		document.querySelectorAll('[data-subst]').forEach(elem => {
			let msg = EXT_MANIFEST[elem.dataset.subst];
			if (msg && typeof msg === 'string') {
				elem.textContent = msg;
			}
		})
	})();

	// menu, section
	function toggleNav() {
		document.body.classList.toggle('nav-opened');
	}
	let btnMenu = document.getElementById('menu');
	let overlayMenu = document.getElementById('overlay');
	btnMenu.onclick = toggleNav;
	overlayMenu.onclick = toggleNav;

	function openSection() {
		let hash = location.hash || '#about';
		document.body.className = hash.substr(1)  + '-opened';
		location.hash = hash;
	}
	window.onhashchange = openSection;
	window.onload = openSection;

	// message pop
	Array.from(document.getElementsByClassName('message')).forEach(pop => {
		pop.addEventListener('transitionend', e => {
			if (e.target !== document.activeElement) {
				e.target.hidden = true;
			}
		}, { passive: true });
		// for Firefox 52
		Array.from(pop.getElementsByTagName('button')).forEach(btn => {
			btn.onmousedown = e => e.preventDefault();
		})
	});
	document.querySelectorAll('button[data-message-for]').forEach(btn => {
		let target = document.getElementById(btn.dataset.messageFor);
		btn.onclick = () => {
			target.focus();
			return false;
		};
	});

	// update svg
	function updateSVG() {
		vars.mm1 = s.mm1.value;
		vars.mm2 = s.mm2.value;
		vars.rad = s.ar.value / 360 * Math.PI;
		vars.tan = Math.tan(vars.rad);
		vars.wm = s.wm.value;
		let ccv = (vars.mm1 / 20).toFixed(1);
		_cc.setAttribute('r', ccv);
		let cx = (8 * Math.cos(vars.rad)).toFixed(1);
		let cy = (8 * Math.sin(vars.rad)).toFixed(1);
		_tl.setAttribute('d', `M0,0L${cx},${cy}A8,8,0,0,0,${cx},-${cy}z`);
		let max = Math.max(vars.mm1, vars.mm2);
		_ml.setAttribute('d', `M2,2v${(vars.mm1/max*12-2).toFixed(1)}a2,2,0,0,0,2,2h${(vars.mm2/max*12-2).toFixed(1)}`);
	}

	// update nested checkboxes
	function updateNestedCheckboxes(e) {
		let nests;
		if (e) {
			// label:has(e.target) + fieldset.nest-child
			nests = [e.target.parentElement.nextElementSibling];
		} else {
			nests = Array.from(document.getElementsByClassName('nest-child'));
		}
		nests.forEach(nest => {
			nest.disabled = !nest.previousElementSibling.firstElementChild.checked;
		});
	}

	// load storage
	browser.storage.local.get(['config', 'gesture', 'blacklist', 'locus', 'touch']).then(STORAGE => {
		const INITIAL = {
			config: { mm1: 32, mm2: 16, ar: 30, wm: 4 },
			locus: { style: { strokeStyle: '#30e60b', lineWidth: 3 }, opacity: 0.5, themecolor: false },
			touch: { duration: 200, margin: 32 },
			gesture: { basic: 2047 , extra: 0 },
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
		// for Android
		if (!('windows' in browser)) {
			fbc[9].checked = fbc[10].checked = false;
			fbc[9].disabled = fbc[10].disabled = true;
		}
		if (!('sessions' in browser)) {
			fe.ru.checked = false;
			fe.ru.disabled = true;
		} else {
			fe.ru.checked = gesture.extra & 1;
		}
		fe.w1.checked = gesture.extra & 2;
		fb.w.onchange = updateNestedCheckboxes;

		let blacklist = STORAGE.blacklist || INITIAL.blacklist;
		b.ul.value = blacklist.join('\n');
		
		let locus = STORAGE.locus || INITIAL.locus;
		g.locus.checked = config.locus || false;
		g.lt.value = locus.style.lineWidth;
		g.lc.value = locus.style.strokeStyle;
		g.lco.value = g.lc.value;
		g.lptc.checked = locus.themecolor;
		g.lo.value = locus.opacity * 100;
		g.locus.onchange = updateNestedCheckboxes;
		g.lc.onchange = () => {
			g.lco.value = g.lc.value;
		};

		let touch = STORAGE.touch || INITIAL.touch;
		g.touch.checked = config.touch || false;
		g.td.value = touch.duration * 0.001;
		g.tm.value = touch.margin;
		g.touch.onchange = updateNestedCheckboxes;
		
		updateNestedCheckboxes();
		return Promise.resolve(config);
	}).then((cfg) => {
		// for preview
		if (cfg.locus) {
			let script = document.createElement('script');
			script.src = 'locus.js';
			document.body.appendChild(script);
		}
		if (cfg.touch) {
			let script = document.createElement('script');
			script.src = 'touch.js';
			document.body.appendChild(script);
			window.addEventListener('message', e => {
				if (e.data.origin === EXT_URL) {
					onmousedown(e.data);
				}
			}, false);
		}
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
		// for Firefox 52, Android
		let msgbox = dialogMessages[0];
		let btns = msgbox.getElementsByTagName('button');
		btns[0].onclick = () => {
			browser.runtime.reload();
		};
		btns[1].onclick = closeDialog.bind(msgbox);
		reloadExtension = openDialog.bind(msgbox);
	}

	// save
	let popSaved = document.getElementById('pop-saved');
	popSaved.lastElementChild.onclick = reloadExtension;
	let saveConfig = () => browser.storage.local.set({
		version: EXT_MANIFEST.version,
		config: {
			locus: g.locus.checked,
			touch: g.touch.checked,
			mm1: s.mm1.value | 0,
			mm2: s.mm2.value | 0,
			ar: s.ar.value | 0,
			wm: s.wm.value | 0,
		},
	});

	// save config
	s.onsubmit = () => {
		if (s.checkValidity()) {
			saveConfig().then(() => {
				popSaved.hidden = false;
				popSaved.focus();
			});
		}
		return false;
	};

	// save gesture
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
			popSaved.hidden = false;
			popSaved.focus();
		});
		return false;
	};

	// save blacklist
	b.onsubmit = () => {
		let v = b.ul.value.replace(/\\\//g, '/');
		browser.storage.local.set({
			version: EXT_MANIFEST.version,
			blacklist: v ? v.split('\n').filter(s => s.length) : [],
		}).then(() => {
			popSaved.hidden = false;
			popSaved.focus();
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

	// save beta features
	g.onsubmit = () => {
		saveConfig().then(() => browser.storage.local.set({
			locus: {
				style: {
					lineWidth: g.lt.value | 0,
					strokeStyle: g.lc.value,
				},
				opacity: g.lo.value * 0.01,
				themecolor: g.lptc.checked,
			},
			touch: {
				duration: g.td.value * 1000,
				margin: g.tm.value | 0,
			},
		})).then(() => {
			popSaved.hidden = false;
			popSaved.focus();
		});
		return false;
	};

	// modify browser setting
	if (browser.browserSettings && 'contextMenuShowEvent' in browser.browserSettings) {
		browser.browserSettings.contextMenuShowEvent.get({}).then(setting => {
			ml.cm.checked = setting.value === 'mouseup';
		});
	}
	ml.cm.onchange = async e => {
		if (e.target.checked) {
			try {
				if (await browser.permissions.request({ permissions: ['browserSettings'] })) {
					browser.browserSettings.contextMenuShowEvent.set({ value: 'mouseup' }).catch(err => {
						throw err;
					});
				} else {
					throw 'Permission denied';
				}
			} catch (err) {
				console.warn(err);
				e.target.checked = false;
				let msgbox = dialogMessages[1];
				msgbox.getElementsByTagName('button')[0].onclick = closeDialog.bind(msgbox);
				openDialog.bind(msgbox)();
			}
		} else {
			try {
				e.target.checked = !(await browser.browserSettings.contextMenuShowEvent.clear({}));
			} catch (err) {
				console.warn(err);
				e.target.checked = true;
			}
		}
	};

	// preview
	let startX = 0, startY = 0;
	let gestures = [];
	let overlay = document.createElement('div');
	overlay.id = EXT_URL.replace(/[/:-]+/g, '-') + 'overlay';
	overlay.hidden = true;
	overlay.style.zIndex = 0x7fffffff;
	document.body.appendChild(overlay);

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
			overlay.hidden = false;
			window.addEventListener('mousemove', checkstate, { once: false });
			window.addEventListener('wheel', onwheel, { once: false });
			window.addEventListener('mouseup', e => {
				overlay.hidden = true;
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