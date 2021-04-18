/* Copyright 2018 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 (function () {
	'use strict';
	const EXT_MANIFEST = browser.runtime.getManifest();
	const EXT_URL = browser.runtime.getURL('/');

	/** @type { { [key:string]: number } } */
	const vars = {};
	// @ts-ignore
	const { s, fb, fe, b, c, g, ml } = /** @type { { [key:string]: HTMLFormElement } } */ (document.forms); // sensibility, functions (basic), functions (extra), blacklist (list), blacklist (confirm), beta features, for Mac/Linux
	const fbc = /** @type {HTMLInputElement[]} */ (Array.from(fb));
	const gesture = /** @type {HTMLOutputElement} */ (document.getElementById('gesture'));
	const matchedPattern = /** @type {HTMLOutputElement} */ (document.getElementById('matchedPattern'));
	const svg = document.getElementsByTagName('svg');

	const _cc = svg[0].getElementById('_cc');
	const _tl = svg[0].getElementById('_tl');
	const _ml = svg[1].getElementById('_ml');

	const dialog = /** @type {HTMLDivElement} */ (document.getElementById('dialog'));
	const dialogMessages = Array.from(dialog.getElementsByClassName('message'));
	
	/** @this {HTMLElement} */
	function openDialog() {
		document.body.classList.add('dialog-opened')
		this.hidden = false;
		this.onfocus = (/** @type {FocusEvent} */ e) => {
			/** @type {HTMLElement} */ (e.target).classList.add('nofocus');
		};
		this.focus();
	}
	
	/** @this {HTMLElement} */
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
		const info = await browser.runtime.getPlatformInfo();
		document.documentElement.setAttribute('data-os', info.os);
	})();

	// substitute i18n, extension info
	(function subst_i18n() {
		const lang = browser.i18n.getUILanguage();
		document.documentElement.setAttribute('lang', lang === 'ja' ? 'ja' : 'en');
		document.querySelectorAll('[data-i18n]').forEach((/** @type {HTMLElement} */ elem) => {
			const args = [];
			for (let i = 1; i < 9; i++) {
				const data = elem.dataset['i18n-$' + i];
				if (data) {
					args.push(data);
				} else {
					break;
				}
			}
			const msg = browser.i18n.getMessage(/** @type {string} */ (elem.dataset.i18n), args);
			if (msg && msg !== '??') {
				elem.textContent = msg;
			}
		});
		document.querySelectorAll('[data-subst]').forEach(elem => {
			// @ts-ignore
			const msg = EXT_MANIFEST[elem.dataset.subst];
			if (msg && typeof msg === 'string') {
				elem.textContent = msg;
			}
		})
	})();

	// menu, section
	function toggleNav() {
		document.body.classList.toggle('nav-opened');
	}
	const btnMenu = /** @type {HTMLAnchorElement} */ (document.getElementById('menu'));
	const overlayMenu = /** @type {HTMLDivElement} */ (document.getElementById('overlay'));
	btnMenu.onclick = toggleNav;
	overlayMenu.onclick = toggleNav;

	function openSection() {
		const hash = location.hash || '#about';
		document.body.className = hash.substr(1)  + '-opened';
		location.hash = hash;
	}
	window.onhashchange = openSection;
	window.onload = openSection;

	// message pop
	Array.from(document.getElementsByClassName('message')).forEach(pop => {
		pop.addEventListener('transitionend', e => {
			if (e.target !== document.activeElement) {
				/** @type {HTMLElement} */ (e.target).hidden = true;
			}
		}, { passive: true });
		// for Firefox 52
		Array.from(pop.getElementsByTagName('button')).forEach(btn => {
			btn.onmousedown = e => e.preventDefault();
		})
	});
	document.querySelectorAll('button[data-message-for]').forEach((/** @type {HTMLButtonElement} */ btn) => {
		const target = document.getElementById(/** @type {string} */ (btn.dataset.messageFor));
		btn.onclick = () => {
			/** @type {HTMLElement} */ (target).focus();
			return false;
		};
	});

	// update svg
	function updateSVG() {
		const { mm1, mm2, ar, wm } = /** @type { { [key:string]: HTMLInputElement } } */ (s);
		vars.mm1 = mm1.valueAsNumber;
		vars.mm2 = mm2.valueAsNumber;
		vars.rad = ar.valueAsNumber / 360 * Math.PI;
		vars.tan = Math.tan(vars.rad);
		vars.wm = wm.valueAsNumber;
		const ccv = (vars.mm1 / 20).toFixed(1);
		_cc.setAttribute('r', ccv);
		const cx = (8 * Math.cos(vars.rad)).toFixed(1);
		const cy = (8 * Math.sin(vars.rad)).toFixed(1);
		_tl.setAttribute('d', `M0,0L${cx},${cy}A8,8,0,0,0,${cx},-${cy}z`);
		const max = Math.max(vars.mm1, vars.mm2);
		_ml.setAttribute('d', `M2,2v${(vars.mm1/max*12-2).toFixed(1)}a2,2,0,0,0,2,2h${(vars.mm2/max*12-2).toFixed(1)}`);
	}

	// update nested checkboxes
	function updateNestedCheckboxes(/** @type {?Event} */ e) {
		/** @type {HTMLInputElement[]} */
		let nests;
		if (e) {
			// label:has(e.target) + fieldset.nest-child
			const _target = /** @type {HTMLElement} */ (e.target);
			const _parent = /** @type {HTMLElement} */ (_target.parentElement);
			nests = [/** @type {HTMLInputElement} */ (_parent.nextElementSibling)];
		} else {
			nests = /** @type {HTMLInputElement[]} */ (Array.from(document.getElementsByClassName('nest-child')));
		}
		nests.forEach(nest => {
			const _sibling = /** @type {HTMLElement} */ (nest.previousElementSibling);
			const _child = /** @type {HTMLInputElement} */ (_sibling.firstElementChild);
			nest.disabled = !_child.checked;
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

		/** @type { { mm1: number, mm2: number, ar: number, wm: number, locus: boolean, touch: boolean } } */
		const config = STORAGE.config || INITIAL.config;
		const { mm1, mm2, ar, wm } = /** @type { { [key:string]: HTMLInputElement } } */ (s);
		mm1.valueAsNumber = config.mm1;
		mm2.valueAsNumber = config.mm2;
		ar.valueAsNumber = config.ar;
		wm.valueAsNumber = config.wm;
		mm1.onchange = updateSVG;
		mm2.onchange = updateSVG;
		ar.onchange = updateSVG;
		updateSVG();

		const gesture = STORAGE.gesture || INITIAL.gesture;
		fbc.forEach((elem, i) => {
			// @ts-ignore
			elem.checked = gesture.basic & Math.pow(2, i);
		});
		// for Android
		if (!('windows' in browser)) {
			fbc[9].checked = fbc[10].checked = false;
			fbc[9].disabled = fbc[10].disabled = true;
		}
		const { ru, w1 } = /** @type { { [key:string]: HTMLInputElement } } */ (fe);
		if (!('sessions' in browser)) {
			ru.checked = false;
			ru.disabled = true;
		} else {
			// @ts-ignore
			ru.checked = gesture.extra & 1;
		}
		// @ts-ignore
		w1.checked = gesture.extra & 2;
		/** @type {HTMLInputElement} */ (fb.w).onchange = updateNestedCheckboxes;

		/** @type {string[]} */
		const blacklist = STORAGE.blacklist || INITIAL.blacklist;
		/** @type {HTMLTextAreaElement} */ (b.ul).value = blacklist.join('\n');
		
		const { locus, lt, lc, lco, lptc, lo, touch, td, tm } = /** @type { { [key:string]: HTMLInputElement } } */ (g);
		const _locus = STORAGE.locus || INITIAL.locus;
		locus.checked = config.locus || false;
		lt.valueAsNumber = _locus.style.lineWidth;
		lc.value = _locus.style.strokeStyle;
		lco.value = lc.value;
		lptc.checked = _locus.themecolor;
		lo.valueAsNumber = _locus.opacity * 100;
		locus.onchange = updateNestedCheckboxes;
		lc.onchange = () => {
			lco.value = lc.value;
		};

		const _touch = STORAGE.touch || INITIAL.touch;
		touch.checked = config.touch || false;
		td.valueAsNumber = _touch.duration * 0.001;
		tm.valueAsNumber = _touch.margin;
		touch.onchange = updateNestedCheckboxes;
		
		updateNestedCheckboxes();
	});

	// reload extenison
	/** @type {() => void} */
	let reloadExtension;
	if ('discard' in browser.tabs) {
		reloadExtension = async () => {
			const tabs = await browser.tabs.query({ discarded: false });
			await browser.tabs.discard(tabs.map(tab => tab.id));
			browser.runtime.reload();
		};
	} else {
		// for Firefox 52, Android
		const msgbox = dialogMessages[0];
		const btns = msgbox.getElementsByTagName('button');
		btns[0].onclick = () => {
			browser.runtime.reload();
		};
		btns[1].onclick = closeDialog.bind(msgbox);
		reloadExtension = openDialog.bind(msgbox);
	}

	// save
	const popSaved = /** @type {HTMLDivElement} */ (document.getElementById('pop-saved'));
	/** @type {HTMLButtonElement} */ (popSaved.lastElementChild).onclick = reloadExtension;
	const saveConfig = () => browser.storage.local.set({
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
		const v = /** @type {HTMLTextAreaElement} */ (b.ul).value.replace(/\\\//g, '/');
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
		const rawList = (b.dl.value + '\n' + b.ul.value).split('\n').filter(s => s.length);
		const reList = rawList.map(s => new RegExp(s));
		const matched = reList.filter(re => re.test(c.url.value)).map(re => re.source.replace(/\\\//g, '/'));
		if (matched.length) {
			matchedPattern.value = matched.join('\n');
		} else {
			matchedPattern.value = browser.i18n.getMessage('none');
		}
		const _parent = /** @type {HTMLElement} */ (matchedPattern.parentElement);
		_parent.hidden = false;
		_parent.focus();
		return false;
	};

	// save beta features
	g.onsubmit = () => {
		Promise.all([
			saveConfig(),
			browser.storage.local.set({
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
			}),
		]).then(() => {
			popSaved.hidden = false;
			popSaved.focus();
		});
		return false;
	};

	// modify browser setting
	if (browser.browserSettings && 'contextMenuShowEvent' in browser.browserSettings) {
		browser.browserSettings.contextMenuShowEvent.get({}).then(setting => {
			/** @type {HTMLInputElement} */ (ml.cm).checked = setting.value === 'mouseup';
		});
	}
	/** @type {HTMLInputElement} */ (ml.cm).onchange = async e => {
		const _target = /** @type {HTMLInputElement} */ (e.target);
		if (_target.checked) {
			try {
				if (await browser.permissions.request({ permissions: ['browserSettings'] })) {
					browser.browserSettings.contextMenuShowEvent.set({ value: 'mouseup' }).catch(err => {
						throw err;
					});
				} else {
					throw 'Permission denied: browserSettings';
				}
			} catch (err) {
				console.warn(err);
				_target.checked = false;
				const msgbox = dialogMessages[1];
				msgbox.getElementsByTagName('button')[0].onclick = closeDialog.bind(msgbox);
				openDialog.bind(msgbox)();
			}
		} else {
			try {
				_target.checked = !(await browser.browserSettings.contextMenuShowEvent.clear({}));
			} catch (err) {
				console.warn(err);
				_target.checked = true;
			}
		}
	};

	// preview
	let startX = 0, startY = 0;
	/** @type {string[]} */
	let gestures = [];
	const overlay = document.createElement('div');
	overlay.id = EXT_URL.replace(/[/:-]+/g, '-') + 'overlay';
	overlay.hidden = true;
	overlay.style.zIndex = 0x7fffffff.toFixed();
	document.body.appendChild(overlay);

	function checkstate(/** @type {MouseEvent} */ e) {
		const diffX = e.screenX - startX, diffY = e.screenY - startY;
		const absX = Math.abs(diffX), absY = Math.abs(diffY);
		const min = gestures.length ? vars.mm2 : vars.mm1;

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
	
	function onwheel(/** @type {WheelEvent} */ e) {
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

	function onmousedown(/** @type {MouseEvent} */ e) {
		gestures = [];
		startX = e.screenX, startY = e.screenY;
		if (e.button === 2) {
			overlay.hidden = false;
			window.addEventListener('mousemove', checkstate, { once: false });
			window.addEventListener('wheel', onwheel, { once: false });
			window.addEventListener('mouseup', e => {
				overlay.hidden = true;
				gesture.value = gestures.length ? gestures.map(v => browser.i18n.getMessage(v) || v).join('→') : browser.i18n.getMessage('rightclick');
				const _parent = /** @type {HTMLElement} */ (gesture.parentElement);
				_parent.hidden = false;
				_parent.focus();
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