//----------------------------------------------------------------------
// Misc. utilities
//----------------------------------------------------------------------

var Utils = {
	// UA detection
	isUserAgent: function (regexp) {
		return regexp.test(navigator.userAgent);
	},
	
	// function binding
	bind: function (fn, context) {
		return function () { return fn.apply(context, arguments ); };
	}
};

var DOMUtils = {
	// node manipulation
	getOwnerDocument: function (node) {
		return node.ownerDocument || node.document;
	},
	
	isAncestorOf: function (parent, descendant) {
		parent.nodeType && descendant.nodeType;
		if (parent.compareDocumentPosition)
			return !!(parent.compareDocumentPosition(descendant) & 16);
		if (parent.contains)
			return parent != descendant && parent.contains(descendant);
		while (descendant && (descendant = descendant.parentNode) && parent != descendant)
			continue;
		return !!descendant;
	},
	
	isWhitespaceNode: function (node) {
		return node && node.nodeType == 3 && node.data.match(/^\s+$/);
	},
	
	isElement: function (node) {
		return node && node.nodeType == 1;
	}
};

var CSSUtils = {
	// style object manipulation
	
	_toCamelCase: function (property) {
		return property.replace(/\-([a-z])/g, function (string, letter) { return letter.toUpperCase(); });
	},
	
	getStyleProperty: function (style, prop) {
		return style.getPropertyValue ? style.getPropertyValue(prop) : style[CSSUtils._toCamelCase(prop)];
	},
	
	setStyleProperty: function (style, prop, val) {
		style.setProperty ? style.setProperty(prop, val, null) : style[CSSUtils._toCamelCase(prop)] = val;
	},
	
	removeStyleProperty: function (style, prop) {
		style.removeProperty ? style.removeProperty(prop) : style[CSSUtils._toCamelCase(prop)] = '';
	},
	
	// style manipulation functions
	
	swapStyles: function (element, tempStyles, callback) {
		var curStyles = {};
		for (var prop in tempStyles)
			curStyles[prop] = CSSUtils.getStyleProperty(element.style, prop);
		CSSUtils.setStyles(element, tempStyles);
		var ret = callback(element);
		CSSUtils.setStyles(element, curStyles);
		return ret;
	},
	
	setStyles: function (element, styles) {
		for (var prop in styles)
			CSSUtils.setStyleProperty(element.style, prop, styles[prop]);
	},
	
	addStylesheet: function (document, content) {
		var head = document.getElementsByTagName('head')[0] ||
		    document.documentElement.appendChild(document.createElement('head'));
		var style = document.createElement('style');
		try {
			style[style.innerText !== undefined ? 'innerText' : 'innerHTML'] = content;
			head.appendChild(style);
		} catch (e) {
			head.appendChild(style);
			document.styleSheets[document.styleSheets.length - 1].cssText = content;
		}
	},

	// class attribute manipulation (courtesy base2)
	
	addClass: function (element, token) {
		if (!CSSUtils.hasClass(element, token))
			element.className += (element.className ? ' ' : '') + token;
	},
	
	removeClass: function (element, token) {
		element.className = element.className.replace(new RegExp('(^|\\s)' + token + '(\\s|$)', 'g'), '$2').replace(/^\s|\s$/, '');
	},
	
	hasClass: function (element, token) {
		return (new RegExp('(^|\\s)' + token + '(\\s|$)')).test(element.className || '');
	}
};

var BoxUtils = {
	// box constants
	AXIS_DIMENSION: {vertical: 'height', horizontal: 'width'},
	AXIS_DIMENSION_UP: {vertical: 'Height', horizontal: 'Width'},
	AXIS_TL: {vertical: 'top', horizontal: 'left'},
	AXIS_BR: {vertical: 'bottom', horizontal: 'right'},
	DIMENSION_AXIS: {width: 'horizontal', height: 'vertical'},

	// CSS box dimensions
	
	_shiftDimension: function (element, dimension, axis, prop, expand) {
		return dimension +
		    (BoxUtils.getCSSLength(element, prop + '-' + BoxUtils.AXIS_TL[axis]) +
		     BoxUtils.getCSSLength(element, prop + '-' + BoxUtils.AXIS_BR[axis]))*(expand?1:-1);
	},
	
	getBoxDimension: function (element, type, axis) {
		if (type == 'content')
			return BoxUtils.getCSSLength(element, BoxUtils.AXIS_DIMENSION[axis]);
		if (type == 'border')
			if (element.getBoundingClientRect) {
				var rect = element.getBoundingClientRect();
				return rect[BoxUtils.AXIS_BR[axis]] - rect[BoxUtils.AXIS_TL[axis]];
			} else
				return element['offset' + BoxUtils.AXIS_DIMENSION_UP[axis]];
		return BoxUtils._shiftDimension(element, BoxUtils.getBoxDimension(element, 'border', axis), axis, type, type == 'margin');
	},
	
	isContentBoxDimensionAuto: function (element, axis) {
		// auto will not expand offset dimension with padding
		var temp = CSSUtils.getStyleProperty(element.style, 'padding-' + BoxUtils.AXIS_TL[axis]);
		CSSUtils.setStyleProperty(element.style, 'padding-' + BoxUtils.AXIS_TL[axis], '1px');
		var dimension = element['offset' + BoxUtils.AXIS_DIMENSION_UP[axis]];
		CSSUtils.setStyleProperty(element.style, 'padding-' + BoxUtils.AXIS_TL[axis], '2px');
		var flag = element['offset' + BoxUtils.AXIS_DIMENSION_UP[axis]] == dimension;
		CSSUtils.setStyleProperty(element.style, 'padding-' + BoxUtils.AXIS_TL[axis], temp);
		return flag;
	},
	
	// CSS box lengths
	
	_normalizeCSSLength: function (property) {
		return property.replace(/^(border-[a-z]+)$/, '$1-width');
	},
	
	getCSSLength: function (element, property) {
		property = BoxUtils._normalizeCSSLength(property);
		if (window.getComputedStyle) {
			var view = element.ownerDocument.defaultView, computedStyle = view.getComputedStyle(element, null);
			//[FIX] safari interprets computed margins weirdly (see Webkit bugs #19828, #13343)
			if (Utils.isUserAgent(/KTML|Webkit/i) && property == 'margin-right' &&
			    computedStyle.getPropertyValue('float') == 'none')
//[TODO] is there a quicker way than float: left?
				return parseFloat(CSSUtils.swapStyles(element, {'float': 'left'}, function () {
					return view.getComputedStyle(element, null).getPropertyValue(property);
				}));
			// return computed style value
			return parseFloat(computedStyle.getPropertyValue(property));
		}
		else if (element.currentStyle) {
			// getComputedStyle emulation for IE (courtesy Dean Edwards)
			var currentVal = CSSUtils.getStyleProperty(element.currentStyle, property);
			if (property.match(/^(width|height)$/))
//[TODO] pixelHeight/pixelWidth?
				return BoxUtils._shiftDimension(element, BoxUtils.getBoxDimension(element, 'padding', BoxUtils.DIMENSION_AXIS[property]), 'padding', false);
			if (/^\-?\d+(px)?$/i.test(currentVal) || currentVal == 'none')
				return parseFloat(currentVal) || 0;
			if (property.match(/^border/) && !(/^\-\d+/.test(currentVal))) { // border word-values
				var runtimeStyleVal = element.runtimeStyle.borderTopWidth;
				element.runtimeStyle.borderTopWidth = currentVal;
				var value = element.clientTop;
				element.runtimeStyle.borderTopWidth = runtimeStyleVal;
			} else { // length values
				var runtimeStyleVal = element.runtimeStyle.left;
				var styleVal = element.style.left;
				element.runtimeStyle.left = element.currentStyle.left;
				element.style.left = currentVal || 0;
				var value = element.style.pixelLeft;
				element.style.left = styleVal;
				element.runtimeStyle.left = runtimeStyleVal;
			}
			return value;
		}
		throw new Error('Cannot get computed element style.');
	},
	
	setCSSLength: function (element, property, length) {
		CSSUtils.setStyleProperty(element.style, BoxUtils._normalizeCSSLength(property), length + 'px');
		
		//[FIX] IE6 doesn't support min-height, min-width
		if (Utils.isUserAgent(/MSIE 6\./)) {
			if (property == 'min-height')
				element.runtimeStyle.setExpression('height', 'Math.max(' + element.uniqueID + '["sty"+"le"].pixelHeight, ' + Number(length) + ') + "px"');
			if (property == 'min-width')
				element.runtimeStyle.setExpression('width', 'Math.max(' + element.uniqueID + '["sty"+"le"].pixelWidth, ' + Number(length) + ') + "px"');
		}
	},
	
	resetCSSLength: function (element, property) {
		CSSUtils.removeStyleProperty(element.style, BoxUtils._normalizeCSSLength(property));
	},
	
	// relative offset calculation
	getRelativeOffset: function (element) {
		if (element.getBoundingClientRect) {
			var rect = element.getBoundingClientRect();
			return {x: rect.left, y: rect.top};
		}
		// offsetTop, left
		return {x: element.offsetLeft, y: element.offsetTop};
	}
};