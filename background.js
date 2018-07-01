(function () {
	'use strict';
	browser.runtime.onMessage.addListener(m => {
		if (m.type === 'create') {
			browser.tabs.create(m.options || {});
		} else if (m.type === 'remove') {
			browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
				if (tabs && tabs[0]) {
					browser.tabs.remove(tabs[0].id);
				}
			});
		} else if (m.type === 'window') {
			browser.windows.getCurrent().then(window => {
				if (m.options && m.options.state === window.state) m.options.state = 'normal';
				browser.windows.update(window.id, m.options || {});
			});
		} else if ('direction' in m) {
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
						browser.tabs.sendMessage(current.id, { message: 'leave' });
						browser.tabs.sendMessage(target.id, { message: 'enter' });
					});
				}
			});
		}
	});
})();