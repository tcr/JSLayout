//----------------------------------------------------------------------
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
		if (!Utils.isAncestorOf(this.body, element))
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

		// sanitize child elements and update them
		if (axis == 'horizontal')
			this.sanitizeChildren();
		for (var child = this.element.firstChild; child; child = child.nextSibling)
			(new OrientationBoxChild(child)).updateOrientation(axis);

		// manipulate widths and classes
		if (axis == 'horizontal') {
			// expand box size to contain floats without wrapping
			if (this.box.isContentBoxDimensionAuto(axis)) {
				this.box.setCSSLength('width', this.getContentSize());
				this.data.set('container-horizontal-shrink', true);
			}
			// add class
			Utils.addClass(this.element, 'orientation-horizontal');
		} else {
			// remove styles
			if (this.data.get('container-horizontal-shrink')) {
				this.box.resetCSSLength('width');
				this.data.set('container-horizontal-shrink', false);
			}
			// remove class
			Utils.removeClass(this.element, 'orientation-horizontal');
		}
	},
	
	sanitizeChildren: function () {
		// horizontal orientation requires only elements can be children
		for (var i = 0, child; child = this.element.childNodes[i]; i++) {
			if (child.nodeType == 3 && !Utils.isWhitespaceNode(child)) {
				// wrap text nodes in span elements
				var wrap = this.document.createElement('span');
				Utils.addClass(wrap, 'orientation-text');
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
			var anchor = this.document.createElement('span'), box = new CSSBox(anchor);
			Utils.setStyleProperty(anchor.style, 'block');
			this.element.appendChild(anchor);
			var size = box._getRoughOffset().y;
			this.element.insertBefore(anchor, this.element.firstChild);
			size -= box._getRoughOffset().y;
			this.element.removeChild(anchor);
			return size;
		} else {
			// get horizontal size by adding box dimensions (slow)
			for (var size = 0, child = this.element.firstChild; child; child = child.nextSibling)
				if (child.nodeType == 1)
					size += (new CSSBox(child)).getBoxDimension('margin', 'horizontal');
			return size;
		}
	}
});

var OrientationBoxChild = LayoutBase.extend({
	updateOrientation: function (axis) {
		// manipulate widths and classes
		if (axis == 'horizontal') {
			// if box doesn't have fixed with, shrink horizontally
			if (this.box.isContentBoxDimensionAuto(axis)) {
				this.box.setCSSLength('width', this.getMinContentWidth());
				this.data.set('horizontal-shrink', true);
			}			
			// add class
			Utils.addClass(this.element, 'orientation-horizontal-child');
		} else {
			// undo horizontal shrinkage
			if (this.data.get('horizontal-shrink')) {
				this.box.resetCSSLength('width');
				this.data.set('horizontal-shrink', false)
			}			
			// remove class
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
