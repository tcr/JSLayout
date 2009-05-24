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
}