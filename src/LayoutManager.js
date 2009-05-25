//----------------------------------------------------------------------
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
});