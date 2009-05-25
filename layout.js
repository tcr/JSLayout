//------------------------------------------------------------------------------
// JS Layout Manager
// (c) Tim Cameron Ryan 2008-09
//------------------------------------------------------------------------------

new function(_) {


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

	// class attribute manipulation
	addClass: function (element, className) {
		Utils.removeClass(element, className);
		element.className += ' ' + className;
	},
	removeClass: function (element, className) {
		element.className = (' ' + (element.className || '') + ' ').replace(' ' + className + ' ', ' ');
	},
	hasClass: function (element, className) {
		return (' ' + (element.className || '') + ' ').indexOf(' ' + className + ' ') != -1;
	},
	
	// UA detection
	isUserAgent: function (regexp) {
		return regexp.test(navigator.userAgent);
	},
	
	// function binding
	bind: function (fn, context) {
		return function () { return fn.apply(context, arguments ); };
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
// CSS Box
//----------------------------------------------------------------------

var CSSBox = Structure.extend({
	constructor: function (element) {
		if (!element || element.nodeType !== 1)
			throw new Error('Invalid DOM element supplied.');
		this.element = element;
		this.view = Utils.getOwnerDocument(element).defaultView || window;
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
			if (Utils.isUserAgent(/KTML|Webkit/i) && property == 'margin-right' &&
			    computedStyle.getPropertyValue('float') == 'none')
//[TODO] is there a quicker way than float: left?
				return parseFloat(Utils.swapStyles(this.element, {'float': 'left'}, Utils.bind(function () {
					return this.view.getComputedStyle(this.element, null).getPropertyValue(property);
				}, this)));
			// return computed style value
			return parseFloat(computedStyle.getPropertyValue(property));
		}
		else if (this.element.currentStyle) {
			// getComputedStyle emulation for IE (courtesy Dean Edwards)
			var currentVal = Utils.getStyleProperty(this.element.currentStyle, property);
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
		property = this._normalizeProperty(property);
		Utils.setStyleProperty(this.element.style, property, length + 'px');
	},
	resetCSSLength: function (property) {
		property = this._normalizeProperty(property);
		Utils.removeStyleProperty(this.element.style, property);
	},
	_normalizeProperty: function (property) {
		return property.replace(/^(border-[a-z]+)$/, '$1-width');
	},
	isContentBoxDimensionAuto: function (axis) {
		// auto will not expand offset dimension with padding
		var temp = Utils.getStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis]);
		Utils.setStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis], '0px');
		var dimension = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]];
		Utils.setStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis], '1px');
		var flag = this.element['offset' + CSSBox.AXIS_DIMENSION_UP[axis]] == dimension;
		Utils.setStyleProperty(this.element.style, 'padding-' + CSSBox.AXIS_TL[axis], temp);
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
		Utils.addStylesheet(document, [
//[TODO] this specificity (-child) might be too much for fixed-width objects; is width: 0 necessary?
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
		if (!Utils.contains(this.body, element))
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
	box: null,
	data: null,
	constructor: function (element) {
		if (!element || element.nodeType != 1)
			throw new Error('Invalid DOM element supplied.');
		this.element = element;
		this.document = Utils.getOwnerDocument(element);
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
			Utils.addClass(this.element, 'orientation-horizontal');
			// expand box size to contain floats without wrapping
			this.box.setCSSLength('width', this.getContentSize());
		} else {
			// remove class and styles
			Utils.removeClass(this.element, 'orientation-horizontal');
			this.box.resetCSSLength('width');
		}
	},
	
	containChildTextNodes: function () {
//[TODO] delete whitespace nodes? make this customizable?
		// wrap child text nodes in span elements
		for (var child = this.element.firstChild; child; child = child.nextSibling) {
			if (child.nodeType == 3) {			
				var wrap = this.document.createElement('span');
				Utils.addClass(wrap, 'orientation-text');
				child.parentNode.replaceChild(wrap, child);
				wrap.appendChild(child);
				child = wrap;
			}
		}		
	},
	restoreChildTextNodes: function () {
		// undo child text node wrapping
		for (var child = this.element.firstChild; child; child = child.nextSibling) {
			if (child.nodeType == 1 && Utils.hasClass(child, 'orientation-text')) {
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
			Utils.setStyleProperty(anchor.style, 'block');
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
			// if box doesn't have fixed with, shrink horizontally
			if (this.box.isContentBoxDimensionAuto(axis))
				this.box.setCSSLength('width', this.getMinContentWidth());
			this.data.set('horizontal-shrink', true);
			
			// set class
			Utils.addClass(this.element, 'orientation-horizontal-child');
		} else {
			// undo horizontal shrinkage
			if (this.data.get('horizontal-shrink'))
				this.box.resetCSSLength('width');
			this.data.set('horizontal-shrink', false)
			
			// unset class
			Utils.removeClass(this.element, 'orientation-horizontal-child');
		}
	},

//[TODO] other ways of doing this?
	// get minimum content width, for initial horizontal sizing
	'getMinContentWidth': function () {
		// min/max-content width for browser that support the CSS property
		//[NOTE] in theory safari supports '(min-)intrinsic', but it's not equivalent
		if (Utils.isUserAgent(/Gecko\//i)) {
			return Utils.swapStyles(this.element, {width: '-moz-min-content'}, Utils.bind(function () {
				return this.box.getBoxDimension('content', 'horizontal');
			}, this));
		}
	
		//[FIX] Safari doesn't like dimensions of '0'
		return Utils.swapStyles(this.element, {width: '1px', overflow: 'auto'}, Utils.bind(function () {
			return this.box._shiftDimension(this.element.scrollWidth, 'horizontal', 'padding', false);
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
		OrientationManager.call(this, Utils.getOwnerDocument(root));
		
		// check root position
		if (!Utils.contains(this.body, root) && root != this.body)
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
		if (!Utils.contains(this.root, element))
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
	
	updateDivisor: function (axis) {
		// set flexible properties
		var divisor = 0;
		for (var children = this.children[axis], i = 0; i < children.length; i++)
			divisor += children[i].data.get('divisor-' + axis);
		this.data.set('container-divisor-' + axis, divisor);
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
		    this.data.get('content-size-cache-' + axis) : this.box.getBoxDimension('content', axis);
			
		// calculate flex unit (with flow)
		if (axis == this.getOrientation()) {
			contentSize = this.getContentSize();
			divisor = this.data.get('container-divisor-' + axis);
			oldFlexUnit = this.data.get('container-unit-' + axis);
			
			// content box dimensions may be larger than flex unit; subtract from content size
			for (var children = this.children[axis], i = 0; i < children.length; i++)
				if (children[i].hasFlexibleProperty(axis, AXIS_DIMENSION[axis]))
					contentSize -= children[i].box.getBoxDimension('content', axis) -
					    (oldFlexUnit * children[i].getFlexibleProperty(axis, AXIS_DIMENSION[axis]));
		}
		
		// iterate flexible children
		for (var children = this.children[axis], i = 0; i < children.length; i++) {
			// calculate flex unit (against flow)
			if (axis != this.getOrientation()) {
				contentSize = children[i].box.getBoxDimension('margin', axis);
				divisor = children[i].data.get('divisor-' + axis);
				oldFlexUnit = children[i].data.get('unit-' + axis);
				// content box dimensions may be larger than flex unit; subtract from content size
				if (children[i].hasFlexibleProperty(axis, AXIS_DIMENSION[axis]))
					contentSize -= children[i].box.getBoxDimension('content', axis) -
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
		this.data.ensure('properties-' + axis, {});
		this.data.get('properties-' + axis)[property] = value;
		// reset flex count
		this.updateDivisor(axis);
		(new LayoutBox(this.element.parentNode)).updateDivisor(axis);
	},

	updateDivisor: function (axis) {
		// set flexible properties
		var properties = this.data.get('properties-' + axis) || {}, divisor = 0;
		for (var prop in properties)
			divisor += properties[prop];
		this.data.set('divisor-' + axis, divisor);
	},
	
	isFlexibleAlongAxis: function (axis) {
		return this.data.has('divisor-' + axis) && (this.data.get('divisor-' + axis) > 0);
	},
	
	updateFlexibleProperties: function (axis, unit) {
		// set flexible properties
		var properties = this.data.get('properties-' + axis) || {};
		for (var prop in properties)
			this.box.setCSSLength((prop.match(/^(width|height)$/) ? 'min-' : '') + prop, unit * properties[prop]);
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
		Utils.setStyles(html, {height: '100%', width: '100%', margin: 0, border: 'none', padding: 0, overflow: overflow || 'hidden'});
		Utils.setStyles(body, {height: '100%', width: '100%', margin: 0, border: 'none', padding: 0, overflow: 'visible'});

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