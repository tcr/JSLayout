//------------------------------------------------------------------------------
// JS Layout Manager
// (c) Tim Cameron Ryan 2008-09
//------------------------------------------------------------------------------

new function(_) {
	var Layout = new base2.Package(this, {
		name:    'Layout',
		version: '1.0',
		imports: '',
		exports: 'LayoutManager,FullLayoutManager,OrientationManager'
	});
	
	eval(this.imports);

