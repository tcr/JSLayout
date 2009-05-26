//------------------------------------------------------------------------------
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
			'.orientation-horizontal-child { float: left; }',
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
		} else {
			// undo horizontal shrinkage
			if (OrientationData.get(element, 'horizontal-shrink')) {
				BoxUtils.resetCSSLength(element, 'width');
				OrientationData.set(element, 'horizontal-shrink', false)
			}			
			// remove class
			CSSUtils.removeClass(element, 'orientation-horizontal-child');
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
