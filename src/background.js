(function () {
	'use strict';
	Array.prototype.last = function (i) {
		return this[this.length - (i||0) - 1];
	};

	// reload discarded tabs
	browser.tabs.query({ currentWindow: true, discarded: true }).then(tabs => {
		for (let i = 0, l = tabs.length; i < l; i++) {
			browser.tabs.reload(tabs[i].id);
		}
	});
	
	// load config
	let enabled = {};
	let basic = 2047, extra = 0;
	browser.storage.local.get('gesture').then(v => {
		if (typeof v === 'object' && 'gesture' in v) {
			basic = v.gesture.basic;
			extra = v.gesture.extra;
		}
	}).catch(() => {}).then(() => {
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

	// main
	let gestures = [];
	let isUrl = url => typeof url === 'string' && url.startsWith('http');
	let getCurrentTab = () => new Promise((resolve, reject) => {
		browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
			if (tabs.length) {
				resolve(tabs[0])
			} else {
				reject();
			}
		}, reject);
	});
	let getRecentlySession = () => new Promise((resolve, reject) => {
		browser.sessions.getRecentlyClosed({ maxResults: 1 }).then(sessions => {
			if (sessions.length) {
				resolve(sessions[0]);
			} else {
				reject();
			}
		}, reject);
	});
	let func = {
		'down': url => browser.tabs.create(isUrl(url) ? { url: url } : {}),
		'down,up': (url, _url) => browser.tabs.create({ active: false, url: isUrl(url) ? url : _url }),
		'down,right': () => getCurrentTab().then(tab => browser.tabs.remove(tab.id)),
		'down,left': () => browser.windows.getCurrent().then(window => browser.windows.update(window.id, { state: 'minimized' })),
		'up,right': () => browser.windows.getCurrent().then(window => browser.windows.update(window.id, { state: window.state === 'normal' ? 'maximized' : 'normal' })),
		'right,up': () => getRecentlySession().then(session => browser.sessions.restore((session.tab || session.window).sessionId)),
	};

	browser.runtime.onMessage.addListener(m => {
		if (enabled.wheel && 'direction' in m) {
			browser.tabs.query({ currentWindow: true }).then(tabs => {
				let currentIdx = Infinity, targetIdx = Infinity;
				let tabsLen = tabs.length;
				for (let i = tabsLen - 1; i >= 0; i--) {
					if (tabs[i].active) {
						currentIdx = i;
						targetIdx = tabs[i].index + m.direction;
						if (targetIdx === -1) {
							targetIdx = tabsLen - 1;
						} else if (targetIdx === tabsLen) {
							targetIdx = 0;
						}
						break;
					}
				}
				let current = tabs[currentIdx], target = tabs[targetIdx];
				if (target) {
					browser.tabs.update(target.id, { active: true }).then(() => {
						browser.tabs.sendMessage(current.id, { func: 'leave' });
						browser.tabs.sendMessage(target.id, { func: 'enter' });
					});
				}
			});
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
						func[gesture](m.url, m.currentUrl);
					} else {
						getCurrentTab().then(tab => browser.tabs.sendMessage(tab.id, { func: gesture }));
					}
				}
				gestures = [];
			}
		}
	});
})();