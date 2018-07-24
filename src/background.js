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

	// main
	let gestures = [];
	let isUrl = url => typeof url === 'string' && url.startsWith('http');
	let getCurrent = () => new Promise((resolve, reject) => {
		browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
			if (tabs && tabs[0]) {
				resolve(tabs[0])
			} else {
				reject();
			}
		}, reject);
	});
	let func = {
		'down': url => browser.tabs.create(isUrl(url) ? { url: url } : {}),
		'down,right': () => getCurrent().then(tab => browser.tabs.remove(tab.id)),
		'down,up': url => browser.tabs.create(isUrl(url) ? { active: false, url: url } : { active: false }),
		'down,left': () => browser.windows.getCurrent().then(window => browser.windows.update(window.id, { state: 'minimized' })),
		'up,right': () => browser.windows.getCurrent().then(window => browser.windows.update(window.id, { state: window.state === 'normal' ? 'maximized' : 'normal' })),
	};

	browser.runtime.onMessage.addListener(m => {
		if ('direction' in m) {
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
				if (gesture in func) {
					func[gesture](m.url);
				} else {
					getCurrent().then(tab => browser.tabs.sendMessage(tab.id, { func: gesture }));
				}
				gestures = [];
			}
		}
	});
})();