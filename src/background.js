(function () {
	'use strict';
	Array.prototype.last = function (i) {
		return this[this.length - (i || 0) - 1];
	};

	browser.runtime.onStartup.addListener(() => {
		browser.notifications.onClicked.addListener(() => {
			browser.runtime.openOptionsPage();
		});
		browser.notifications.create({
			type: 'basic',
			title: 'Opera Gestures',
			message: browser.i18n.getMessage('notice_onstartup'),
			iconUrl: browser.runtime.getURL('icon.svg'),
		});
	});
	
	// reload discarded tabs
	browser.tabs.query({ currentWindow: true, discarded: true }).then(tabs => {
		for (let i = 0, l = tabs.length; i < l; i++) {
			browser.tabs.reload(tabs[i].id);
		}
	});
	
	let ports = [];
	let enabled = {};
	
	// load storage
	browser.storage.local.get('gesture').then(v => {
		let basic = 2047, extra = 0;
		let gesture = v && (v[0] || v).gesture;
		if (gesture) {
			basic = gesture.basic;
			extra = gesture.extra;
		} else {
			browser.storage.local.set({
				version: browser.runtime.getManifest().version,
				gesture: { basic: 2047, extra: 0 },
			});
		}
		enabled = {
			'left': basic & 1,
			'right': basic & 2,
			'up,left': basic & 4,
			'up,down': basic & 8,
			'up': basic & 16,
			'down': basic & 32,
			'down,up': basic & 64,
			'wheel': basic & 128,
			'down,right': basic & 256,
			'down,left': basic & 512,
			'up,right': basic & 1024,
			'right,up': extra & 1,
		};
	});

	browser.runtime.onConnect.addListener(function (p) {
		ports[p.sender.tab.id] = p;
		p.onMessage.addListener(onmessage.bind(p));
	});

	// main
	let gestures = [];
	let isUrl = url => typeof url === 'string' && url.startsWith('http');
	let func = {
		'down': function createNewTab(url) {
			let opt = isUrl(url) ? { url: url } : {};
			browser.tabs.create(opt);
		},
		'down,up': function createNewBackgroundTab(url) {
			let opt = {
				active: false,
				url: isUrl(url) ? url : this.sender.url,
			};
			browser.tabs.create(opt);
		},
		'down,right': function removeThisTab() {
			browser.tabs.remove(this.sender.tab.id);
		},
		'down,left': async function minimizeThisTab() {
			let currentWindow = await browser.windows.getCurrent();
			if (currentWindow) {
				let opt = { state: 'minimized' };
				browser.windows.update(currentWindow.id, opt);
			}
		},
		'up,right': async function maximizeThisTab() {
			let currentWindow = await browser.windows.getCurrent();
			if (currentWindow) {
				let opt = { state: currentWindow.state === 'normal' ? 'maximized' : 'normal' };
				browser.windows.update(currentWindow.id, opt);
			}
		},
		'right,up': async function restoreRecentlyClosed() {
			let sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
			if (sessions.length) {
				browser.sessions.restore((sessions[0].tab || sessions[0].window).sessionId);
			}
		},
	};

	async function onmessage(m) {
		// this = port
		if (enabled.wheel && 'direction' in m) {
			let tabs = await browser.tabs.query({ currentWindow: true });
			let tabsLen = tabs.length;
			let targetIdx = this.sender.tab.index + m.direction;
			if (targetIdx < 0 && tabsLen <= targetIdx) {
				targetIdx = 0;
			}
			let target = tabs[targetIdx];
			if (target) {
				browser.tabs.update(target.id, { active: true }).then(() => {
					this.postMessage({ func: 'leave' });
					ports[target.id].postMessage({ func: 'enter' });
				});
			}
		} else {
			if (m.states) {
				let state = m.states[(gestures.length && m.states[0] === gestures.last() && m.states[1] !== gestures.last())|0];
				if (state && state !== gestures.last() && state !== gestures.last(1)) {
					gestures.push(state);
				}
			}
			if (m.execute) {
				let gesture = gestures.join();
				if (enabled[gesture]) {
					if (gesture in func) {
						func[gesture].bind(this)(m.url);
					} else {
						this.postMessage({ func: gesture });
					}
				}
				gestures = [];
			}
		}
	}
})();