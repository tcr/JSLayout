//----------------------------------------------------------------------
// DOM utilities
//----------------------------------------------------------------------
 
var DOMUtils = {
	swapStyles: function (element, tempStyles, callback) {
//[TODO] runtimeStyle?
		var curStyles = {};
		forEach(tempStyles, function (value, prop) {
			curStyles[prop] = element.style[prop];
		});
		DOMUtils.setStyles(element, tempStyles);
		var ret = callback(element);
		DOMUtils.setStyles(element, curStyles);
		return ret;
	},
	//[TODO] support non-camel-case, maybe
	setStyles: function (element, styles) {
		forEach(styles, function (value, prop) {
			element.style[prop] = value;
		});
	},
	addStyles: function (document, css) {
		var head = document.getElementsByTagName('head')[0] ||
		    document.documentElement.appendChild(document.createElement('head'));
		var style = head.appendChild(document.createElement('style'));
		document.styleSheets[0].cssText ?
		    document.styleSheets[document.styleSheets.length - 1].cssText = css :
		    style[style.innerText !== undefined ? 'innerText' : 'innerHTML'] = css;
	},
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
	addClass: function (element, className) {
		DOMUtils.removeClass(element, className);
		element.className += ' ' + className;
	},
	removeClass: function (element, className) {
		element.className = (' ' + (element.className || '') + ' ').replace(' ' + className + ' ', ' ');
	}
};