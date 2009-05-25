//----------------------------------------------------------------------
// Misc. utilities
//----------------------------------------------------------------------

var Utils = {
	// node manipulation
	getOwnerDocument: function (node) {
		return node.ownerDocument || node.document;
	},
	contains: function (parent, descendant) {
		parent.nodeType && descendant.nodeType;
		if (parent.compareDocumentPosition)
			return !!(parent.compareDocumentPosition(descendant) & 16);
		if (parent.contains)
			return parent != descendant && parent.contains(descendant);
		while (descendant && (descendant = descendant.parentNode) && parent != descendant)
			continue;
		return !!descendant;
	},
	
	// style object manipulation
	_toCamelCase: function (property) {
		return property.replace(/\-([a-z])/g, function (string, letter) { return letter.toUpperCase(); });
	},
	getStyleProperty: function (style, prop) {
		return style.getPropertyValue ? style.getPropertyValue(prop) : style[Utils._toCamelCase(prop)];
	},
	setStyleProperty: function (style, prop, val) {
		style.setProperty ? style.setProperty(prop, val, null) : style[Utils._toCamelCase(prop)] = val;
	},
	removeStyleProperty: function (style, prop) {
		style.removeProperty ? style.removeProperty(prop) : style[Utils._toCamelCase(prop)] = '';
	},
	
	// style manipulation functions
	//[TODO] support non-camel-case, maybe
	swapStyles: function (element, tempStyles, callback) {
		var curStyles = {};
		for (var prop in tempStyles)
			curStyles[prop] = Utils.getStyleProperty(element.style, prop);
		Utils.setStyles(element, tempStyles);
		var ret = callback(element);
		Utils.setStyles(element, curStyles);
		return ret;
	},
	setStyles: function (element, styles) {
		for (var prop in styles)
			Utils.setStyleProperty(element.style, prop, styles[prop]);
	},
	addStylesheet: function (document, css) {
		var head = document.getElementsByTagName('head')[0] ||
		    document.documentElement.appendChild(document.createElement('head'));
		var style = head.appendChild(document.createElement('style'));
		document.styleSheets[0].cssText ?
		    document.styleSheets[document.styleSheets.length - 1].cssText = css :
		    style[style.innerText !== undefined ? 'innerText' : 'innerHTML'] = css;
	},

	// class attribute manipulation (base2)
	addClass: function (element, token) {
		if (!Utils.hasClass(element, token))
			element.className += (element.className ? ' ' : '') + token;
	},
	removeClass: function (element, token) {
		element.className = element.className.replace(new RegExp('(^|\\s)' + token + '(\\s|$)', 'g'), '$2').replace(/^\s|\s$/, '');
	},
	hasClass: function (element, token) {
		return (new RegExp('(^|\\s)' + token + '(\\s|$)')).test(element.className || '');
	},
	
	// UA detection
	isUserAgent: function (regexp) {
		return regexp.test(navigator.userAgent);
	},
	
	// function binding
	bind: function (fn, context) {
		return function () { return fn.apply(context, arguments ); };
	}
};