//------------------------------------------------------------------------------
// JS Orientation Manager
// (c) Tim Cameron Ryan 2008-09
//------------------------------------------------------------------------------

new function(_) {


/*
	Base.js, version 1.1
	Copyright 2006-2007, Dean Edwards
	License: http://www.opensource.org/licenses/mit-license.php
*/

var Base = function() {
	// dummy
};

Base.extend = function(_instance, _static) { // subclass
	var extend = Base.prototype.extend;
	
	// build the prototype
	Base._prototyping = true;
	var proto = new this;
	extend.call(proto, _instance);
	delete Base._prototyping;
	
	// create the wrapper for the constructor function
	//var constructor = proto.constructor.valueOf(); //-dean
	var constructor = proto.constructor;
	var klass = proto.constructor = function() {
		if (!Base._prototyping) {
			if (this._constructing || this.constructor == klass) { // instantiation
				this._constructing = true;
				constructor.apply(this, arguments);
				delete this._constructing;
			} else if (arguments[0] != null) { // casting
				return (arguments[0].extend || extend).call(arguments[0], proto);
			}
		}
	};
	
	// build the class interface
	klass.ancestor = this;
	klass.extend = this.extend;
	klass.forEach = this.forEach;
	klass.implement = this.implement;
	klass.prototype = proto;
	klass.toString = this.toString;
	klass.valueOf = function(type) {
		//return (type == "object") ? klass : constructor; //-dean
		return (type == "object") ? klass : constructor.valueOf();
	};
	extend.call(klass, _static);
	// class initialisation
	if (typeof klass.init == "function") klass.init();
	return klass;
};

Base.prototype = {	
	extend: function(source, value) {
		if (arguments.length > 1) { // extending with a name/value pair
			var ancestor = this[source];
			if (ancestor && (typeof value == "function") && // overriding a method?
				// the valueOf() comparison is to avoid circular references
				(!ancestor.valueOf || ancestor.valueOf() != value.valueOf()) &&
				/\bbase\b/.test(value)) {
				// get the underlying method
				var method = value.valueOf();
				// override
				value = function() {
					var previous = this.base || Base.prototype.base;
					this.base = ancestor;
					var returnValue = method.apply(this, arguments);
					this.base = previous;
					return returnValue;
				};
				// point to the underlying method
				value.valueOf = function(type) {
					return (type == "object") ? value : method;
				};
				value.toString = Base.toString;
			}
			this[source] = value;
		} else if (source) { // extending with an object literal
			var extend = Base.prototype.extend;
			// if this object has a customised extend method then use it
			if (!Base._prototyping && typeof this != "function") {
				extend = this.extend || extend;
			}
			var proto = {toSource: null};
			// do the "toString" and other methods manually
			var hidden = ["constructor", "toString", "valueOf"];
			// if we are prototyping then include the constructor
			var i = Base._prototyping ? 0 : 1;
			while (key = hidden[i++]) {
				if (source[key] != proto[key]) {
					extend.call(this, key, source[key]);

				}
			}
			// copy each of the source object's properties to this object
			for (var key in source) {
				if (!proto[key]) extend.call(this, key, source[key]);
			}
		}
		return this;
	},

	base: function() {
		// call this method from any other method to invoke that method's ancestor
	}
};

// initialise
Base = Base.extend({
	constructor: function() {
		this.extend(arguments[0]);
	}
}, {
	ancestor: Object,
	version: "1.1",
	
	forEach: function(object, block, context) {
		for (var key in object) {
			if (this.prototype[key] === undefined) {
				block.call(context, object[key], key, object);
			}
		}
	},
		
	implement: function() {
		for (var i = 0; i < arguments.length; i++) {
			if (typeof arguments[i] == "function") {
				// if it's a function, call it
				arguments[i](this.prototype);
			} else {
				// add the interface using the extend method
				this.prototype.extend(arguments[i]);
			}
		}
		return this;
	},
	
	toString: function() {
		return String(this.valueOf());
	}
});

// important enough to steal from base2
function bind(fn, context) {
  var lateBound = typeof fn != "function";
  if (arguments.length > 2) {
    var args = _slice.call(arguments, 2);
    return function() {
      return (lateBound ? context[fn] : fn).apply(context, args.concat.apply(args, arguments));
    };
  } else { // faster if there are no additional arguments
    return function() {
      return (lateBound ? context[fn] : fn).apply(context, arguments);
    };
  }
};
//----------------------------------------------------------------------
// DOM utilities
//----------------------------------------------------------------------

// DOMUtils vs. CSSUtils vs. Utils?
var DOMUtils = {
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
		return style.getPropertyValue ? style.getPropertyValue(prop) : style[DOMUtils._toCamelCase(prop)];
	},
	setStyleProperty: function (style, prop, val) {
		style.setProperty ? style.setProperty(prop, val, null) : style[DOMUtils._toCamelCase(prop)] = val;
	},
	removeStyleProperty: function (style, prop) {
		style.removeProperty ? style.removeProperty(prop) : style[DOMUtils._toCamelCase(prop)] = '';
	},
	
	// style manipulation functions
	//[TODO] support non-camel-case, maybe
	swapStyles: function (element, tempStyles, callback) {
		var curStyles = {};
		for (var prop in tempStyles)
			curStyles[prop] = DOMUtils.getStyleProperty(element.style, prop);
		DOMUtils.setStyles(element, tempStyles);
		var ret = callback(element);
		DOMUtils.setStyles(element, curStyles);
		return ret;
	},
	setStyles: function (element, styles) {
		for (var prop in styles)
			DOMUtils.setStyleProperty(element.style, prop, styles[prop]);
	},
	addStylesheet: function (document, css) {
		var head = document.getElementsByTagName('head')[0] ||
		    document.documentElement.appendChild(document.createElement('head'));
		var style = head.appendChild(document.createElement('style'));
		document.styleSheets[0].cssText ?
		    document.styleSheets[document.styleSheets.length - 1].cssText = css :
		    style[style.innerText !== undefined ? 'innerText' : 'innerHTML'] = css;
	},

	// class attribute manipulation
	addClass: function (element, className) {
		DOMUtils.removeClass(element, className);
		element.className += ' ' + className;
	},
	removeClass: function (element, className) {
		element.className = (' ' + (element.className || '') + ' ').replace(' ' + className + ' ', ' ');
	},
	hasClass: function (element, className) {
		return (' ' + (element.className || '') + ' ').indexOf(' ' + className + ' ') != -1;
	},
	
	// detection class
	isUserAgent: function (regexp) {
		return regexp.test(navigator.userAgent);
	}
};//----------------------------------------------------------------------
// CSS Box
//----------------------------------------------------------------------

var CSSBox = Base.extend({
	constructor: function (element) {
		if (!element || element.nodeType !== 1)
			throw new Error('Invalid DOM element supplied.');
		this.element = element;
		this.view = DOMUtils.getOwnerDocument(element).defaultView || window;
	},
	_getRoughOffset: function () {
		if (this.element.getBoundingClientRect) {
			var rect = this.element.getBoundingClientRect();
			return {x: rect.left, y: rect.top};
		}
		// offsetTop, left
		return {x: this.element.offsetLeft, y: this.element.offsetTop};
	},
	_shiftDimension: function (dimension, axis, prop, expand) {
		return dimension + (this.getCSSLength(prop + '-' + CSSBox.AXIS_TL[axis]) + this.getCSSLength(prop + '-' + CSSBox.AXIS_BR[axis]))*(expand?1:-1)
	},
	getBoxDimension: function (type, axis) {
		if (type == 'content')
			return this.getCSSLength(CSSBox.AXIS_DIMENSION[axis]);
		if (this.element.getBoundingClientRect) {
			var rect = this.element.getBoundingClientRect();
			var dimension = rect[CSSBox.AXIS_BR[axis]] - rect[CSSBox.AXIS_TL[axis]];
		} else
			var dimension = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]];
		switch (type) {
			case 'margin': return this._shiftDimension(dimension, axis, 'margin', true);
			case 'border': return dimension;
			case 'padding': return this._shiftDimension(dimension, axis, 'border', false);
		}
	},
	getCSSLength: function (property) {
		property = this._normalizeProperty(property);
		if (this.view.getComputedStyle) {
			var computedStyle = this.view.getComputedStyle(this.element, null);
			//[FIX] safari interprets computed margins weirdly (see Webkit bugs #19828, #13343)
			if (DOMUtils.isUserAgent(/KTML|Webkit/i) && property == 'margin-right' &&
			    computedStyle.getPropertyValue('float') == 'none')
				return Math.max(parseFloat(DOMUtils.swapStyles(this.element, {'margin-left': 'auto'}, bind(function () {
					return this.view.getComputedStyle(this.element, null).getPropertyValue(property);
				}, this))), 0);
			// return computed style value
			return parseFloat(computedStyle.getPropertyValue(property));
		}
		else if (this.element.currentStyle) {
			// getComputedStyle emulation for IE (courtesy Dean Edwards)
			var currentVal = DOMUtils.getStyleProperty(this.element.currentStyle, property);
			if (property.match(/^(width|height)$/))
				return this._shiftDimension(this.getBoxDimension('padding', {width: 'horizontal', height: 'vertical'}[property]), 'padding', false);
			if (/^\-?\d+(px)?$/i.test(currentVal) || currentVal == 'none')
				return parseFloat(currentVal) || 0;
			if (property.match(/^border/) && !(/^\-\d+/.test(currentVal))) { // border word-values
				var runtimeStyleVal = this.element.runtimeStyle.borderTopWidth;
				this.element.runtimeStyle.borderTopWidth = currentVal;
				var value = this.element.clientTop;
				this.element.runtimeStyle.borderTopWidth = runtimeStyleVal;
			} else { // length values
				var runtimeStyleVal = this.element.runtimeStyle.left;
				var styleVal = this.element.style.left;
				this.element.runtimeStyle.left = this.element.currentStyle.left;
				this.element.style.left = currentVal || 0;
				var value = this.element.style.pixelLeft;
				this.element.style.left = styleVal;
				this.element.runtimeStyle.left = runtimeStyleVal;
			}
			return value;
		}
		throw new Error('Cannot get computed element style.');
	},
	setCSSLength: function (property, length) {
		DOMUtils.setStyleProperty(this.element.style, this._normalizeProperty(property), length + 'px')
	},
	resetCSSLength: function (property) {
		DOMUtils.removeStyleProperty(this.element.style, this._normalizeProperty(property))
	},
	_normalizeProperty: function (property) {
		return property.replace(/^(border-[a-z]+)$/, '$1-width');
	},
	isContentBoxDimensionAuto: function (axis) {
		// auto will not expand offset dimension with padding
		var temp = DOMUtils.getStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis]);
		DOMUtils.setStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis], '0px');
		var dimension = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]];
		DOMUtils.setStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis], '1px');
		var flag = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]] == dimension;
		DOMUtils.setStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis], temp);
		return flag;
	}
}, {
	AXIS_DIMENSION: {vertical: 'height', horizontal: 'width'},
	AXIS_DIMENSION_UP: {vertical: 'Height', horizontal: 'Width'},
	AXIS_TL: {vertical: 'top', horizontal: 'left'},
	AXIS_BR: {vertical: 'bottom', horizontal: 'right'}
});

//----------------------------------------------------------------------
// node user data manager
//----------------------------------------------------------------------

//[TODO] could prefixes be randomly generated? or eliminated...
var NodeUserData = Base.extend({
	node: null,
	prefix: '',
	constructor: function (node, prefix) {
		if (!node || !node.nodeType)
			throw new Error('Invalid DOM node supplied.');
		this.node = node;
		this.prefix = prefix ? prefix + ':' : '';
	},
	get: function (key) {
		return NodeUserData.getUserData(this.node, this.prefix + key);
	},
	set: function (key, data) {
		return NodeUserData.setUserData(this.node, this.prefix + key, data, null);
	},
	has: function (key) {
		return this.get(key) != null;
	},
	remove: function (key) {
		this.set(key, null);
	},
	ensure: function (key, defaultValue) {
		if (!this.has(key))
			this.set(key, defaultValue);
	}
}, {
	'getUserData': function (node, key) {
		return node.getUserData(key);
	},
	'setUserData': function (node, key, value, handler) {
		return node.setUserData(key, value, handler);
	}
});

if (!document.getUserData || !document.setUserData)
{
	// create our own data cache
	var userData = {}, userDataID = 0;
	NodeUserData.getUserData = function (node, key) {
		if (typeof node['data-userDataKey'] == 'undefined')
			node['data-userDataKey'] = ++userDataID;
		return userData[node['data-userDataKey']] && userData[node['data-userDataKey']][key];
	};
	NodeUserData.setUserData = function (node, key, value, handler) {
		var old = NodeUserData.getUserData(node, key);
		(userData[node['data-userDataKey']] || (userData[node['data-userDataKey']] = {}))[key] = value;
		return old;
	};
}//----------------------------------------------------------------------
// orientation manager
//----------------------------------------------------------------------

var OrientationManager = Base.extend({
	document: null,
	constructor: function (document) {
		// save document reference
		if (!document || document.nodeType != 9)
			throw new Error('Invalid document reference supplied.');
		this.document = document;
		this.body = document.getElementsByTagName('body')[0];
		
		// add orientation styles
		DOMUtils.addStylesheet(document, [
			'.orientation-horizontal { overflow: hidden; width: 0; }',
			'.orientation-horizontal-child { float: left; width: 0; }',
		    ].join('\n'));
	},
	
	getOrientation: function (element) {
		return (new OrientationBox(element)).getOrientation();
	},
	setOrientation: function (element, axis) {
		/* NOTE: orientation on body is possible, but float containment only works in Mozilla if
		   overflow is defined on the document element, not the body; disallow it for uniformity's sake */
		
		// initialize
		var parent = new OrientationBox(element);
		// validate element
		if (!DOMUtils.contains(this.body, element))
			throw new Error('Only descendants of the body element can have orientation.');
		// set orientation
		parent.setOrientation(axis == 'horizontal' ? axis : 'vertical');
	}
});

/*
 * orientation boxes
 */
 
//@abstract
var LayoutBase = Base.extend({
	document: null,
	element: null,
	box: null,
	data: null,
	constructor: function (element) {
		if (!element || element.nodeType != 1)
			throw new Error('Invalid DOM element supplied.');
		this.element = element;
		this.document = DOMUtils.getOwnerDocument(element);
		this.box = new CSSBox(element);
		this.data = new NodeUserData(element, 'layout');
	}
});
 
var OrientationBox = LayoutBase.extend({
	getOrientation: function () {
		return this.data.has('orientation') ? this.data.get('orientation') : 'vertical';
	},
	setOrientation: function (axis) {
		// set data (if axis has changed)
		if (this.getOrientation() == axis)
			return;
		this.data.set('orientation', axis);
		
		// wrap or unwrap child text nodes
		axis == 'horizontal' ? this.containChildTextNodes() : this.restoreChildTextNodes();
		// update child elements
		for (var child = this.element.firstChild; child; child = child.nextSibling)
			if (child.nodeType == 1)
				(new OrientationBoxChild(child)).updateOrientation(axis);
			
		// classes, styles
		if (axis == 'horizontal') {
			// add class
			DOMUtils.addClass(this.element, 'orientation-horizontal');
			// expand box size to contain floats without wrapping
			this.box.setCSSLength('width', this.getContentSize());
		} else {
			// remove class and styles
			DOMUtils.removeClass(element, 'orientation-horizontal');
			this.box.resetCSSLength('width');
		}
	},
	
	containChildTextNodes: function () {
		// wrap child text nodes in span elements
		for (var child = this.element.firstChild; child; child = child.nextSibling) {
			if (child.nodeType == 3) {
				var wrap = this.document.createElement('span');
				DOMUtils.addClass(wrap, 'orientation-text');
				child.parentNode.replaceChild(wrap, child);
				wrap.appendChild(child);
				child = wrap;
			}
		}		
	},
	restoreChildTextNodes: function () {
		// undo child text node wrapping
		for (var child = this.element.firstChild; child; child = child.nextSibling) {
			if (child.nodeType == 1 && DOMUtils.hasClass(child, 'orientation-text')) {
				child = child.firstChild;
				child.parentNode.parentNode.replaceChild(child, child.parentNode);
			}
		}
	},
	
//[TODO] other ways of doing this? particularly horizontally...
	// size of box content, depending on orientation
	getContentSize: function () {
		if (this.getOrientation() == 'vertical') {
			var anchor = this.document.createElement('span'), box = new CSSBox(anchor);
			DOMUtils.setStyleProperty(anchor.style, 'block');
			this.element.appendChild(anchor);
			var size = box._getRoughOffset().y;
			this.element.insertBefore(anchor, this.element.firstChild);
			size -= box._getRoughOffset().y;
			this.element.removeChild(anchor);
			return size;
		} else {
			for (var size = 0, child = this.element.firstChild; child; child = child.nextSibling)
				if (child.nodeType == 1)
					size += (new CSSBox(child)).getBoxDimension('margin', 'horizontal');
			return size;
		}
	}
});

var OrientationBoxChild = LayoutBase.extend({
	updateOrientation: function (axis) {
		if (axis == 'horizontal') {
			// set class
			DOMUtils.addClass(this.element, 'orientation-horizontal-child');
		
			// if box doesn't have fixed with, shrink horizontally
			if (this.box.isContentBoxDimensionAuto(axis))
				this.box.setCSSLength('width', this.getMinContentWidth());
			this.data.set('horizontal-shrink', true);
		} else {
			// unset class
			DOMUtils.removeClass(this.element, 'orientation-horizontal-child');
	
			// undo horizontal shrinkage
			if (this.data.get('horizontal-shrink'))
				this.box.resetCSSLength('width');
			this.data.set('horizontal-shrink', false)
		}
	},

//[TODO] other ways of doing this?
	// get minimum content width, for initial horizontal sizing
	'getMinContentWidth': function () {
		// min/max-content width for browser that support the CSS property
		//[NOTE] in theory safari supports '(min-)intrinsic', but it's not equivalent
		if (DOMUtils.isUserAgent(/Gecko/i)) {
			return DOMUtils.swapStyles(this.element, {width: '-moz-min-content'}, bind(function () {
				return this.box.getBoxDimension('content', 'horizontal');
			}, this));
		}
	
		//[FIX] Safari doesn't like dimensions of '0'
		return DOMUtils.swapStyles(this.element, {width: '1px', overflow: 'auto'}, bind(function () {
			return this.element.scrollWidth - this.box.getCSSLength('padding-left') - this.box.getCSSLength('padding-right');
		}, this));
	}
});
//------------------------------------------------------------------------------
// package
//------------------------------------------------------------------------------

	// exports
	window.OrientationManager = OrientationManager;
};

//