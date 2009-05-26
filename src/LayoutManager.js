//----------------------------------------------------------------------
// layout manager
//----------------------------------------------------------------------

var LayoutManager = OrientationManager.extend({
	root: null,
	cache: null,
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
		
		// create style cache
		this.cache = new LayoutStyleCache(this.document);
	},

	getFlexibleProperty: function (element, property) {
		// validate element
		if (!DOMUtils.isElement(element))
			throw new Error('Invalid DOM element supplied.');
		
		// normalize properties and get axis
		property = this._normalizeProperty(property);
		var axis = this._getPropertyAxis(property);
		if (!axis)
			return;
		// return data
		return LayoutBoxChild.getFlexibleProperty(element, axis, property);
	},

	setFlexibleProperty: function (element, property, flex) {
		// validate element
		if (!DOMUtils.isElement(element))
			throw new Error('Invalid DOM element supplied.');
		if (!DOMUtils.isAncestorOf(this.root, element))
			throw new Error('Flexible elements must be descendants of the root node.');
			
		// normalize properties and get axis
		property = this._normalizeProperty(property);
		var axis = this._getPropertyAxis(property);
		if (!axis)
			return;
		flex = flex ? Math.max(parseInt(flex), 1) : 1
		// set element property
		LayoutBoxChild.setFlexibleProperty(element, axis, property, flex);
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
				ascend: Utils.bind(function (parent) {
					// reset layout
					var children = LayoutBox.getFlexibleChildren(parent, axis);
					if (children.length)
						LayoutBox.resetLayout(parent, children, axis, this.cache);
				}, this)
			});
		this.cache.updateStyles();
		
		// initial recalculate
		this.recalculate();
	},
	
	recalculate: function ()
	{
		// recalculate layout (in horizontal, vertical order)
		for (var axis in {horizontal: true, vertical: true})
			ElementTraversal.traverse(this.root, {
				descend: Utils.bind(function (parent) {
					// calculate layout
					var children = LayoutBox.getFlexibleChildren(parent, axis);
					if (children.length)
						LayoutBox.calculateLayout(parent, children, axis, this.cache);
				}, this)
			});
		this.cache.updateStyles();
	}
});

/*
 * style change cache
 */
 
var LayoutStyleCache = Structure.extend({
	cache: null,
	document: null,
	constructor: function (document) {
		this.document = document;
		this.cache = [];
	},
	
	queueStyleChange: function (node, prop, value) {
		this.cache.push(arguments);
	},
	
	updateStyles: function () {
		// create the stylesheet content, like a bastardized innerCSS
		for (var i = 0; i < this.cache.length; i++)
			CSSUtils.setStyleProperty(this.cache[i][0].style, this.cache[i][1], this.cache[i][2]);
		this.cache = [];
	}
});

/*
 * layout boxes
 */
 
var LayoutData = new NodeUserData('layout');

var LayoutBox = {
	getFlexibleChildren: function (parent, axis) {
		// find flexible children (assume this doesn't expire for the lifespan on the object)
		for (var children = [], child = parent.firstChild, box; child; child = child.nextSibling)
			if (DOMUtils.isElement(child) && LayoutBoxChild.isFlexibleAlongAxis(child, axis))
				children.push(child);
		return children;
	},

	resetLayout: function (parent, children, axis, layout) {
		// reset children properties
		for (var i = 0; i < children.length; i++) {
			LayoutData.set(children[i], 'unit-' + axis, 0);
			LayoutBoxChild.updateFlexibleProperties(children[i], axis, 0, layout);
		}
	},

	getUsedSpace: function (parent, children, axis) {
		// subtract children flexible space from content size
		var contentSize = OrientationBox.getContentSize(parent);
		for (var i = 0; i < children.length; i++)
			contentSize -= LayoutBoxChild.getFlexibleSpace(children[i], axis);
		return contentSize;
	},

	calculateLayout: function (parent, children, axis, cache) {
		// get content box size (actual, or desired by flex)
		var contentBoxSize = LayoutData.has(parent, 'content-size-cache-' + axis) ?
		    LayoutData.get(parent, 'content-size-cache-' + axis) :
		    BoxUtils.getBoxDimension(parent, 'content', axis);
		// calculate available free space in parent
		var usedSpace, divisor;
			
		// calculate flex unit (with flow)
		if (axis == OrientationBox.getOrientation(parent)) {
			usedSpace = LayoutBox.getUsedSpace(parent, children, axis);
			divisor = LayoutData.get(parent, 'container-divisor-' + axis);
		}
		
		// iterate flexible children
		for (var i = 0; i < children.length; i++) {
			// calculate flex unit (against flow)
			if (axis != OrientationBox.getOrientation(parent)) {
				usedSpace = LayoutBoxChild.getUsedSpace(children[i], axis);
				divisor = LayoutData.get(children[i], 'divisor-' + axis)
			}
			
			// calculate flex unit and set flexible properties
			var flexUnit = Math.max((contentBoxSize - usedSpace) / divisor, 0);
			LayoutBoxChild.updateFlexibleProperties(children[i], axis, flexUnit, cache);
			// cache flex unit
			LayoutData.set(children[i], 'unit-' + axis, flexUnit);
		}
	}
};

var LayoutBoxChild = {
	getUsedSpace: function (child, axis) {
		// subtract flexible space from content size
		var contentSize = BoxUtils.getBoxDimension(child, 'margin', axis);
		return contentSize - LayoutBoxChild.getFlexibleSpace(child, axis);
	},
	
	getFlexibleSpace: function (child, axis) {
		// calculate space taken up by flexible dimensions
		var flexUnit = LayoutData.get(child, 'unit-' + axis);
		var flexSize = LayoutData.get(child, 'divisor-' + axis) * flexUnit;
		// content box dimensions may exceed flex unit; subtract from content size
		if (LayoutBoxChild.hasFlexibleProperty(child, axis, BoxUtils.AXIS_DIMENSION[axis]))
			flexSize += BoxUtils.getBoxDimension(child, 'content', axis) -
			    (flexUnit * LayoutBoxChild.getFlexibleProperty(child, axis, BoxUtils.AXIS_DIMENSION[axis]));
		return flexSize;
	},
	
	getFlexibleProperty: function (element, axis, property) {
		return LayoutData.has(element, 'properties-' + axis) && LayoutData.get(element, 'properties-' + axis)[property];
	},
	
	hasFlexibleProperty: function (element, axis, property) {
		return LayoutData.has(element, 'properties-' + axis) && LayoutData.get(element, 'properties-' + axis).hasOwnProperty(property);
	},
	
	setFlexibleProperty: function (element, axis, property, value) {
		// update divisors
		var delta = value - (LayoutBoxChild.getFlexibleProperty(element, axis, property) || 0);
		LayoutData.set(element, 'divisor-' + axis, (LayoutData.get(element, 'divisor-' + axis) || 0) + delta);
		LayoutData.set(element.parentNode, 'container-divisor-' + axis,
		    (LayoutData.get(element.parentNode, 'container-divisor-' + axis) || 0) + delta);
		    
		// set property
		if (!LayoutData.has(element, 'properties-' + axis))
			LayoutData.set(element, 'properties-' + axis, {});
		LayoutData.get(element, 'properties-' + axis)[property] = value;
		
		//[FIX] for dimensions, we must be using content-box sizing
		if (property.match(/^(height|width)$/)) {
			CSSUtils.setStyleProperty(element.style, 'box-sizing', 'content-box');
			CSSUtils.setStyleProperty(element.style, '-moz-box-sizing', 'content-box');
			CSSUtils.setStyleProperty(element.style, '-webkit-box-sizing', 'content-box');
		}
	},
	
	isFlexibleAlongAxis: function (element, axis) {
		return LayoutData.has(element, 'divisor-' + axis) && (LayoutData.get(element, 'divisor-' + axis) > 0);
	},
	
	updateFlexibleProperties: function (element, axis, unit, cache) {
		// set flexible properties
		var properties = LayoutData.get(element, 'properties-' + axis) || {};
		for (var prop in properties)
			cache.queueStyleChange(element, (prop.match(/^(width|height)$/) ? 'min-' : '') + prop, unit * properties[prop] + 'px');
		
		// cache content-box size
		if (prop.match(/^(width|height)$/))
			LayoutData.set(element, 'content-size-cache-' + axis, unit * properties[prop]);
	}
};