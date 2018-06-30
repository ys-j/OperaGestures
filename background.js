(function () {
	'use strict';
	browser.runtime.onMessage.addListener(m => {
		if (m.type === 'create') {
			browser.tabs.create(m.options);
		} else if (m.type === 'remove') {
			browser.tabs.query({ active: true }).then(tabs => {
				if (tabs && tabs[0]) {
					browser.tabs.remove(tabs[0].id);
				}
			});
		}
	});
})();