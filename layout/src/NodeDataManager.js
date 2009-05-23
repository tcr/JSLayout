//----------------------------------------------------------------------
// node data manager
//----------------------------------------------------------------------

//[TODO] does this really require a prefix?
var NodeDataManager = Base.extend({
	prefix: '',
	constructor: function (prefix) {
		this.prefix = prefix || '';
	},
	get: function (node, key) {
		return this._getUserData(node, this.prefix + ':' + key);
	},
	set: function (node, key, data) {
		return this._setUserData(node, this.prefix + ':' + key, data, null);
	},
	has: function (node, key) {
		return this.get(node, key) != null;
	},
	remove: function (node, key) {
		this.set(node, key, null);
	},
	'_getUserData': function (node, key) {
		return node.getUserData(key);
	},
	'_setUserData': function (node, key, value, handler) {
		return node.setUserData(key, value, handler);
	}
});

if (!document.getUserData || !document.setUserData)
{
	// create our own data cache
	var userData = {}, userDataID = 0;
	NodeDataManager.implement({
		_getUserData: function (node, key) {
			if (typeof node['data-userDataKey'] == 'undefined')
				node['data-userDataKey'] = ++userDataID;
			return userData[node['data-userDataKey']] && userData[node['data-userDataKey']][key];
		},
		_setUserData: function (node, key, value, handler) {
			var old = this._getUserData(node, key);
			(userData[node['data-userDataKey']] || (userData[node['data-userDataKey']] = {}))[key] = value;
			return old;
		}
	});
}