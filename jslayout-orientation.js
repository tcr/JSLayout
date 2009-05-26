//------------------------------------------------------------------------------
// JS Orientation Manager
// (c) Tim Cameron Ryan 2008-09
//------------------------------------------------------------------------------

new function(_) {


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
		// replaced elements, by default, are fixed-size
		if (element.nodeName.toLowerCase().match(/^(input|button|object|applet|iframe|textarea)$/))
			return false;
	
		//[FIX] IE is the only browser which supports computed style; IE6 has content-expansion issues anyway, so use this
		if (element.currentStyle)
			return element.currentStyle[BoxUtils.AXIS_DIMENSION[axis]] == 'auto';
	
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
};//------------------------------------------------------------------------------
// JavaScript Inheritance
//------------------------------------------------------------------------------

function Structure() { }
Structure.extend = function (p, s) {
	var OP = Object.prototype;
	function augment(obj, props) {
		// iterate all defined properties
		for (var prop in props)
			if (OP.hasOwnProperty.call(props, prop))
				obj[prop] = props[prop];
	
		// IE has dontEnum issues
/*@cc_on	var prop, dontenums = 'constructor|toString|valueOf|toLocaleString|isPrototypeOf|propertyIsEnumerable|hasOwnProperty'.split('|');
		while (prop = dontenums.pop())
			if (OP.hasOwnProperty.call(props, prop) && !OP.propertyIsEnumerable.call(props, prop))
				obj[prop] = props[prop]; @*/
	}
	
	// clean input
	var props = p || {}, statics = s || {};
	// create factory object
	var ancestor = this, Factory = OP.hasOwnProperty.call(props, 'constructor') ?
	    props.constructor : function () { ancestor.apply(this, arguments); }
	
	// copy and extend statics
	augment(Factory, Structure);
	augment(Factory, statics);
	// copy and extend prototype
	var Super = function () { };
	Super.prototype = this.prototype;
	Factory.prototype = new Super();
	augment(Factory.prototype, props);
	Factory.prototype.constructor = Factory;
	
	// return new factory object			
	return Factory;
};//----------------------------------------------------------------------
// node user data manager
//----------------------------------------------------------------------

var NodeUserData = Structure.extend({
	prefix: '',
	constructor: function (prefix) {
		this.prefix = prefix ? prefix + ':' : '';
	},
	
	get: function (node, key) {
		return node.getUserData(this.prefix + key);
	},
	
	set: function (node, key, data) {
		return node.setUserData(this.prefix + key, data, null);
	},
	
	has: function (node, key) {
		return this.get(node, key) != null;
	},
	
	remove: function (node, key) {
		this.set(node, key, null);
	}
});

// check for implementation of DOM UserData
if (!document.getUserData || !document.setUserData)
{
	// create private data cache
	var userData = {}, userDataID = 0;
	NodeUserData.prototype.get = function (node, key) {
		if (typeof node['data-userDataKey'] == 'undefined')
			node['data-userDataKey'] = ++userDataID;
		return userData[node['data-userDataKey']] && userData[node['data-userDataKey']][key];
	};
	NodeUserData.prototype.set = function (node, key, data) {
		var old = this.get(node, key);
		(userData[node['data-userDataKey']] || (userData[node['data-userDataKey']] = {}))[key] = data;
		return old;
	};
}//------------------------------------------------------------------------------
// orientation manager
//------------------------------------------------------------------------------

var OrientationManager = Structure.extend({
	document: null,
	constructor: function (document) {
		// save document reference
		if (!document || document.nodeType != 9)
			throw new Error('Invalid document reference supplied.');
		this.document = document;
		this.body = document.getElementsByTagName('body')[0];
		
		// add orientation styles
		CSSUtils.addStylesheet(document, [
//[TODO] child selector would be so nice here
			'.orientation-horizontal { overflow: hidden; }',
			'.orientation-horizontal-child { float: left; }'
		    ].join('\n'));
	},
	
	getOrientation: function (element) {
		return OrientationBox.getOrientation(element);
	},
	
	setOrientation: function (element, axis) {
		/* NOTE: orientation on body is possible, but float containment only works in Mozilla if
		   overflow is defined on the document element, not the body; disallow it for uniformity's sake */
		
		// validate element
		if (!DOMUtils.isElement(element))
			throw new Error('Invalid DOM element supplied.');
		if (!DOMUtils.isAncestorOf(this.body, element))
			throw new Error('Only descendants of the body element can have orientation.');
		// set orientation
		OrientationBox.setOrientation(element, axis == 'horizontal' ? axis : 'vertical');
	},
	
//[TODO] integrate/make this better/work correctly
	updateOrientationMinima: function (element) {
		// update minimum dimensions of oriented element
//		OrientationBox.updateOrientationMinima(element);
	}
});

/*
 * orientation boxes
 */
 
var OrientationData = new NodeUserData('orientation');
 
var OrientationBox = {
 	getOrientation: function (element) {
		return OrientationData.get(element, 'orientation') || 'vertical';
	},
	setOrientation: function (element, axis) {
		// set data (if axis has changed)
		if (OrientationBox.getOrientation(element) == axis)
			return;
		OrientationData.set(element, 'orientation', axis);

		// sanitize child elements and update them
		if (axis == 'horizontal')
			OrientationBox.sanitizeChildren(element);
		for (var child = element.firstChild; child; child = child.nextSibling)
			OrientationBoxChild.updateOrientation(child, axis);

		// manipulate widths and classes
		if (axis == 'horizontal') {
			// expand box size to contain floats without wrapping
			if (BoxUtils.isContentBoxDimensionAuto(element, axis)) {
				BoxUtils.setCSSLength(element, 'width', OrientationBox.getContentSize(element));
				OrientationData.set(element, 'container-horizontal-shrink', true);
			}
			// add class
			CSSUtils.addClass(element, 'orientation-horizontal');
		} else {
			// remove styles
			if (OrientationData.get(element, 'container-horizontal-shrink')) {
				BoxUtils.resetCSSLength(element, 'width');
				OrientationData.set(element, 'container-horizontal-shrink', false);
			}
			// remove class
			CSSUtils.removeClass(element, 'orientation-horizontal');
		}
	},
	
	updateOrientationMinima: function (element) {
		// expand box size to contain floats without wrapping
		var axis = OrientationBox.getOrientation(element);
		if (axis == 'horizontal' && OrientationData.get(element, 'container-horizontal-shrink')) {
			BoxUtils.setCSSLength(element, 'width', OrientationBox.getContentSize(element));
		}
	},
	
	sanitizeChildren: function (element) {
		// horizontal orientation requires only elements can be children
		for (var i = 0, child; child = element.childNodes[i]; i++) {
			if (child.nodeType == 3 && !DOMUtils.isWhitespaceNode(child)) {
				// wrap text nodes in span elements
				var wrap = DOMUtils.getOwnerDocument(element).createElement('span');
				CSSUtils.addClass(wrap, 'orientation-text');
				child.parentNode.replaceChild(wrap, child);
				wrap.appendChild(child);
			} else if (child.nodeType != 1) {
				// delete all other nodes
				element.removeChild(child);
				i--;
			}
		}		
	},
	
//[TODO] other ways of doing this? particularly horizontally...
	// size of box content, depending on orientation
	getContentSize: function (element) {
		if (OrientationBox.getOrientation(element) == 'vertical') {
			// get vertical size by differing offsets of an anchor at start and end of content
			var anchor = DOMUtils.getOwnerDocument(element).createElement('span');
			CSSUtils.setStyleProperty(anchor.style, 'block');
			element.appendChild(anchor);
			var size = BoxUtils.getRelativeOffset(anchor).y;
			element.insertBefore(anchor, element.firstChild);
			size -= BoxUtils.getRelativeOffset(anchor).y;
			element.removeChild(anchor);
			return size;
		} else {
			// get horizontal size by adding box dimensions (slow)
			for (var size = 0, child = element.firstChild; child; child = child.nextSibling)
				if (child.nodeType == 1)
					size += BoxUtils.getBoxDimension(child, 'margin', 'horizontal');
			return size;
		}
	}
};

var OrientationBoxChild = {
	updateOrientation: function (element, axis) {
		// manipulate widths and classes
		if (axis == 'horizontal') {
			// if box doesn't have fixed with, shrink horizontally
			if (BoxUtils.isContentBoxDimensionAuto(element, axis)) {
				BoxUtils.setCSSLength(element, 'width', OrientationBoxChild.getMinContentWidth(element));
				OrientationData.set(element, 'horizontal-shrink', true);
			}			
			// add class
			CSSUtils.addClass(element, 'orientation-horizontal-child');
			
			//[FIX] IE6 has a float-margin doubling bug
			if (Utils.isUserAgent(/MSIE 6\./))
				element.runtimeStyle.display = 'inline';
		} else {
			// undo horizontal shrinkage
			if (OrientationData.get(element, 'horizontal-shrink')) {
				BoxUtils.resetCSSLength(element, 'width');
				OrientationData.set(element, 'horizontal-shrink', false)
			}			
			// remove class
			CSSUtils.removeClass(element, 'orientation-horizontal-child');
			
			//[FIX] IE6 has a float-margin doubling bug
			if (Utils.isUserAgent(/MSIE 6\./))
				element.runtimeStyle.display = '';
		}
	},

//[TODO] other ways of doing this?
	// get minimum content width, for initial horizontal sizing
	getMinContentWidth: function (element) {
		// min/max-content width for browser that support the CSS property
		//[NOTE] in theory safari supports '(min-)intrinsic', but it's not equivalent
		if (Utils.isUserAgent(/Gecko\//i)) {
			return CSSUtils.swapStyles(element, {width: '-moz-min-content'}, function () {
				return BoxUtils.getBoxDimension(element, 'content', 'horizontal');
			});
		}
	
		//[FIX] Safari doesn't like dimensions of '0'
		return CSSUtils.swapStyles(element, {width: '1px', overflow: 'auto'}, function () {
			return BoxUtils._shiftDimension(element, element.scrollWidth, 'horizontal', 'padding', false);
		});
	}
};
//------------------------------------------------------------------------------
// package
//------------------------------------------------------------------------------

// exports
window.OrientationManager = OrientationManager;

};

//