//------------------------------------------------------------------------------
// JS Layout Manager
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
	addStylesheet: function (document, css) {
		var head = document.getElementsByTagName('head')[0] ||
		    document.documentElement.appendChild(document.createElement('head'));
		var style = head.appendChild(document.createElement('style'));
		document.styleSheets[0].cssText !== undefined ?
		    document.styleSheets[document.styleSheets.length - 1].cssText = css :
		    style[style.innerText !== undefined ? 'innerText' : 'innerHTML'] = css;
	},

	// class attribute manipulation (base2)
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
			var currentVal = Utils.getStyleProperty(element.currentStyle, property);
			if (property.match(/^(width|height)$/))
				return BoxUtils._shiftDimension(element, BoxUtils.getBoxDimension('padding', BoxUtils.DIMENSION_AXIS[property]), 'padding', false);
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
	var oP = Object.prototype;
	function augment(obj, props) {
		// iterate all defined properties
		for (var prop in props)
			if (oP.hasOwnProperty.call(props, prop))
				obj[prop] = props[prop];
	
		// IE has dontEnum issues
/*@cc_on	var prop, dontenums = 'constructor|toString|valueOf|toLocaleString|isPrototypeOf|propertyIsEnumerable|hasOwnProperty'.split('|');
		while (prop = dontenums.pop())
			if (oP.hasOwnProperty.call(props, prop) && !oP.propertyIsEnumerable.call(props, prop))
				obj[prop] = props[prop]; @*/
	}
	
	// clean input
	var props = p || {}, statics = s || {};
	// create factory object
	var ancestor = this, Factory = oP.hasOwnProperty.call(props, 'constructor') ?
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

//[TODO] could prefixes be randomly generated? or eliminated...
var NodeUserData = Structure.extend({
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
			'.orientation-horizontal-child { float: left; }',
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
		if (!DOMUtils.isAncestorOf(this.body, element))
			throw new Error('Only descendants of the body element can have orientation.');
		// set orientation
		parent.setOrientation(axis == 'horizontal' ? axis : 'vertical');
	}
});

/*
 * orientation boxes
 */
 
//@abstract
var LayoutBase = Structure.extend({
	document: null,
	element: null,
	data: null,
	constructor: function (element) {
		if (!DOMUtils.isElement(element))
			throw new Error('Invalid DOM element supplied.');
		this.element = element;
		this.document = DOMUtils.getOwnerDocument(element);
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

		// sanitize child elements and update them
		if (axis == 'horizontal')
			this.sanitizeChildren();
		for (var child = this.element.firstChild; child; child = child.nextSibling)
			(new OrientationBoxChild(child)).updateOrientation(axis);

		// manipulate widths and classes
		if (axis == 'horizontal') {
			// expand box size to contain floats without wrapping
			if (BoxUtils.isContentBoxDimensionAuto(this.element, axis)) {
				BoxUtils.setCSSLength(this.element, 'width', this.getContentSize());
				this.data.set('container-horizontal-shrink', true);
			}
			// add class
			CSSUtils.addClass(this.element, 'orientation-horizontal');
		} else {
			// remove styles
			if (this.data.get('container-horizontal-shrink')) {
				BoxUtils.resetCSSLength(this.element, 'width');
				this.data.set('container-horizontal-shrink', false);
			}
			// remove class
			CSSUtils.removeClass(this.element, 'orientation-horizontal');
		}
	},
	
	sanitizeChildren: function () {
		// horizontal orientation requires only elements can be children
		for (var i = 0, child; child = this.element.childNodes[i]; i++) {
			if (child.nodeType == 3 && !DOMUtils.isWhitespaceNode(child)) {
				// wrap text nodes in span elements
				var wrap = this.document.createElement('span');
				CSSUtils.addClass(wrap, 'orientation-text');
				child.parentNode.replaceChild(wrap, child);
				wrap.appendChild(child);
			} else if (child.nodeType != 1) {
				// delete all other nodes
				this.element.removeChild(child);
				i--;
			}
		}		
	},
	
//[TODO] other ways of doing this? particularly horizontally...
	// size of box content, depending on orientation
	getContentSize: function () {
		if (this.getOrientation() == 'vertical') {
			// get vertical size by differing offsets of an anchor at start and end of content
			var anchor = this.document.createElement('span');
			CSSUtils.setStyleProperty(anchor.style, 'block');
			this.element.appendChild(anchor);
			var size = BoxUtils.getRelativeOffset(anchor).y;
			this.element.insertBefore(anchor, this.element.firstChild);
			size -= BoxUtils.getRelativeOffset(anchor).y;
			this.element.removeChild(anchor);
			return size;
		} else {
			// get horizontal size by adding box dimensions (slow)
			for (var size = 0, child = this.element.firstChild; child; child = child.nextSibling)
				if (child.nodeType == 1)
					size += BoxUtils.getBoxDimension(child, 'margin', 'horizontal');
			return size;
		}
	}
});

var OrientationBoxChild = LayoutBase.extend({
	updateOrientation: function (axis) {
		// manipulate widths and classes
		if (axis == 'horizontal') {
			// if box doesn't have fixed with, shrink horizontally
			if (BoxUtils.isContentBoxDimensionAuto(this.element, axis)) {
				BoxUtils.setCSSLength(this.element, 'width', this.getMinContentWidth());
				this.data.set('horizontal-shrink', true);
			}			
			// add class
			CSSUtils.addClass(this.element, 'orientation-horizontal-child');
		} else {
			// undo horizontal shrinkage
			if (this.data.get('horizontal-shrink')) {
				BoxUtils.resetCSSLength(this.element, 'width');
				this.data.set('horizontal-shrink', false)
			}			
			// remove class
			CSSUtils.removeClass(this.element, 'orientation-horizontal-child');
		}
	},

//[TODO] other ways of doing this?
	// get minimum content width, for initial horizontal sizing
	'getMinContentWidth': function () {
		// min/max-content width for browser that support the CSS property
		//[NOTE] in theory safari supports '(min-)intrinsic', but it's not equivalent
		if (Utils.isUserAgent(/Gecko\//i)) {
			return CSSUtils.swapStyles(this.element, {width: '-moz-min-content'}, Utils.bind(function () {
				return BoxUtils.getBoxDimension(this.element, 'content', 'horizontal');
			}, this));
		}
	
		//[FIX] Safari doesn't like dimensions of '0'
		return CSSUtils.swapStyles(this.element, {width: '1px', overflow: 'auto'}, Utils.bind(function () {
			return BoxUtils._shiftDimension(this.element, this.element.scrollWidth, 'horizontal', 'padding', false);
		}, this));
	}
});
//----------------------------------------------------------------------
// resize observer
//----------------------------------------------------------------------

// element resize polling function (can't trust window.resize cross-browser)

var ResizeObserver = Structure.extend({
	constructor: function (element, timeout) {
		this.element = element;
		this.timeout = timeout || 25;
		// initial call (no listeners, just updating cache)
		this.poll();
	},
	
	element: null,
	timeout: 0,
	width: 0,
	height: 0,
	poll: function () {
		// compare window size
		if (this.width != this.element.clientWidth || this.height != this.element.clientHeight) {
			for (var i = 0; i < this.listeners.length; i++)
				this.listeners[i](this);
		}
		
		// update cache
		this.width = this.element.clientWidth;
		this.height = this.element.clientHeight;
		// add timeout
		setTimeout(Utils.bind(this.poll, this), this.timeout);
	},
	listeners: [],
	addListener: function (listener) {
		this.listeners.push(listener);
	}
});//----------------------------------------------------------------------
// simple element traversal
//----------------------------------------------------------------------

var ElementTraversal = {
	traverse: function (root, handlers) {
		// sanitize input
		if (!root || root.nodeType != 1)
			return;
		handlers = handlers || {};

		// traverse nodes
		var nodes = root.getElementsByTagName('*'), node = root, next, parent, i = 0;
		do {
			handlers.current && handlers.current(node);
			if (next = nodes[i++]) {
				if (node == (parent = next.parentNode))
					handlers.descend && handlers.descend(node)
				else if (handlers.ascend)
					while ((node = node.parentNode) != parent)
						handlers.ascend(node);
			}
			else if (handlers.ascend)
				while ((node != root) && (node = node.parentNode))
					handlers.ascend(node);
		} while (node = next);
	}
};//----------------------------------------------------------------------
// layout manager
//----------------------------------------------------------------------

var LayoutManager = OrientationManager.extend({
	root: null,
	constructor: function (root) {
		// save root
		this.root = root;
		if (!root || root.nodeType != 1)
			throw new Error('Layout manager root must be an element.');
		// orientation manager constructor
		OrientationManager.call(this, DOMUtils.getOwnerDocument(root));
		
		// check root position
		if (!DOMUtils.isAncestorOf(this.body, root) && root != this.body)
			throw new Error('Root node must be a descendant of the body element or the body itself.');
		
		// create resize listener
		var observer = new ResizeObserver(root);
		observer.addListener(Utils.bind(this.recalculate, this));
	},

	getFlexibleProperty: function (element, property) {
		// initialize
		var box = new LayoutBoxChild(element);
		
		// normalize properties and get axis
		property = this._normalizeProperty(property);
		var axis = this._getPropertyAxis(property);
		if (!axis)
			return;
		// return data
		return box.getFlexibleProperty(axis, property);
	},

	setFlexibleProperty: function (element, property, flex) {
		// initialize
		var box = new LayoutBoxChild(element);
		// validate element
		if (!DOMUtils.isAncestorOf(this.root, element))
			throw new Error('Flexible elements must be descendants of the root node.');
			
		// normalize properties and get axis
		property = this._normalizeProperty(property);
		var axis = this._getPropertyAxis(property);
		if (!axis)
			return;
		flex = flex ? Math.max(parseInt(flex), 1) : 1
		// set element property
		box.setFlexibleProperty(axis, property, flex);
	},
	
	removeFlexibleProperty: function (element, property) {
		//[TODO] remove from flexProperties and remove marker
	},
	
	// private
	
	_normalizeProperty: function (property) {
		// rewrite border properties
		return property.replace(/^(border-[a-z]+)$/, '$1-width');
	},
	
	_getPropertyAxis: function (property) {
		if (/^(width|(padding|margin)-(left|right)|border-(left|right)-width|left|right)$/.test(property))
			return 'horizontal';
		if (/^(height|(padding|margin)-(top|bottom)|border-(top|bottom)-width|top|bottom)$/.test(property))
			return 'vertical';
		return false;
	},
	
	// layout calculation
//[TODO] caching of layout objects

	calculate: function ()
	{
		// reset layout (in horizontal, vertical order)
		for (var axis in {horizontal: true, vertical: true})
			ElementTraversal.traverse(this.root, {
				ascend: Utils.bind(function (parentNode) {
					// reset/equalize nodes
					var parent = new LayoutBox(parentNode, this);
					if (parent.hasFlexibleChildren(axis))
						parent.resetContainerLayout(axis);
				}, this)
			});
		
		// initial recalculate
		this.recalculate();
	},
	
	recalculate: function ()
	{
		// recalculate layout (in horizontal, vertical order)
		for (var axis in {horizontal: true, vertical: true})
			ElementTraversal.traverse(this.root, {
				descend: Utils.bind(function (parentNode) {
					// expand nodes
					var parent = new LayoutBox(parentNode, this);
					if (parent.hasFlexibleChildren(axis))
						parent.expandContainerLayout(axis);
				}, this)
			});
	}
});

/*
 * layout boxes
 */

var LayoutBox = OrientationBox.extend({
	children: null,
	constructor: function () {
		// construct layout box
		OrientationBox.apply(this, arguments);
		
//[TODO] make this refreshable?
		// find flexible children (assume this doesn't expire for the lifespan on the object)
		this.children = {horizontal: [], vertical: []};
		for (var child = this.element.firstChild, box; child; child = child.nextSibling)
			for (var axis in this.children)
				if (child.nodeType == 1 && (box = new LayoutBoxChild(child)).isFlexibleAlongAxis(axis))
					this.children[axis].push(box);
	},
	
	hasFlexibleChildren: function (axis) {
		return this.children[axis].length > 0;
	},
	
	updateDivisor: function (axis, delta) {
		this.data.set('container-divisor-' + axis, (this.data.get('container-divisor-' + axis) || 0) + delta);
	},

	resetContainerLayout: function (axis) {
		// reset parent flex unit
		this.data.set('container-unit-' + axis, 0);
		// reset children properties
		for (var children = this.children[axis], i = 0; i < children.length; i++) {
			// reset flexible properties
			children[i].data.set('unit-' + axis, 0);
			children[i].updateFlexibleProperties(axis, 0);
		}
	},

	expandContainerLayout: function (axis) {
		// calculate available free space in parent
		var AXIS_DIMENSION = {horizontal: 'width', vertical: 'height'};
		var contentSize, contentBoxSize, divisor, oldFlexUnit, newFlexUnit;
		// get content box size (actual, or desired by flex)
		contentBoxSize = this.data.has('content-size-cache-' + axis) ?
		    this.data.get('content-size-cache-' + axis) : BoxUtils.getBoxDimension(this.element, 'content', axis);
			
		// calculate flex unit (with flow)
		if (axis == this.getOrientation()) {
			contentSize = this.getContentSize();
			divisor = this.data.get('container-divisor-' + axis);
			oldFlexUnit = this.data.get('container-unit-' + axis);
			
			// content box dimensions may be larger than flex unit; subtract from content size
			for (var children = this.children[axis], i = 0; i < children.length; i++)
				if (children[i].hasFlexibleProperty(axis, AXIS_DIMENSION[axis]))
					contentSize -= BoxUtils.getBoxDimension(children[i].element, 'content', axis) -
					    (oldFlexUnit * children[i].getFlexibleProperty(axis, AXIS_DIMENSION[axis]));
		}
		
		// iterate flexible children
		for (var children = this.children[axis], i = 0; i < children.length; i++) {
			// calculate flex unit (against flow)
			if (axis != this.getOrientation()) {
				contentSize = BoxUtils.getBoxDimension(children[i].element, 'margin', axis);
				divisor = children[i].data.get('divisor-' + axis);
				oldFlexUnit = children[i].data.get('unit-' + axis);
				// content box dimensions may be larger than flex unit; subtract from content size
				if (children[i].hasFlexibleProperty(axis, AXIS_DIMENSION[axis]))
					contentSize -= BoxUtils.getBoxDimension(children[i].element, 'content', axis) -
					    (oldFlexUnit * children[i].getFlexibleProperty(axis, AXIS_DIMENSION[axis]));
			}
			
			// set flexible properties
			var newFlexUnit = Math.max((contentBoxSize - (contentSize - (divisor * oldFlexUnit))) / divisor, 0);
			children[i].updateFlexibleProperties(axis, newFlexUnit);
			
			// cache flex unit (against flow)
			if (axis != this.getOrientation())
				children[i].data.set('unit-' + axis, newFlexUnit);
		}
		
		// cache flex unit (with flow)
		if (axis == this.getOrientation())
			this.data.set('parent-unit-' + axis, newFlexUnit);
	}
});

var LayoutBoxChild = LayoutBase.extend({	
	getFlexibleProperty: function (axis, property) {
		return this.data.has('properties-' + axis) && this.data.get('properties-' + axis)[property];
	},
	
	hasFlexibleProperty: function (axis, property) {
		return this.data.has('properties-' + axis) && this.data.get('properties-' + axis).hasOwnProperty(property);
	},
	
	setFlexibleProperty: function (axis, property, value) {
		// get divisor delta
		this.data.ensure('properties-' + axis, {});
		var delta = value - (this.getFlexibleProperty(axis, property) || 0);
		// update divisors
		this.updateDivisor(axis, delta);
		(new LayoutBox(this.element.parentNode)).updateDivisor(axis, delta);
		// set property
		this.data.get('properties-' + axis)[property] = value;
		
		//[FIX] for dimensions, we must be using content-box sizing
		if (property.match(/^(height|width)$/)) {
			CSSUtils.setStyleProperty(this.element.style, 'box-sizing', 'content-box');
			CSSUtils.setStyleProperty(this.element.style, '-moz-box-sizing', 'content-box');
			CSSUtils.setStyleProperty(this.element.style, '-webkit-box-sizing', 'content-box');
		}
	},
	
	updateDivisor: function (axis, delta) {
		this.data.set('divisor-' + axis, (this.data.get('divisor-' + axis) || 0) + delta);
	},
	
	isFlexibleAlongAxis: function (axis) {
		return this.data.has('divisor-' + axis) && (this.data.get('divisor-' + axis) > 0);
	},
	
	updateFlexibleProperties: function (axis, unit) {
		// set flexible properties
		var properties = this.data.get('properties-' + axis) || {};
		for (var prop in properties)
			BoxUtils.setCSSLength(this.element, (prop.match(/^(width|height)$/) ? 'min-' : '') + prop, unit * properties[prop]);
		if (prop.match(/^(width|height)$/))
			this.data.set('content-size-cache-' + axis, unit * properties[prop]);
	}
});//----------------------------------------------------------------------
// full-page layout manager
//----------------------------------------------------------------------

var FullLayoutManager = LayoutManager.extend({
	constructor: function (document, overflow) {
		// make document elements full-page
		var html = document.documentElement, body = document.getElementsByTagName('body')[0];
		CSSUtils.setStyles(html, {height: '100%', width: '100%', margin: 0, border: 'none', padding: 0, overflow: overflow || 'hidden'});
		CSSUtils.setStyles(body, {height: '100%', width: '100%', margin: 0, border: 'none', padding: 0, overflow: 'visible'});

		// construct manager
		LayoutManager.call(this, body);
	}
});

//------------------------------------------------------------------------------
// package
//------------------------------------------------------------------------------

	// exports
	window.OrientationManager = OrientationManager;
	window.LayoutManager = LayoutManager;
	window.FullLayoutManager = FullLayoutManager;
};

//